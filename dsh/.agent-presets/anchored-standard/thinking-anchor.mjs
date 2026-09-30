/**
 * thinking-anchor.mjs — 在每一步生成前，把「思考链的语言」钉在上下文的最尾部。
 *
 * 语言从哪来（2026-09-30 合并后）
 *   锚点**不再硬编码中文**：文本按 $DSH_HOME/storages/thinking-language.json 的
 *   `thinking` 字段（'zh' | 'en'）逐 step 现读，缺文件 / 坏 JSON / 越界值一律回落中文。
 *   该文件与 @local/dsh-thinking-language（Settings → 思考语言）共用同一份契约，
 *   所以「强锚点」与「可切换」是同一条链路，不再互相打架：
 *     Settings 切换 → 写状态文件 → 下一步 readLanguage() 换文本 → 无需重启 / 无需新建会话。
 *   于是 clause 5 在 profile patch 里回到中立化措辞（语言由本 directive 指定），
 *   静态文案与运行时开关不会各说各话。
 *
 * 为什么不是只改 persona
 *   2026-09-30 实测：把「思考链用中文」放在 persona / system prompt 里（无论措辞多硬）
 *   都不足以保证服从。单看 ~/.dsh/sessions/**（943 条 session，214 条「正文为中文」的
 *   root session）：
 *     - reasoning 的 CJK 占比（剥离 code / path 后）block 级中位数 0.023，p90 0.123；
 *     - 787 条 block>=4 的 session 里，首块为中文主导的只有 17 条（2.2%）；
 *       首块为英文主导的 770 条，后续每块的中位数永远停在 0.00-0.01 —— 语言一旦定下来就不回摆。
 *   也就是说：指令「在 system prompt 里」这个事实本身不足以保证服从，位置比措辞重要。
 *   （同一实测还发现：旧措辞让 12/12 个 sampled delegated child 用英文推理 ——
 *     child 侧因此在 subagent-language.mjs 里另有独立约束，不依赖本锚点。）
 *
 * 为什么挂在 agent/pre-step 的尾部
 *   在 agent/pre-step waterfall 里往 decision.messages 末尾追加一条消息，它落在
 *   **紧贴生成点**的位置 —— 比 system prompt 更靠近采样。这是本 harness 里能拿到的最强位置
 *   （`prefill` / assistant prefix 在 dsh 里不存在：~/.dsh/profiles/node_modules 全量 grep
 *   `prefill` / `assistantPrefix` 零命中，所以「把第一个 block 的语言变成输入」这条路走不通）。
 *
 * 注入形状（照抄 git-context.mjs / 官方 @deepseek-ai/dsh-time-context）
 *   id 必填：缺它会让 session validator 报 "session event at seq N lacks an identified message"，
 *   整个 session 被判 corrupt。preset 模块只能 import node 内建模块（解析根是 preset 目录、
 *   没有 node_modules），所以消息形状手写，不能用 dsh-llm 的 createUserMessage。
 *
 * 注册位置（重要，别随手挪）
 *   agent/pre-step 的 after-next transform 按**注册顺序的逆序**执行：先注册的是最外层、
 *   最后改写结果。要让本行的消息落在 git-context 的消息**之后**（即真正的最尾部），
 *   本行必须在 agent.cordis.yml / profile patch 里注册在 git-context 之前 ——
 *   当前放在 context-gate 之后、其它行之前。
 *
 * context-gate
 *   本行的 source.kind 已加入 context-gate 的 allowKinds，因此第一轮（unpromoted）也不会被剥掉：
 *   首块的语言正是最需要被影响的那一块（见上面的 2.2%）。
 *
 * 已知风险
 *   每步重复同一段固定文本，模型可能把它当噪声忽略（habituation）。若实测无效，
 *   下一刀是让文本带一点变化（例如当前 step 序号），而不是继续加长。
 */

import { randomUUID } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const name = 'thinking-anchor'
export const inject = []

/**
 * 语言状态契约：与 @local/dsh-thinking-language 的 host 半侧是**同一份文件**。
 * 两套机制合并后的唯一真相源就是它 —— 锚点不再硬编码中文。
 */
const STATE_FILE = 'thinking-language.json'
/** 读不到 / 读坏了时的回落语言（语言契约的历史默认值）。 */
export const DEFAULT_LANGUAGE = 'zh'
/** mtime + size 判定状态是否变过，避免每一步都真读盘。 */
const LANGUAGE_CACHE = { key: undefined, value: DEFAULT_LANGUAGE }

export const dshHome = () => process.env.DSH_HOME ?? join(homedir(), '.dsh')
export const statePath = () => join(dshHome(), 'storages', STATE_FILE)

/** 归一化：只有 'en' 算英文；缺失 / 坏 JSON / 越界值一律回落中文。 */
const normalizeLanguage = (value) => (value === 'en' ? 'en' : DEFAULT_LANGUAGE)

/**
 * 热读当前思考链语言。任何异常都吞掉并回落 DEFAULT_LANGUAGE ——
 * 锚点坏掉绝不能影响会话可用性（这是本文件从头到尾的纪律）。
 */
export function readLanguage() {
  const file = statePath()
  try {
    const st = statSync(file)
    const key = `${st.mtimeMs}:${st.size}`
    if (LANGUAGE_CACHE.key === key) return LANGUAGE_CACHE.value
    const value = normalizeLanguage(JSON.parse(readFileSync(file, 'utf8'))?.thinking)
    LANGUAGE_CACHE.key = key
    LANGUAGE_CACHE.value = value
    return value
  } catch {
    LANGUAGE_CACHE.key = undefined
    LANGUAGE_CACHE.value = DEFAULT_LANGUAGE
    return DEFAULT_LANGUAGE
  }
}

/** 锚点文本按语言各一份。保持极短：它每步都要重发一次。 */
export const ANCHOR_TEXT = {
  zh: [
    '<thinking-language>中文</thinking-language>',
    '思考链（reasoning）用中文写：中文句子 + 英文术语原词（provider / patch / token / cache / session 照抄）。',
    '不要写英文句子，不要把整句英文当内心独白。',
  ].join('\n'),
  en: [
    '<thinking-language>English</thinking-language>',
    'Reason in English: full English sentences, with technical terms kept verbatim.',
    'Do not write Chinese sentences in the thinking chain.',
  ].join('\n'),
}

/** 本步要注入的文本：显式 cfg.text 优先，否则跟随语言状态。 */
const resolveText = (cfg, language) =>
  typeof cfg.text === 'string' && cfg.text !== '' ? cfg.text : ANCHOR_TEXT[language]

export function apply(ctx, config) {
  const cfg = config && typeof config === 'object' ? config : {}
  if (cfg.enabled === false) return

  ctx.on('agent/pre-step', async ({ agent }, next) => {
    const decision = await next()
    try {
      if (decision && decision.kind === 'reject') return decision
      const messages = Array.isArray(decision?.messages) ? decision.messages : null
      if (messages === null) return decision
      // 语言在**每一步**现读：Settings 里切换后，下一条消息的下一个 step 立即换语言，
      // 不需要重启进程、也不需要新建会话。这是把锚点与开关合并的关键。
      const text = resolveText(cfg, readLanguage())
      return {
        ...decision,
        messages: [
          ...messages,
          {
            id: randomUUID(),
            role: 'user',
            content: [{ type: 'text', text }],
            source: { kind: name, form: 'snapshot', sections: [{ name, text }] },
          },
        ],
      }
    } catch {
      // 注入失败绝不能吃掉用户上下文 —— 原样放行
      return decision
    }
  })
}
