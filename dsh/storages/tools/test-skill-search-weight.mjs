/**
 * Unit-test skill-search.mjs — the usage weight (用户 2026-09-26 的要求) and the keyword
 * filter it rides on. No dsh process, no restart: `apply(ctx)` only registers two Cordis
 * tools, so a fake ctx drives them directly.
 *
 * WHAT THE USER ASKED FOR (原话, 归档于 dsh-skill-usage-weighting-20260926):
 *   「技能的调用权重（积极性）我还想加入这个调用的次数和调用的时间远近两个维度」
 * ⇒ `skill_search` sorts by  match + USAGE_WEIGHT * usage, where usage ∈ [0,1] is built
 *   from loads (log1p, saturating at FREQUENCY_SATURATION_LOADS = 20) and recency
 *   (RECENCY_HALF_LIFE_DAYS = 14), and match = nameHits / wanted.length.
 *
 * PINNED DEFECT (found + fixed 2026-09-28, asserted in cases 6-8):
 *   usageScore was UNBOUNDED — log1p(loads) + exp(-ageDays/14) — while match ∈ [0,1].
 *   Two different dimensions. A never-used skill collected a free 1.0, and one load added
 *   0.6*1.693 = 1.016 — more than the entire match range. Normalizing usage to [0,1] is
 *   exactly what makes USAGE_WEIGHT = 0.6 mean "lifts a peer by at most 0.6".
 *
 * FALSE ALARM, RECORDED ON PURPOSE (2026-09-30):
 *   This test first "failed" because a cold, empty-ledger search for "pdf translate"
 *   returned `pdf-tools` ahead of `pdf-translator`. That was read as a match bug, and the
 *   plugin was rewritten to compare names word-by-word instead of as opaque tokens. An A/B
 *   against the 79 REAL skills in `~/.dsh/skills` × 25 real queries produced **0 differing
 *   rankings** — on real data the rewrite was an identity transform, while making tokens
 *   that span a `-` (e.g. "f-trans") stop matching. It was REVERTED rather than kept as
 *   unearned complexity. The cold ordering is a documented tie-break; case 2 pins it.
 *   Lesson: a tie is not automatically a bug. Measure before rewriting.
 *
 * Run: node ~/.dsh/storages/tools/test-skill-search-weight.mjs
 */
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DIR = await mkdtemp(join(tmpdir(), 'skill-usage-test-'))
const LEDGER = join(DIR, 'skill-usage.json')
process.env.DSH_SKILL_USAGE = LEDGER

const mod = await import('file:///C:/Users/27063/.dsh/.agent-presets/anchored-standard/skill-search.mjs')

let failures = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) failures += 1
}

/** Fixture. For "pdf tools" the NAME of `pdf-tools` hits both words (perfect match) while
 *  `pdf-translator` hits only "pdf" — that gap is what case 3-5 exercise. */
const SKILLS = [
  { name: 'pdf-translator', description: 'Translate PDF files with these tools into bilingual Chinese/English.', content: 'body-t' },
  { name: 'pdf-tools', description: 'Split, merge and translate PDF files from the shell.', content: 'body-p' },
  { name: 'doc-utils', description: 'Convert a PDF and translate the text inside.', content: 'body-d' },
  { name: 'obsidian-notes', description: 'Vault note workflows.', content: 'body-o' },
]

const ctx = {
  logger: { warn() {}, info() {}, error() {} },
  _tools: {},
  tools: { register(def) { ctx._tools[def.name] = def } },
  skills: { list: async () => SKILLS, get: async (n) => SKILLS.find((s) => s.name === n) },
}
mod.apply(ctx)
const search = ctx._tools.skill_search
const load = ctx._tools.skill_load

const writeLedger = (skills) => writeFile(LEDGER, JSON.stringify({ version: 1, skills }, null, 1), 'utf8')
const recent = (loads) => ({ loads, firstUsedAt: Date.now(), lastUsedAt: Date.now() })
const order = (text) => [...text.matchAll(/^- ([a-z0-9-]+)/gm)].map((m) => m[1])

// ── scoring re-derived here, so the test does not merely trust its own module ───────────
const REAL_USAGE = (loads, ageDays = 0) => {
  if (loads <= 0) return 0
  return Math.min(1, 0.6 * Math.min(1, Math.log1p(loads) / Math.log1p(20)) + 0.4 * Math.exp(-ageDays / 14))
}
/** Pre-2026-09-28 unbounded usage — kept only as the counterfactual. */
const OLD_USAGE = (loads, ageDays = 0) => Math.log1p(loads) + Math.exp(-ageDays / 14)
const W = 0.6

// ── case 1: the keyword filter ──────────────────────────────────────────────────────────
await writeLedger({})
const cold = await search.execute({ query: 'pdf translate' }, {})
check('every skill that mentions pdf+translate survives; the unrelated one does not',
  order(cold.text).join(',') === 'pdf-tools,pdf-translator,doc-utils', `-> ${order(cold.text).join(',')}`)
check('cold ledger: nothing carries a usage tag', !/\[\d+x,/.test(cold.text))
const single = await search.execute({ query: 'obsidian' }, {})
check('a query matching one skill returns exactly that one',
  order(single.text).join(',') === 'obsidian-notes', `-> ${order(single.text).join(',')}`)
check('an empty query lists everything instead of erroring',
  order((await search.execute({ query: '' }, {})).text).length === SKILLS.length)

// ── case 2: the cold ordering is a TIE-BREAK, not a ranking bug ─────────────────────────
// All three survive the filter; only `doc-utils` matches no NAME word (match 0), and the
// other two are exactly tied at 0.5, so `localeCompare` decides. Pinned so that a future
// reader does not "fix" it a second time — see the FALSE ALARM note at the top.
check('cold ties fall back to alphabetical order (pdf-tools < pdf-translator)',
  order(cold.text).slice(0, 2).join(',') === 'pdf-tools,pdf-translator')
check('name-only match: doc-utils scores 0 despite matching in its description',
  order(cold.text)[2] === 'doc-utils')

// ── case 3: the promise — a better textual match outranks a worse one ───────────────────
const exact = await search.execute({ query: 'pdf tools' }, {})
check('perfect name match (pdf-tools) outranks partial name match (pdf-translator)',
  order(exact.text).join(',') === 'pdf-tools,pdf-translator', `-> ${order(exact.text).join(',')}`)

// ── case 4: (A) light use must NOT displace a better match ──────────────────────────────
await writeLedger({ 'pdf-translator': recent(1) })
const light = await search.execute({ query: 'pdf tools' }, {})
check('(A) one recent load does not lift a partial match over a perfect one',
  order(light.text)[0] === 'pdf-tools', `-> ${order(light.text).join(',')}`)
check('(A) the usage tag is rendered for the used skill',
  /- pdf-translator \[1x, today\]/.test(light.text))
check('(A) the margin is real, not rounded away',
  0.5 + W * REAL_USAGE(1) < 1.0, `0.5 + 0.6*${REAL_USAGE(1).toFixed(3)} = ${(0.5 + W * REAL_USAGE(1)).toFixed(3)} < 1.0`)

// ── case 5: (A) the exact load count where the OLD formula flipped, and the new one does not
await writeLedger({ 'pdf-translator': recent(2) })
const two = await search.execute({ query: 'pdf tools' }, {})
check('(A) two loads still do not displace the perfect match (end-to-end)',
  order(two.text)[0] === 'pdf-tools', `-> ${order(two.text).join(',')}`)
check('(A) counterfactual: the OLD unbounded formula WOULD have flipped at exactly 2 loads',
  0.5 + W * OLD_USAGE(2) > 1.0 + W * OLD_USAGE(0),
  `old ${(0.5 + W * OLD_USAGE(2)).toFixed(3)} vs ${(1.0 + W * OLD_USAGE(0)).toFixed(3)}`)
check('(A) the fix is what prevents it',
  0.5 + W * REAL_USAGE(2) < 1.0,
  `new ${(0.5 + W * REAL_USAGE(2)).toFixed(3)} vs 1.000`)

// ── case 6: the weight is live — saturation DOES reorder ────────────────────────────────
await writeLedger({ 'pdf-translator': recent(200) })
const sat = await search.execute({ query: 'pdf tools' }, {})
check('saturated usage DOES lift a partial match past a cold perfect one (weight is live)',
  order(sat.text)[0] === 'pdf-translator', `-> ${order(sat.text).join(',')}`)
check('the lift ceiling is USAGE_WEIGHT = 0.6 by construction',
  Math.abs((0.5 + W * REAL_USAGE(200)) - 1.1) < 1e-12,
  `0.5 + 0.6*1.0 = ${(0.5 + W * REAL_USAGE(200)).toFixed(3)} > 1.000`)

// ── case 7: (A) shape of the usage term ─────────────────────────────────────────────────
check('(A) usage saturates at exactly 1.0 at FREQUENCY_SATURATION_LOADS',
  REAL_USAGE(200) === 1 && REAL_USAGE(20) >= 0.99, `usage(20)=${REAL_USAGE(20).toFixed(3)}`)
check('(A) never-used scores exactly 0, while the OLD formula handed out a free 1.0',
  REAL_USAGE(0) === 0 && OLD_USAGE(0) === 1)
check('(A) usage is monotone in loads and decays with age',
  REAL_USAGE(1) < REAL_USAGE(5) && REAL_USAGE(5) < REAL_USAGE(200) && REAL_USAGE(5, 30) < REAL_USAGE(5, 0))
check('(A) loads=1 already exceeded the whole match range before the fix',
  W * OLD_USAGE(1) > 1.0, `0.6*${OLD_USAGE(1).toFixed(3)} = ${(W * OLD_USAGE(1)).toFixed(3)} > 1.0`)

// ── case 8: the ledger is re-read on every call (no stale module-level cache) ───────────
await writeLedger({ 'obsidian-notes': recent(7) })
const notes = await search.execute({ query: 'obsidian' }, {})
check('ledger changes take effect without reloading the module',
  /\[7x, today\]/.test(notes.text), `-> ${notes.text.split('\n')[1]}`)

// ── case 9: skill_load writes the ledger, and degrades gracefully ───────────────────────
const injected = []
const agent = { session: { header: { cwd: 'C:/tmp' } }, inject: (m) => injected.push(m) }
await load.execute({ name: 'pdf-translator' }, { agent })
const after = JSON.parse(await readFile(LEDGER, 'utf8'))
check('skill_load queues the body for the next request',
  injected.length === 1 && injected[0].source?.kind === 'skill-invocation')
check('skill_load records the use in the ledger',
  after.skills['pdf-translator']?.loads === 1 && typeof after.skills['pdf-translator'].lastUsedAt === 'number',
  JSON.stringify(after.skills['pdf-translator']))
check('an unknown skill name is reported, not thrown',
  (await load.execute({ name: 'nope' }, { agent })).text.includes('No skill named'))
check('skill_load without an agent degrades gracefully',
  (await load.execute({ name: 'pdf-tools' }, {})).text.includes('requires an agent'))

// ── case 10: end-to-end against the REAL skill library ──────────────────────────────────
const SKILLS_DIR = 'C:/Users/27063/.dsh/skills'
let entries = []
try {
  entries = await readdir(SKILLS_DIR)
} catch (error) {
  check('real skill library readable', false, String(error.message))
}
const real = []
for (const entry of entries) {
  try {
    // Entries are junctions/symlinks (the dsh<->reasonix mirror) and Dirent.isDirectory()
    // is false for a Windows junction — so just try to read, the only reliable probe.
    // Keep this try/catch INSIDE the loop: a stray FILE in this directory (there is one,
    // reasonix-workspace-mergeback-doctor.md) must skip, not abort the scan at entry 58.
    const md = await readFile(join(SKILLS_DIR, entry, 'SKILL.md'), 'utf8')
    const fm = /---\r?\n([\s\S]*?)\r?\n---/.exec(md)?.[1] ?? ''
    real.push({
      name: /^name:[ \t]*(.+)$/m.exec(fm)?.[1]?.trim() ?? entry,
      description: /^description:[ \t]*(.+)$/m.exec(fm)?.[1]?.trim() ?? '',
      content: 'x',
    })
  } catch { /* not a skill dir */ }
}
check('real library loaded — guards against a vacuous pass on an empty set',
  real.length >= 50, `${real.length} skills`)

const realCtx = {
  logger: { warn() {}, info() {}, error() {} },
  _tools: {},
  tools: { register(def) { realCtx._tools[def.name] = def } },
  skills: { list: async () => real, get: async (n) => real.find((s) => s.name === n) },
}
mod.apply(realCtx)
const realSearch = realCtx._tools.skill_search
const names = new Set(real.map((s) => s.name))
const QUERIES = ['pdf', 'translate', 'game review', 'slide', 'anti aigc', 'code review', 'paper']
const first = {}
for (const q of QUERIES) first[q] = order((await realSearch.execute({ query: q }, {})).text)
const hits = QUERIES.map((q) => first[q].length)
check('real queries hit the library', hits.some((n) => n > 0),
  QUERIES.map((q, i) => `${q}:${hits[i]}`).join(' '))
// KNOWN LIMIT, measured not assumed (2026-09-30). The filter is AND + substring:
//   haystack = tokens(name + description + whenToUse).join(' ') ; haystack.includes(token)
// Across the 79 real skills, NO name/description contains the substring "translate"
// (only "translator" x3 and "translation" x1), and none contains "game". So:
//   * "translate" -> 0 hits is CORRECT behaviour for this filter, not a failure.
//   * the word the library actually uses IS recalled.
// Closing the gap would need stemming (strip -er/-or/-ion/-ing…), which widens recall for
// EVERY query and risks merging distinct words (order/ord, paper/pap). That is a product
// decision, deliberately NOT taken here — recorded so the next reader sees the tradeoff.
check('KNOWN LIMIT: "translate" matches nothing, because no skill text contains that substring',
  first['translate'].length === 0)
check('KNOWN LIMIT: the synonym the library does use is recalled instead',
  order((await realSearch.execute({ query: 'translator' }, {})).text).length === 3,
  order((await realSearch.execute({ query: 'translator' }, {})).text).join(','))
check('KNOWN LIMIT: no skill text contains "game", so "game review" cannot match',
  first['game review'].length === 0)
check('every returned name exists in the real library',
  QUERIES.every((q) => first[q].every((n) => names.has(n))))
check('real results are deterministic across calls',
  (await Promise.all(QUERIES.map(async (q) => order((await realSearch.execute({ query: q }, {})).text))))
    .every((o, i) => o.join() === first[QUERIES[i]].join()))
check('a nonsense query returns none of the library',
  order((await realSearch.execute({ query: 'zzzznotaskill' }, {})).text).length === 0)

await rm(DIR, { recursive: true, force: true })
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
