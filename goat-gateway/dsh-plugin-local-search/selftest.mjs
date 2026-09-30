// selftest.mjs — 离线验证三源合并的 rank / 配额 / 去重 / 并发 / 回退。
// 不碰真实网络：GitHub 走实例 monkeypatch，deepseek 走假 provider 对象，wiki 走本机 http stub。
import http from 'node:http';
import assert from 'node:assert/strict';
import { LocalSearchProvider, mergeSources, DEFAULT_CONFIG } from './index.js';

let passed = 0;
const ok = (name) => { passed += 1; console.log(`  ✓ ${name}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const src = (n, host) => ({ url: `https://${host}.test/${n}`, title: `${host}-${n}` });
const labels = (list) => list.map((s) => s.source).join(',');

console.log('T1 mergeSources：rank 块顺序 + 配额');
{
  const groups = [
    { source: 'wiki', sources: [src(1, 'wiki'), src(2, 'wiki'), src(3, 'wiki'), src(4, 'wiki')] },
    { source: 'github', sources: [1, 2, 3, 4, 5].map((n) => src(n, 'gh')) },
    { source: 'deepseek', sources: [1, 2, 3].map((n) => src(n, 'ds')) },
  ];
  const { sources, dropped } = mergeSources(groups, 8);
  assert.equal(labels(sources), 'github,github,github,deepseek,deepseek,deepseek,wiki,wiki');
  assert.ok(dropped > 0, '超编应被记为 dropped');
  ok('输入的乱序 groups 也按 github > deepseek > wiki 输出，且三源都露面');
}

console.log('T2 mergeSources：跨源同 URL 去重，保留 rank 高的那份');
{
  const dup = { url: 'https://same.test/x', title: 'same' };
  const { sources } = mergeSources(
    [
      { source: 'wiki', sources: [dup, src(2, 'wiki')] },
      { source: 'github', sources: [dup, src(1, 'gh')] },
    ],
    8,
  );
  assert.equal(sources.length, 3);
  assert.equal(sources.filter((s) => s.url === dup.url).length, 1);
  assert.equal(sources.find((s) => s.url === dup.url).source, 'github');
  ok('同 URL 只出现一次，且归属 github');
}

console.log('T3 mergeSources：某源稀缺时剩余名额按 rank 回填');
{
  const groups = [
    { source: 'wiki', sources: [] },
    { source: 'github', sources: [1, 2, 3, 4, 5, 6, 7].map((n) => src(n, 'gh')) },
    { source: 'deepseek', sources: [src(1, 'ds')] },
  ];
  const { sources } = mergeSources(groups, 8);
  assert.equal(labels(sources), 'github,github,github,github,github,github,github,deepseek');
  ok('回填后仍是严格 rank 分块（github 7 条在前，deepseek 1 条在后）');
}

console.log('T4 mergeSources：interleaveSources = true 时按轮次交错');
{
  const groups = [
    { source: 'wiki', sources: [1, 2, 3].map((n) => src(n, 'wiki')) },
    { source: 'github', sources: [1, 2, 3].map((n) => src(n, 'gh')) },
    { source: 'deepseek', sources: [1, 2, 3].map((n) => src(n, 'ds')) },
  ];
  const { sources } = mergeSources(groups, 8, { interleave: true });
  assert.equal(labels(sources), 'github,deepseek,wiki,github,deepseek,wiki,github,deepseek');
  ok('round-robin 交错：每轮 github → deepseek → wiki');
}

// ── 端到端：真的跑 LocalSearchProvider.search()，三个来源全部替换成本地 stub ──────
const TOKEN = 'selftest-token';
process.env.LOCAL_SEARCH_TOKEN = TOKEN;

let wikiHits = 0;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/health') return void res.writeHead(200).end('ok');
  if (url.pathname !== '/search') return void res.writeHead(404).end('');
  if (req.headers['x-local-search-token'] !== TOKEN) return void res.writeHead(401).end('');
  wikiHits += 1;
  setTimeout(() => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, sources: [{ ...src(1, 'wiki'), provider: 'pocketwiki' }, { ...src(2, 'wiki'), provider: 'wikipedia' }] }));
  }, 120);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const config = { ...DEFAULT_CONFIG, aggregatorUrl: `http://127.0.0.1:${server.address().port}`, tokenFile: '' };

const calls = { github: 0, deepseek: 0, fallback: 0 };
const fakeDeepseek = {
  id: 'deepseek-official',
  available: () => true,
  search: async () => { calls.deepseek += 1; await sleep(120); return { sources: [src(1, 'ds'), src(2, 'ds')], truncated: false }; },
};
const fakeMulti = {
  id: 'multi-search',
  available: () => true,
  search: async () => { calls.fallback += 1; return { sources: [src(1, 'multi')], truncated: false }; },
};
const web = { searchProviders: new Map([['deepseek-official', fakeDeepseek], ['multi-search', fakeMulti]]) };
const makeProvider = () => {
  const p = new LocalSearchProvider(() => config, web);
  p.searchGithub = async () => { calls.github += 1; await sleep(120); return [src(1, 'gh'), src(2, 'gh')]; };
  return p;
};

console.log('T5 search()：三路并发、统一合并、都返回');
{
  wikiHits = 0; calls.github = 0; calls.deepseek = 0; calls.fallback = 0;
  const provider = makeProvider();
  assert.equal(provider.available(), true);
  const t0 = Date.now();
  const res = await provider.search({ query: 'concurrent probe', maxResults: 8 });
  const elapsed = Date.now() - t0;
  assert.equal(labels(res.sources.map((s) => ({ ...s, source: s.source }))), 'github,github,deepseek,deepseek,wiki,wiki');
  assert.deepEqual([calls.github, calls.deepseek, wikiHits], [1, 1, 1], '三源各被调用一次');
  assert.ok(elapsed < 260, `三路应并行（实测 ${elapsed}ms，串行会是 360ms）`);
  assert.equal(res.truncated, false);
  ok(`github → deepseek → wiki 顺序统一返回，耗时 ${elapsed}ms（并行）；wiki 结果带 pocketwiki/wikipedia 标记`);
}

console.log('T6 search()：单源抛错不拖累另外两源');
{
  calls.github = 0; calls.deepseek = 0;
  const provider = makeProvider();
  provider.searchGithub = async () => { throw new Error('github boom'); };
  const res = await provider.search({ query: 'partial failure probe', maxResults: 8 });
  assert.equal(labels(res.sources), 'deepseek,deepseek,wiki,wiki');
  ok('github 挂掉后仍返回 deepseek + wiki（allSettled 生效）');
}

console.log('T7 search()：三源全空才回退，且不会把 deepseek 当回退打第二次');
{
  const provider = makeProvider();
  provider.searchGithub = async () => [];
  const emptyDeepseek = { ...fakeDeepseek, search: async () => ({ sources: [], truncated: false }) };
  web.searchProviders.set('deepseek-official', emptyDeepseek);
  config.aggregatorUrl = `http://127.0.0.1:${server.address().port}`;
  provider.searchAggregator = async () => [];
  calls.fallback = 0;
  const res1 = await provider.search({ query: 'empty probe', maxResults: 4 });
  assert.deepEqual(res1.sources.map((s) => s.url), [src(1, 'multi').url]);
  assert.equal(calls.fallback, 1, '全空时回退一次');

  const guarded = { ...config, fallbackProviderId: 'deepseek-official' };
  const p2 = new LocalSearchProvider(() => guarded, web);
  p2.searchGithub = async () => [];
  p2.searchAggregator = async () => [];
  let deepseekSkipHits = 0;
  web.searchProviders.set('deepseek-official', { id: 'deepseek-official', available: () => true, search: async () => { deepseekSkipHits += 1; return { sources: [], truncated: false }; } });
  const res2 = await p2.search({ query: 'guarded probe', maxResults: 4 });
  assert.equal(res2.sources.length, 0);
  assert.equal(deepseekSkipHits, 1, '只作为并发来源被调用一次，不再当回退用');
  ok('空结果回退到 multi-search；fallback 指向 deepseek 时被显式拦住（不白跑 model turn）');
}

console.log('T8 searchDeepseekCached：同一 query 的并发调用只打一次 model turn');
{
  web.searchProviders.set('deepseek-official', fakeDeepseek);
  calls.deepseek = 0;
  const provider = makeProvider();
  provider.searchGithub = async () => [];
  provider.searchAggregator = async () => [];
  const [a, b] = await Promise.all([
    provider.search({ query: 'cache probe', maxResults: 4 }),
    provider.search({ query: 'cache probe', maxResults: 4 }),
  ]);
  assert.equal(calls.deepseek, 1, `重复并发 query 应命中缓存（实际 ${calls.deepseek} 次）`);
  assert.equal(a.sources.length, b.sources.length);
  ok('缓存把重复的 deepseek 调用压成 1 次（省一次 model turn 的钱和延迟）');
}


console.log('T9 search()：deepseek 凭证缺失 → 熔断，不再每搜一次都白发起');
{
  const failing = {
    id: 'deepseek-official',
    available: () => true,
    search: async () => {
      calls.deepseek += 1;
      throw new Error('DeepSeek search has no API key for "DEEPSEEK_API_KEY"; store it through the credentials service (WEB_PROVIDER_CREDENTIAL_MISSING)');
    },
  };
  web.searchProviders.set('deepseek-official', failing);
  calls.deepseek = 0;
  const cfg2 = { ...config, deepseekFailureCooldownMs: 60000 };
  const p3 = new LocalSearchProvider(() => cfg2, web);
  p3.searchGithub = async () => [src(1, 'gh')];
  const r1 = await p3.search({ query: 'cred probe 1', maxResults: 4 });
  const r2 = await p3.search({ query: 'cred probe 2', maxResults: 4 });
  assert.equal(calls.deepseek, 1, `熔断后不应再发起（实际 ${calls.deepseek} 次）`);
  assert.equal(labels(r1.sources), 'github,wiki,wiki');
  assert.equal(labels(r2.sources), 'github,wiki,wiki');
  ok('首次凭证失败 → 熔断 60s；后续搜索不再发起 deepseek，github/wiki 照常返回');
}

server.close();
console.log(`\nselftest: ${passed} 组全部通过`);
