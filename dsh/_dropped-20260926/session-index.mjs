/**
 * session-index — a cross-cwd index of every dsh session, so the agent can answer
 * "what was I working on last time" instead of guessing.
 *
 * WHY: dsh stores each session as <sessionId>/session.v*.jsonl.zstd under ONE
 * DIRECTORY PER CWD, and this box already has 825 of them (163 MB) spread over 8 cwd
 * buckets — 640 under C:\Windows\System32 from batch runs. Nothing in the default
 * composition lists them across cwd: session-query searches CONTENT, and
 * session_projcache only covers a handful of live sessions. Codex keeps the
 * equivalent in its state.sqlite `threads` table (id / rollout_path / cwd /
 * created_at / title); this plugin is the dsh-side counterpart.
 *
 * HOW: the first zstd frame of a session file is a one-line session header (~200
 * bytes) and the first user message sits within the first few frames, so a full
 * rescan of 825 files costs about a second. Records are cached in a JSON index and
 * refreshed incrementally by (mtime, size). Read-only: session storage is never
 * modified.
 */

import { readdir, readFile, writeFile, stat, mkdir, rename } from 'node:fs/promises'
import { join, basename, dirname } from 'node:path'
import { homedir } from 'node:os'
import { zstdDecompressSync } from 'node:zlib'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'session-index'

/** The tools service must exist before this tool can register. */
export const inject = ['tools']

/** Session storage root (one subdirectory per cwd). */
const SESSIONS_ROOT = process.env.DSH_SESSIONS_DIR ?? join(homedir(), '.dsh', 'sessions')
/** Where the derived index lives; never inside session storage itself. */
const INDEX_PATH = process.env.DSH_SESSION_INDEX ?? join(homedir(), '.dsh', 'storages', 'dsh-session-index.json')

/** zstd frame magic. */
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
/** Frames scanned per file: frame 0 is the header, then the first user message. */
const TITLE_SCAN_FRAMES = 6
const MAX_TITLE = 140
const DEFAULT_LIMIT = 30
const MAX_LIMIT = 200

/** Minimal JSON schema compiler for tool parameters (zero dependencies). */
function toJsonSchema(spec) {
  const properties = {}
  const required = []
  for (const [key, meta] of Object.entries(spec || {})) {
    const prop = { type: meta.type }
    if (meta.description) prop.description = meta.description
    properties[key] = prop
    if (meta.required) required.push(key)
  }
  return { type: 'object', properties, required, additionalProperties: false }
}

/** Byte offsets of every zstd frame in a session file. */
function frameOffsets(buffer) {
  const offsets = []
  let at = buffer.indexOf(MAGIC)
  while (at !== -1) {
    offsets.push(at)
    at = buffer.indexOf(MAGIC, at + MAGIC.length)
  }
  return offsets
}

/** First real user message in a jsonl chunk, flattened for a one-line index row. */
function firstUserText(text) {
  for (const line of text.split('\n')) {
    if (!line.includes('user/message')) continue
    try {
      const event = JSON.parse(line)
      if (event?.type !== 'user/message') continue
      const content = event.data?.content
      const joined = Array.isArray(content)
        ? content.map((part) => (typeof part?.text === 'string' ? part.text : '')).join(' ')
        : ''
      const clean = joined.replace(/\s+/g, ' ').trim()
      if (clean.length > 0) return clean.slice(0, MAX_TITLE)
    } catch {
      /* a frame still being written must never abort the scan */
    }
  }
  return ''
}

/** Read one session file into a flat record; returns undefined when unreadable. */
async function readSession(file) {
  let buffer
  try {
    buffer = await readFile(file)
  } catch {
    return undefined
  }
  const offsets = frameOffsets(buffer)
  if (offsets.length === 0) return undefined
  let header = {}
  let title = ''
  for (let i = 0; i < Math.min(offsets.length, TITLE_SCAN_FRAMES); i++) {
    const end = offsets[i + 1] ?? buffer.length
    let text
    try {
      text = zstdDecompressSync(buffer.subarray(offsets[i], end)).toString('utf8')
    } catch {
      continue
    }
    if (i === 0) {
      try {
        const parsed = JSON.parse(text.split('\n')[0])
        if (parsed && typeof parsed === 'object') header = parsed
      } catch {
        /* older files may not carry a JSON header */
      }
      continue
    }
    title = firstUserText(text)
    if (title.length > 0) break
  }
  return {
    id: header.id ?? basename(dirname(file)),
    version: header.version ?? 0,
    createdAt: header.createdAt ?? 0,
    cwd: header.cwd ?? '',
    agentPreset: header.agentPreset ?? '',
    delegationDepth: header.delegationDepth ?? 0,
    title,
    file,
  }
}

/** Load the cached index; a missing or corrupt file reads as empty. */
async function loadIndex() {
  try {
    const parsed = JSON.parse(await readFile(INDEX_PATH, 'utf8'))
    if (parsed && typeof parsed === 'object' && parsed.sessions) return parsed
  } catch {
    /* cold start */
  }
  return { version: 1, scannedAt: 0, sessions: {} }
}

/** Atomic write: temp file then rename. */
async function saveIndex(index) {
  await mkdir(dirname(INDEX_PATH), { recursive: true })
  const tmp = `${INDEX_PATH}.tmp-${process.pid}`
  await writeFile(tmp, JSON.stringify(index), 'utf8')
  await rename(tmp, INDEX_PATH)
}

/** Every session file under the storage root. */
async function sessionFiles() {
  const found = []
  async function walk(dir) {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.name.endsWith('.jsonl.zstd')) found.push(full)
    }
  }
  await walk(SESSIONS_ROOT)
  return found
}

/** Refresh incrementally: only files whose (mtime, size) changed are re-read. */
async function refresh(force) {
  const index = await loadIndex()
  const files = await sessionFiles()
  let updated = 0
  let reused = 0
  for (const file of files) {
    let info
    try {
      info = await stat(file)
    } catch {
      continue
    }
    const stamp = `${Math.round(info.mtimeMs)}:${info.size}`
    const known = index.sessions[file]
    if (!force && known && known.stamp === stamp) {
      reused++
      continue
    }
    const record = await readSession(file)
    if (record === undefined) continue
    record.stamp = stamp
    record.mtimeMs = Math.round(info.mtimeMs)
    record.bytes = info.size
    index.sessions[file] = record
    updated++
  }
  index.scannedAt = Date.now()
  await saveIndex(index)
  return { index, files: files.length, updated, reused }
}

/** Parse a window such as 3d / 12h / 2w into milliseconds (0 = no window). */
function parseWindow(raw) {
  const match = /^(\d+)\s*([hdwm])$/.exec(String(raw ?? '').trim().toLowerCase())
  if (!match) return 0
  const unit = { h: 3600e3, d: 86400e3, w: 604800e3, m: 2592e6 }[match[2]]
  return Number(match[1]) * unit
}

/** Register the read-only cross-cwd session index tool. */
export function apply(ctx) {
  ctx.tools.register({
    name: 'session_index',
    description:
      '跨 cwd 列出本机全部 dsh 会话（时间 / cwd / 首条用户消息 / 版本 / 大小 / id），用来回答「我上次在做什么」「那批批量任务一共派发了多少会话」。默认按文件修改时间倒序返回最近 30 条。只读，不修改任何会话数据。要按会话正文内容检索请改用 session-query 工具',
    parameters: toJsonSchema({
      query: { type: 'string', description: '可选：关键词，匹配首条用户消息或 cwd' },
      cwd: { type: 'string', description: '可选：只看某个 cwd（子串匹配，如 system32）' },
      since: { type: 'string', description: '可选：时间窗，如 3d / 12h / 2w（按文件修改时间）' },
      limit: { type: 'string', description: '可选：返回条数，默认 30，上限 200' },
      refresh: { type: 'string', description: '可选：传 "1" 强制全量重扫（默认增量，只读变化的文件）' },
    }),
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' } }, required: ['text'] },
      render: (_a, v) => [{ type: 'text', text: v.text }],
    },
    async execute(args) {
      const { index, files, updated, reused } = await refresh(String(args.refresh ?? '') === '1')
      const records = Object.values(index.sessions)
      const query = String(args.query ?? '').toLowerCase().trim()
      const cwdFilter = String(args.cwd ?? '').toLowerCase().trim()
      const windowMs = parseWindow(args.since)
      const limit = Math.min(Math.max(Number(args.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT)

      const filtered = records.filter((record) => {
        if (cwdFilter && !String(record.cwd).toLowerCase().includes(cwdFilter)) return false
        if (windowMs && Date.now() - (record.mtimeMs ?? 0) > windowMs) return false
        if (query) {
          const haystack = `${record.title} ${record.cwd} ${record.id}`.toLowerCase()
          if (!haystack.includes(query)) return false
        }
        return true
      })
      filtered.sort((a, b) => (b.mtimeMs ?? 0) - (a.mtimeMs ?? 0))
      const shown = filtered.slice(0, limit)
      if (shown.length === 0) {
        return { text: `No session matches. Indexed ${records.length} sessions from ${files} files.` }
      }
      const lines = shown.map((record) => {
        const when = new Date(record.mtimeMs ?? 0).toISOString().slice(5, 16).replace('T', ' ')
        const size = `${Math.round((record.bytes ?? 0) / 1024)}K`
        const cwd = String(record.cwd || '?').slice(0, 26)
        return `${when} ${size.padStart(6)} v${record.version} ${cwd.padEnd(27)} ${record.title || '(no user message)'}  [${String(record.id).slice(0, 18)}]`
      })
      const head = `Sessions: ${filtered.length} matched / ${records.length} indexed (${updated} rescanned, ${reused} cached)`
      return { text: `${head}\n${lines.join('\n')}` }
    },
  })

  ctx.tools.register({
    name: 'session_digest',
    description:
      '把某一个 dsh 会话压成结构化摘要（任务 / 轮次 / 工具调用次数 / 错误数 / 结论），用来回忆「上次那个会话到底做了什么」，不必解压整个会话文件。先用 session_index 拿到会话 id，再把 id 传给本工具。只读',
    parameters: toJsonSchema({
      id: { type: 'string', description: '会话 id（如 session-a0d5fbf8）或会话文件绝对路径；省略则取最近修改的那个会话' },
      maxChars: { type: 'string', description: '可选：结论截断字符数，默认 600' },
    }),
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' } }, required: ['text'] },
      render: (_a, v) => [{ type: 'text', text: v.text }],
    },
    async execute(args) {
      const wanted = String(args.id ?? '').trim()
      const maxChars = Math.min(Math.max(Number(args.maxChars) || 600, 80), 4000)
      const { index } = await refresh(false)
      const records = Object.values(index.sessions)
      let record
      if (wanted.length === 0) {
        record = records.sort((a, b) => (b.mtimeMs ?? 0) - (a.mtimeMs ?? 0))[0]
      } else {
        record =
          records.find((r) => r.file === wanted) ??
          records.find((r) => String(r.id) === wanted) ??
          records.find((r) => String(r.id).startsWith(wanted))
      }
      if (record === undefined) {
        return { text: `No indexed session matches "${wanted}". Run session_index first.` }
      }
      const digest = await digestSession(record.file, maxChars)
      if (digest === undefined) {
        return { text: `Session file unreadable: ${record.file}` }
      }
      const when = new Date(record.mtimeMs ?? 0).toISOString().slice(0, 16).replace('T', ' ')
      const head = [
        `session ${record.id}`,
        `cwd        ${record.cwd || '?'}`,
        `preset     ${record.agentPreset || '(none)'}`,
        `last write ${when}   size ${Math.round((record.bytes ?? 0) / 1024)}K   frames ${digest.frames}`,
        `scale      ${digest.turns} turns / ${digest.toolCalls} tool calls / ${digest.errors} errors`,
      ].join('\n')
      const parts = [head]
      if (digest.firstUser) parts.push(`\n## 任务（首条用户消息）\n${digest.firstUser}`)
      if (digest.conclusion) parts.push(`\n## 结论（最后一条助手回复）\n${digest.conclusion}`)
      return { text: parts.join('\n') }
    },
  })
}

/** Fold one session file into a compact digest, decompressing each frame once. */
async function digestSession(file, conclusionChars) {
  let buffer
  try {
    buffer = await readFile(file)
  } catch {
    return undefined
  }
  const offsets = frameOffsets(buffer)
  if (offsets.length === 0) return undefined
  const frameText = (i) => {
    try {
      return zstdDecompressSync(buffer.subarray(offsets[i], offsets[i + 1] ?? buffer.length)).toString('utf8')
    } catch {
      return ''
    }
  }
  const total = offsets.length
  const tailStart = Math.max(0, total - 8)
  const tail = []
  let header = {}
  let firstUser = ''
  let toolCalls = 0
  let errors = 0
  let maxTurn = 0
  for (let i = 0; i < total; i++) {
    const text = frameText(i)
    if (i >= tailStart) tail.push(text)
    if (i === 0) {
      try {
        const parsed = JSON.parse(text.split('\n')[0])
        if (parsed?.type === 'session') header = parsed
      } catch {
        /* older files may not carry a JSON header */
      }
    }
    if (firstUser === '' && i < 10 && text.includes('user/message')) {
      firstUser = firstUserText(text)
    }
    toolCalls += (text.match(/"type":"tool\/result"/g) ?? []).length
    errors += (text.match(/"isError":true/g) ?? []).length
    for (const turn of text.match(/"turn":(\d+)/g) ?? []) {
      const n = Number(turn.slice(7))
      if (n > maxTurn) maxTurn = n
    }
  }
  let conclusion = ''
  for (let i = tail.length - 1; i >= 0 && conclusion === ''; i--) {
    const lines = tail[i].split('\n')
    for (let k = lines.length - 1; k >= 0; k--) {
      if (!lines[k].includes('assistant/message')) continue
      try {
        const event = JSON.parse(lines[k])
        const parts = event.data?.message?.content ?? []
        const text = parts
          .filter((part) => part?.type === 'text' && typeof part.text === 'string')
          .map((part) => part.text)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (text.length > 0) {
          conclusion = text.slice(0, conclusionChars)
          break
        }
      } catch {
        /* skip malformed lines */
      }
    }
  }
  return {
    header,
    firstUser,
    conclusion,
    toolCalls,
    errors,
    turns: maxTurn,
    frames: total,
    bytes: buffer.length,
    mtimeMs: 0,
  }
}
