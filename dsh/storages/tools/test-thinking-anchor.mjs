/**
 * test-thinking-anchor.mjs — 自测 @local/dsh-thinking-language 与 thinking-anchor.mjs 合并后
 * 的契约：锚点文本必须跟随 $DSH_HOME/storages/thinking-language.json 逐 step 现读。
 *
 * 运行:  node ~/.dsh/storages/tools/test-thinking-anchor.mjs
 * 退出码: 0 = 全过，1 = 有 FAIL
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const HOME = join(tmpdir(), `ta-test-${process.pid}`)
process.env.DSH_HOME = HOME
mkdirSync(join(HOME, 'storages'), { recursive: true })

const mod = await import('file:///C:/Users/27063/.dsh/.agent-presets/anchored-standard/thinking-anchor.mjs')
const { apply, readLanguage, statePath, ANCHOR_TEXT, DEFAULT_LANGUAGE, dshHome } = mod

let pass = 0
let fail = 0
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}`) }
  else { fail++; console.log(`  FAIL ${name}${extra ? '  <- ' + extra : ''}`) }
}
const setState = (value) => {
  // 故意让每次写入的字节数不同，确保 mtime+size 缓存键一定会变
  const body = value === undefined ? 'not json at all' : JSON.stringify(value, null, value?.pad ? 2 : 0)
  writeFileSync(statePath(), body, 'utf8')
}
const clearState = () => rmSync(statePath(), { force: true })

/** 抓取 handler，并驱动一次 pre-step。 */
const run = async (cfg = {}, decision = { messages: [{ id: 'u1', role: 'user', content: [] }] }) => {
  let handler = null
  const ctx = { on: (event, fn) => { if (event === 'agent/pre-step') handler = fn } }
  apply(ctx, cfg)
  if (handler === null) return { registered: false, decision: null, injected: null }
  const out = await handler({ agent: {} }, async () => decision)
  const injected = out?.messages?.[out.messages.length - 1] ?? null
  return { registered: true, decision: out, injected }
}

console.log(`\n=== thinking-anchor ↔ thinking-language 合并契约 ===\n  DSH_HOME=${HOME}\n`)

console.log('[1] 路径契约')
t('dshHome() 跟随 DSH_HOME', dshHome() === HOME, dshHome())
t('statePath() 指向 storages/thinking-language.json',
  statePath().endsWith(join('storages', 'thinking-language.json')), statePath())

console.log('\n[2] 缺状态文件 → 回落中文')
clearState()
t('readLanguage() === zh', readLanguage() === 'zh', readLanguage())
t('DEFAULT_LANGUAGE === zh', DEFAULT_LANGUAGE === 'zh')
{
  const { injected } = await run()
  t('注入文本是中文锚点', injected?.content?.[0]?.text === ANCHOR_TEXT.zh)
  t('中文锚点含 <thinking-language>中文', injected?.content?.[0]?.text?.includes('<thinking-language>中文</thinking-language>'))
}

console.log('\n[3] 状态 = en → 注入英文锚点')
setState({ thinking: 'en' })
t('readLanguage() === en', readLanguage() === 'en', readLanguage())
{
  const { injected } = await run()
  const text = injected?.content?.[0]?.text ?? ''
  t('注入文本是英文锚点', text === ANCHOR_TEXT.en, JSON.stringify(text.slice(0, 60)))
  t('含 <thinking-language>English', text.includes('<thinking-language>English</thinking-language>'))
  t('不再出现中文字符', !/[\u4e00-\u9fff]/.test(text), JSON.stringify(text))
}

console.log('\n[4] 切回 zh → 立即生效（证明逐 step 现读，不是 apply() 时定死）')
setState({ thinking: 'zh', pad: true })
{
  const { injected } = await run()
  t('已切回中文锚点', injected?.content?.[0]?.text === ANCHOR_TEXT.zh)
}

console.log('\n[5] 一个 handler 内连续两次 step，中间切语言')
setState({ thinking: 'en' })
{
  let handler = null
  apply({ on: (e, fn) => { if (e === 'agent/pre-step') handler = fn } }, {})
  const drive = async () => {
    const out = await handler({ agent: {} }, async () => ({ messages: [] }))
    return out.messages[out.messages.length - 1].content[0].text
  }
  const first = await drive()
  setState({ thinking: 'zh', pad: true })
  const second = await drive()
  t('第一次 step 是英文', first === ANCHOR_TEXT.en)
  t('第二次 step 变中文（无需重建 handler）', second === ANCHOR_TEXT.zh, JSON.stringify(second.slice(0, 40)))
}

console.log('\n[6] 坏输入一律回落中文')
setState(undefined)
t('坏 JSON → zh', readLanguage() === 'zh', readLanguage())
setState({ thinking: 'fr' })
t('越界值 fr → zh', readLanguage() === 'zh', readLanguage())
setState({ thinking: 'EN' })
t('大小写敏感：EN → zh', readLanguage() === 'zh', readLanguage())
setState({})
t('缺 thinking 字段 → zh', readLanguage() === 'zh', readLanguage())

console.log('\n[7] cfg 行为')
setState({ thinking: 'en' })
{
  const { injected } = await run({ text: 'CUSTOM-ANCHOR' })
  t('cfg.text 覆盖语言状态', injected?.content?.[0]?.text === 'CUSTOM-ANCHOR')
  const { registered } = await run({ enabled: false })
  t('enabled=false 不注册 handler', registered === false)
  const { injected: def } = await run({})
  t('空 cfg 仍按语言状态注入', def?.content?.[0]?.text === ANCHOR_TEXT.en)
}

console.log('\n[8] 注入形状（session validator 要求 id 必填）')
setState({ thinking: 'zh' })
{
  const { injected, decision } = await run()
  t('注入的消息带 id', typeof injected?.id === 'string' && injected.id.length > 20, JSON.stringify(injected?.id))
  t('role === user', injected?.role === 'user')
  t('source.kind === thinking-anchor', injected?.source?.kind === 'thinking-anchor')
  t('source.sections[0].text === 注入文本', injected?.source?.sections?.[0]?.text === ANCHOR_TEXT.zh)
  t('原消息被保留且顺序不变', decision.messages[0].id === 'u1' && decision.messages.length === 2)
}

console.log('\n[9] 异常路径必须原样放行（绝不能吃掉用户上下文）')
{
  setState({ thinking: 'zh' })
  const { decision } = await run({}, { kind: 'reject', messages: [] })
  t('kind=reject 原样返回', decision?.kind === 'reject')
  const { decision: d2 } = await run({}, { messages: null })
  t('messages 为 null 原样返回', d2?.messages === null)
  const { decision: d3 } = await run({}, {})
  t('无 messages 字段原样返回', d3?.messages === undefined)
}

rmSync(HOME, { recursive: true, force: true })
console.log(`\n=== ${pass} passed, ${fail} failed ===`)
process.exit(fail === 0 ? 0 : 1)
