/**
 * token-budget — a per-session token budget gate: the dsh-side counterpart of the
 * `usage_limited` / `budget_limited` statuses in Codex's `thread_goals` table.
 *
 * WHY: dsh's goal row carries an objective but no cost ceiling, while Codex models the
 * ceiling as a goal status. The user's own usage log shows one session reaching 490M
 * tokens, so the missing piece is not another metric — it is a gate.
 *
 * SOURCE OF TRUTH: provider-reported samples on `assistant/message` events
 * (`data.usage` = inputTokens / outputTokens / cacheReadTokens), the same samples
 * @deepseek-ai/dsh-token-meter folds into its `tokenUsage` projection. No estimation,
 * no extra LLM calls.
 *
 * BEHAVIOR: usage is accumulated per session; when the effective budget is crossed the
 * plugin injects ONE short next-step note. It never blocks the turn — the model decides
 * how to wrap up, exactly like an `usage_limited` goal that is still allowed to settle.
 */

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'token-budget'

/** The agents service carries the pre-step seam; tools exposes the query tool. */
export const inject = ['agents', 'tools']

/** Persisted budget config; live usage never touches disk. */
const BUDGET_PATH = process.env.DSH_TOKEN_BUDGET ?? join(homedir(), '.dsh', 'storages', 'token-budget.json')

/** Live per-session usage folded from provider-reported samples. */
const usage = new Map()
/** Sessions already warned in this process — one note per session, never a stream. */
const warned = new Set()

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

/** Read the persisted budget config (missing or corrupt reads as empty). */
async function loadBudgets() {
  try {
    const parsed = JSON.parse(await readFile(BUDGET_PATH, 'utf8'))
    if (parsed && typeof parsed === 'object') {
      return { default: parsed.default ?? null, sessions: parsed.sessions ?? {} }
    }
  } catch {
    /* cold start */
  }
  return { default: null, sessions: {} }
}

/** Atomic write of the budget config. */
async function saveBudgets(state) {
  await mkdir(dirname(BUDGET_PATH), { recursive: true })
  const tmp = `${BUDGET_PATH}.tmp-${process.pid}`
  await writeFile(tmp, JSON.stringify(state, null, 1), 'utf8')
  await rename(tmp, BUDGET_PATH)
}

/** Billable-ish spend for a session accumulator (input + output, cache excluded). */
function spentOf(acc) {
  if (!acc) return 0
  return (acc.input ?? 0) + (acc.output ?? 0)
}

/** Session override beats the default budget. */
function effectiveBudget(state, sessionId) {
  return state.sessions?.[sessionId] ?? state.default ?? null
}

/** Compact token rendering for a one-line report. */
function formatTokens(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(Math.round(n))
}

/** Register the budget gate: a usage fold, one crossing note, and a query tool. */
export function apply(ctx) {
  ctx.on('session/event', (session, event) => {
    if (event?.type !== 'assistant/message') return
    const sample = event?.data?.usage
    if (sample === undefined || sample === null) return
    const id = session?.id
    if (typeof id !== 'string' || id.length === 0) return
    const acc = usage.get(id) ?? { input: 0, output: 0, cacheRead: 0, calls: 0, startedAt: Date.now() }
    acc.input += sample.inputTokens ?? 0
    acc.output += sample.outputTokens ?? 0
    acc.cacheRead += sample.cacheReadTokens ?? 0
    acc.calls += 1
    usage.set(id, acc)
  })

  ctx.on('agent/pre-step', async ({ agent }, next) => {
    const decision = await next()
    try {
      const id = agent?.session?.id
      if (typeof id !== 'string' || warned.has(id)) return decision
      if (typeof agent.inject !== 'function') return decision
      const acc = usage.get(id)
      if (acc === undefined) return decision
      const state = await loadBudgets()
      const budget = effectiveBudget(state, id)
      if (budget === null || !(budget.tokens > 0)) return decision
      if (spentOf(acc) < budget.tokens) return decision
      warned.add(id)
      agent.inject({
        id: `token-budget-${id}-${Date.now()}`,
        role: 'user',
        content: [
          {
            type: 'text',
            text: `[token 预算] 本会话已用约 ${formatTokens(spentOf(acc))} tokens（预算 ${formatTokens(budget.tokens)}，${acc.calls} 次调用${budget.note ? '，' + budget.note : ''}）。收尾前请把结论、遗留项与关键路径写清，必要时调 memory_remember 存档。`,
          },
        ],
        source: { kind: 'token-budget' },
      })
    } catch {
      /* a failing gate must never break the turn */
    }
    return decision
  })

  ctx.tools.register({
    name: 'token_budget',
    description:
      '查看或设置 token 预算闸门（对应 Codex goal 的 usage_limited / budget_limited）。status 返回本进程内累计的会话 token 用量与预算余量；set 默认给所有会话设预算，也可用 sessionId 覆盖单会话；clear 清除；list 列出内存中已累计的会话。超预算时会自动向模型注入一次提醒（不阻断）。用量来自 provider 在 assistant/message 上报告的 usage，不额外调用模型',
    parameters: toJsonSchema({
      action: { type: 'string', description: 'status（默认）| set | clear' },
      tokens: { type: 'string', description: 'set 时必填：预算 token 数' },
      sessionId: { type: 'string', description: '可选：只作用于某个会话（set / clear / status 都支持）' },
      note: { type: 'string', description: '可选：预算备注，注入提醒时会带上' },
    }),
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' } }, required: ['text'] },
      render: (_a, v) => [{ type: 'text', text: v.text }],
    },
    async execute(args) {
      const action = String(args.action ?? 'status').trim().toLowerCase()
      const state = await loadBudgets()
      const target = String(args.sessionId ?? '').trim()

      if (action === 'set') {
        const tokens = Number(args.tokens)
        if (!Number.isFinite(tokens) || tokens <= 0) {
          return { text: 'set 需要 tokens 为正数。' }
        }
        const entry = { tokens, note: String(args.note ?? '').trim(), setAt: new Date().toISOString() }
        if (target.length > 0) state.sessions[target] = entry
        else state.default = entry
        await saveBudgets(state)
        return {
          text: `预算已设：${target.length > 0 ? target : 'default（所有会话）'} → ${formatTokens(tokens)} tokens${entry.note ? `（${entry.note}）` : ''}`,
        }
      }

      if (action === 'clear') {
        if (target.length > 0) delete state.sessions[target]
        else {
          state.default = null
          state.sessions = {}
        }
        await saveBudgets(state)
        return { text: `已清除：${target.length > 0 ? target : '全部预算（含各会话覆盖）'}` }
      }

      const ids = target.length > 0 ? [target] : [...usage.keys()]
      const lines = []
      for (const id of ids) {
        const acc = usage.get(id)
        const budget = effectiveBudget(state, id)
        const spent = spentOf(acc)
        const cap = budget !== null && budget.tokens > 0 ? formatTokens(budget.tokens) : '未设'
        const pct = budget !== null && budget.tokens > 0 ? ` (${Math.round((spent / budget.tokens) * 100)}%)` : ''
        const over = budget !== null && budget.tokens > 0 && spent >= budget.tokens ? '  ⚠ 超预算' : ''
        lines.push(
          `${id}  已用 ${formatTokens(spent)}${pct} / 预算 ${cap}  ${acc?.calls ?? 0} calls  cache-read ${formatTokens(acc?.cacheRead ?? 0)}${over}`,
        )
      }
      if (lines.length === 0) {
        const def = state.default ? formatTokens(state.default.tokens) : '未设'
        return {
          text: `本进程还没累计到任何 usage。default 预算 = ${def}，会话级覆盖 ${Object.keys(state.sessions).length} 条。`,
        }
      }
      const def = state.default ? formatTokens(state.default.tokens) : '未设'
      return { text: `default 预算 = ${def}\n${lines.join('\n')}` }
    },
  })
}
