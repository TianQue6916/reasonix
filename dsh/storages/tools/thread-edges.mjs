#!/usr/bin/env node
/**
 * thread-edges.mjs — 从 dsh session 帧导出「agent 派发关系」
 * Codex `thread_spawn_edges` 的 dsh 等价物。
 *
 * 语义差异（重要）：dsh 的 subagent 在**同一 session 内**运行、有自己的 context，
 * 但**不落独立 session 文件** → 所以导出的是「谁派发了哪个子任务」的派发记录，
 * 而非云端那种独立的子线程 ID。父节点 = session，子节点 = 每次派发。
 *
 * 用法:
 *   node thread-edges.mjs [--dir <sessions 目录>] [--out edges.json] [--dot edges.dot]
 *                         [--limit 30] [--names subagent,workflow,subagent_fork]
 */
import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { homedir } from 'node:os'

const argv = process.argv.slice(2)
const opt = { limit: 30, names: ['subagent', 'workflow', 'subagent_fork', 'ralph'], out: null, dot: null }
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--dir') opt.dir = argv[++i]
  else if (a === '--out') opt.out = argv[++i]
  else if (a === '--dot') opt.dot = argv[++i]
  else if (a === '--limit') opt.limit = Number(argv[++i])
  else if (a === '--names') opt.names = argv[++i].split(',').map(s => s.trim())
  else if (a === '-h' || a === '--help') { console.log(readFileSync(new URL(import.meta.url)).toString().split('*/')[0]); process.exit(0) }
}
const ROOT = opt.dir ?? join(homedir(), '.dsh', 'sessions')
const ZSTD = process.env.ZSTD_BIN ?? 'zstd'

function findSessions(root) {
  const out = []
  const walk = (d, depth) => {
    if (depth > 3) return
    let ents = []
    try { ents = readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const e of ents) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p, depth + 1)
      else if (e.name.endsWith('.jsonl.zstd')) {
        try { out.push({ path: p, mtime: statSync(p).mtimeMs }) } catch {}
      }
    }
  }
  walk(root, 0)
  return out.sort((a, b) => b.mtime - a.mtime).slice(0, opt.limit)
}

const sessions = findSessions(ROOT)
const edges = []
let scanned = 0, failed = 0
for (const s of sessions) {
  let text
  try { text = execFileSync(ZSTD, ['-dc', s.path], { maxBuffer: 512 * 1024 * 1024 }).toString('utf8') } catch { failed++; continue }
  scanned++
  const sid = (s.path.match(/session-([0-9a-f-]{36})/) ?? [])[1] ?? s.path
  let turn = null
  for (const line of text.split('\n')) {
    if (!line.startsWith('{"type":"tool/call"')) continue
    let f
    try { f = JSON.parse(line) } catch { continue }
    const d = f.data ?? {}
    if (!opt.names.includes(d.name)) continue
    let args = {}
    try { args = typeof d.arguments === 'string' ? JSON.parse(d.arguments) : (d.arguments ?? {}) } catch {}
    const meta = args.meta || {}
    const task = meta.description || meta.name || args.task || args.prompt || args.description || args.query || ''
    edges.push({
      session: sid,
      seq: f.seq ?? null,
      time: f.time ? new Date(f.time).toISOString() : null,
      tool: d.name,
      callId: d.callId ?? null,
      task: String(task).slice(0, 400),
      name: meta.name || null,
      context: args.context ? String(args.context).slice(0, 120) : null,
    })
    // workflow/subagent 的 script 里每个 agent(...) 调用 = 一条真实的子线程派发边
    const script = args.script || ''
    const calls = []
    const re = /agent\s*\(\s*(["'\`])/g
    let mm
    while ((mm = re.exec(script)) !== null) {
      const quote = mm[1]
      const start = mm.index + mm[0].length
      const end = script.indexOf(quote, start)
      if (end > start) calls.push(script.slice(start, end).split('\n').join(' ').slice(0, 300))
    }
    for (const ctext of calls) {
      edges.push({
        session: sid,
        seq: f.seq ?? null,
        time: f.time ? new Date(f.time).toISOString() : null,
        tool: (d.name || '') + ':agent',
        callId: d.callId ?? null,
        task: ctext,
        parent: 'workflow:' + (meta.name || ''),
      })
    }
  }
}
const outPath = opt.out ?? join(ROOT, '..', 'thread-edges.json')
writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), root: ROOT, scannedSessions: scanned, failedSessions: failed, edgeCount: edges.length, edges }, null, 1), 'utf8')
console.log(`扫描 session: ${scanned}（失败 ${failed}）→ 派发边 ${edges.length} 条`)
const bySession = edges.reduce((m, e) => (m[e.session] = (m[e.session] ?? 0) + 1, m), {})
console.log(`涉及会话: ${Object.keys(bySession).length}`)
for (const [k, v] of Object.entries(bySession).slice(0, 6)) console.log(`  ${k}  ${v} 条`)
const byTool = edges.reduce((m, e) => (m[e.tool] = (m[e.tool] ?? 0) + 1, m), {})
if (edges.length) console.log('按工具:', JSON.stringify(byTool))
console.log(`输出: ${outPath}`)
if (opt.dot) {
  const out = ['digraph thread_edges {', '  rankdir=LR;', '  node [shape=box,fontsize=10];']
  const sessions = [...new Set(edges.map(e => e.session))]
  for (const sid of sessions) out.push('  "' + sid + '" [shape=ellipse,fillcolor="#3498db",style=filled,fontcolor=white];')
  const clean = (s) => String(s || '').split('"').join('').split('\\').join('').split('\n').join(' ').slice(0, 70)
  // 先建 workflow 节点，再把带 parent 的 agent 边挂到对应 workflow 下
  const wfNodes = new Map()
  edges.forEach((e, i) => {
    if (e.tool !== 'workflow') return
    const nid = 'w' + i
    wfNodes.set('workflow:' + String(e.name || clean(e.task).slice(0, 40)), nid)
    out.push('  "' + nid + '" [label="' + clean(e.tool) + '\n' + clean(e.task) + '"];')
    out.push('  "' + e.session + '" -> "' + nid + '";')
  })
  edges.forEach((e, i) => {
    if (e.tool === 'workflow') return
    const nid = 'a' + i
    out.push('  "' + nid + '" [label="' + clean(e.tool) + '\n' + clean(e.task) + '", style=dashed];')
    let src = '"' + e.session + '"'
    if (e.parent) {
      for (const [k, v] of wfNodes) {
        if (k === e.parent) { src = '"' + v + '"'; break }
      }
    }
    out.push('  ' + src + ' -> "' + nid + '";')
  })
  out.push('}')
  writeFileSync(opt.dot, out.join('\n') + '\n', 'utf8')
  console.log('DOT: ' + opt.dot)
}
