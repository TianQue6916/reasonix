// goat-gateway selftest —— 不碰生产配置，全部在临时目录里跑。
// 覆盖：正常流、客户端主动中断不切 key、上游 5xx 自动换 key、响应头发出后上游断流不换 key。
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GATEWAY = path.join(HERE, 'gateway.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'goat-gateway-selftest-'));
const configPath = path.join(tmp, 'config.json');
const keysPath = path.join(tmp, 'keys.json');
const statePath = path.join(tmp, 'state.json');
const logDir = path.join(tmp, 'logs');
fs.mkdirSync(logDir, { recursive: true });

const PORT = 18788;
const upstreamState = {
  failKeys: new Set(),   // 对这些 key 返回 500
  hold: false,           // 不回任何流数据，用来测客户端中断
  afterHeadersError: false,
  cloudflare403: false,  // 返回 Cloudflare 1010 风格的 403
};

const upstream = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const key = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (upstreamState.failKeys.has(key)) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: `simulated 500 for ${key}` } }));
      return;
    }
    if (upstreamState.cloudflare403) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('error code: 1010');
      return;
    }
    if (upstreamState.hold) {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      // 故意保持连接且不发任何数据；客户端取消后 gateway 应该收到 client aborted
      return;
    }
    if (upstreamState.afterHeadersError) {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n');
      setTimeout(() => res.destroy(new Error('simulated upstream stream error')), 80);
      return;
    }
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write('data: {"choices":[{"delta":{"content":"ok"}}],"usage":{"prompt_tokens":1,"completion_tokens":1}}\n\n');
    res.write('data: [DONE]\n\n');
    res.end();
  });
});

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitHealth(timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (r.ok) return await r.json();
    } catch {}
    await sleep(100);
  }
  throw new Error('gateway health timeout');
}

async function health() {
  const r = await fetch(`http://127.0.0.1:${PORT}/health`);
  return await r.json();
}

async function ask(signal, system = 'stable system') {
  const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer client-side' },
    body: JSON.stringify({
      model: 'test-model',
      stream: true,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: 'stable first user' },
      ],
    }),
    signal,
  });
  const text = await r.text();
  return { status: r.status, text };
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAIL: ${msg}`);
}

let child;
let childLog = '';

async function main() {
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const upstreamPort = upstream.address().port;

  writeJson(configPath, {
    listen: { host: '127.0.0.1', port: PORT },
    upstream: { origin: `http://127.0.0.1:${upstreamPort}`, basePath: '/provider/v1', localPrefix: '/v1' },
    maxAttemptsPerRequest: 4,
    attemptsPerKey: 2,
    retryDelayMs: 50,
    retryableStatus: [401, 402, 403, 408, 429, 500, 502, 503, 504],
    cooldownMs: { unauthorized: 1800000, quota: 600000, rateLimit: 60000, server: 15000, network: 20000 },
    maxBodyBytes: 64 * 1024 * 1024,
    bodyTimeoutMs: 1000,
    maxSessions: 2000,
    upstreamTimeoutMs: 30000,
    logKeepDays: 30,
    strategy: 'sticky',
  });
  writeJson(keysPath, {
    keys: [
      { name: 'A', key: 'key-A', enabled: true },
      { name: 'B', key: 'key-B', enabled: true },
    ],
  });
  writeJson(statePath, {
    rr: 0,
    sticky: 'A',
    sessions: {},
    keys: {},
    stats: { requests: 0, forwarded: 0, retries: 0, switched: 0, since: new Date().toISOString() },
  });
  const originalConfigText = fs.readFileSync(configPath, 'utf8');
  const originalKeysText = fs.readFileSync(keysPath, 'utf8');

  child = spawn(process.execPath, [GATEWAY], {
    env: {
      ...process.env,
      GATEWAY_CONFIG: configPath,
      GATEWAY_KEYS: keysPath,
      GATEWAY_STATE: statePath,
      GATEWAY_LOG_DIR: logDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => { childLog += d.toString(); });
  child.stderr.on('data', (d) => { childLog += d.toString(); });

  await waitHealth();

  // 1) 正常流
  upstreamState.failKeys.clear();
  upstreamState.hold = false;
  upstreamState.afterHeadersError = false;
  let r1 = await ask();
  assert(r1.status === 200, `normal request status=${r1.status}`);
  assert(r1.text.includes('ok'), 'normal request body should contain ok');
  let h = await health();
  assert(h.keys.find((k) => k.name === 'A').fail === 0, 'normal request should not fail A');
  console.log('PASS normal stream');

  // 2) 客户端主动中断：不应冷却 A、不应切到 B
  upstreamState.hold = true;
  const ctl = new AbortController();
  const p = ask(ctl.signal).catch(() => null);
  await sleep(150);
  ctl.abort();
  await p;
  await sleep(500); // 等 gateway 处理 close
  h = await health();
  const a = h.keys.find((k) => k.name === 'A');
  assert(a.fail === 0, `client abort should not fail A, got fail=${a.fail}`);
  assert(a.cooldownMsLeft === 0, `client abort should not cooldown A, got ${a.cooldownMsLeft}ms`);
  assert((h.stickyKey || '') === 'A', `client abort should not switch sticky key, got ${h.stickyKey}`);
  assert(childLog.includes('CLIENT-ABORT'), 'gateway log should contain CLIENT-ABORT');
  assert(!childLog.includes('COOLDOWN key=A'), 'gateway log should not contain COOLDOWN key=A after client abort');
  console.log('PASS client abort no switch');

  // 3) 上游 5xx：应冷却 A 并切到 B
  upstreamState.hold = false;
  upstreamState.failKeys = new Set(['key-A']);
  const r3 = await ask();
  assert(r3.status === 200, `failover request status=${r3.status}`);
  assert(r3.text.includes('ok'), 'failover request body should contain ok');
  h = await health();
  const a3 = h.keys.find((k) => k.name === 'A');
  const b3 = h.keys.find((k) => k.name === 'B');
  assert(a3.fail >= 1, `A should have fail>=1, got ${a3.fail}`);
  assert(a3.cooldownMsLeft > 0, `A should be cooling, got ${a3.cooldownMsLeft}ms`);
  assert(b3.ok >= 1, `B should have ok>=1, got ${b3.ok}`);
  assert((h.stickyKey || '') === 'B', `sticky key should switch to B, got ${h.stickyKey}`);
  console.log('PASS upstream 5xx failover');

  // 4) 响应头已发出后上游断流：不应冷却、不应换 key
  //    注意：上一阶段已经 sticky 切到 B，当前 key 可能是 B；按当前 sticky key 校验。
  const before = await health();
  const currentKey = before.stickyKey || 'A';
  const beforeK = before.keys.find((k) => k.name === currentKey);
  upstreamState.failKeys.clear();
  upstreamState.hold = false;
  upstreamState.afterHeadersError = true;
  let r4 = null;
  try { r4 = await ask(); } catch (e) { r4 = { status: 0, text: String(e) }; }
  await sleep(300);
  h = await health();
  const afterK = h.keys.find((k) => k.name === currentKey);
  assert(afterK.fail === beforeK.fail, `after-header stream error should not fail ${currentKey} (before=${beforeK.fail}, after=${afterK.fail})`);
  assert(afterK.cooldownMsLeft === 0, `after-header stream error should not cooldown ${currentKey}, got ${afterK.cooldownMsLeft}ms`);
  assert((h.stickyKey || '') === currentKey, `after-header stream error should not switch key, got ${h.stickyKey}`);
  console.log('PASS after-header stream error no switch');

  console.log('\nALL TESTS PASSED');
  // 5) Cloudflare 1010 403：应是短网络冷却，不是 30 分钟 unauthorized
  await fetch(`http://127.0.0.1:${PORT}/_gateway/reset`);
  upstreamState.afterHeadersError = false;
  upstreamState.cloudflare403 = true;
  const r5 = await ask().catch((e) => ({ status: 0, text: String(e) }));
  assert([403, 503].includes(r5.status), `cloudflare 1010 should return 403/503, got ${r5.status}`);
  await sleep(200);
  h = await health();
  for (const k of h.keys) {
    assert(k.cooldownMsLeft > 0, `key ${k.name} should be cooling after cloudflare block`);
    assert(k.cooldownMsLeft <= 25000, `cloudflare 1010 should use short network cooldown, got ${k.name}=${k.cooldownMsLeft}ms`);
    assert(k.cooldownMsLeft !== 1800000, `cloudflare 1010 must not be treated as 30min unauthorized`);
  }
  await fetch(`http://127.0.0.1:${PORT}/_gateway/reset`);
  upstreamState.cloudflare403 = false;
  console.log('PASS cloudflare 1010 short cooldown');

  // 6) body timeout：只发一半 body，gateway 应返回 408，而不是挂住
  const r6 = await new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: PORT, method: 'POST', path: '/v1/chat/completions',
      headers: { 'content-type': 'application/json', 'content-length': '10', authorization: 'Bearer client-side' },
    }, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write('{'); // content-length says 10, only 1 byte sent -> body timeout
  });
  assert(r6.status === 408, `half-body should return 408, got ${r6.status} ${r6.data}`);
  console.log('PASS body timeout 408');

  // 7) config.json 写坏后 reload：保留旧配置，不把网关打回默认/错误端口
  fs.writeFileSync(configPath, '{ this is not valid json', 'utf8');
  const reloadBadConfig = await fetch(`http://127.0.0.1:${PORT}/_gateway/reload`);
  assert(reloadBadConfig.ok, 'reload with bad config should still return ok (fallback old CFG)');
  const healthAfterBadConfig = await health();
  assert(String(healthAfterBadConfig.strategy).includes('session') || String(healthAfterBadConfig.strategy).includes('sticky'), 'bad config should preserve old strategy');
  assert(healthAfterBadConfig.keys.length === 2, 'bad config should preserve keys');
  fs.writeFileSync(configPath, originalConfigText, 'utf8');
  await fetch(`http://127.0.0.1:${PORT}/_gateway/reload`);
  console.log('PASS config reload bad-json fallback');

  // 8) keys.json 写坏后 reload：保留上一版 keys
  fs.writeFileSync(keysPath, '{ this is not valid json', 'utf8');
  await fetch(`http://127.0.0.1:${PORT}/_gateway/reload`);
  const healthAfterBadKeys = await health();
  assert(healthAfterBadKeys.keys.length === 2, 'bad keys.json should preserve previous keys');
  fs.writeFileSync(keysPath, originalKeysText, 'utf8');
  await fetch(`http://127.0.0.1:${PORT}/_gateway/reload`);
  console.log('PASS keys reload bad-json fallback');

  // 9) session 模式下：system prompt 变化不应改变 session 指纹，服务器不应因此重新分配 key
  const cfg9 = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  cfg9.strategy = 'session';
  fs.writeFileSync(configPath, JSON.stringify(cfg9, null, 2), 'utf8');
  await fetch(`http://127.0.0.1:${PORT}/_gateway/reload`);
  upstreamState.afterHeadersError = false;
  upstreamState.cloudflare403 = false;
  const r9a = await ask(undefined, 'dynamic system alpha');
  const r9b = await ask(undefined, 'dynamic system beta');
  assert(r9a.status === 200 && r9b.status === 200, `session requests should succeed, got ${r9a.status}/${r9b.status}`);
  const sessions9 = await (await fetch(`http://127.0.0.1:${PORT}/_gateway/sessions`)).json();
  assert(sessions9.total === 1, `same first-user should keep one session fingerprint, got ${sessions9.total}`);
  console.log('PASS session fingerprint stable across system changes');
  fs.writeFileSync(configPath, originalConfigText, 'utf8');
  await fetch(`http://127.0.0.1:${PORT}/_gateway/reload`);

  // 10) 客户端带 x-reasonix-session-id 时：既不能崩，也要真正走 header 指纹
  //     历史 bug：header 形态指纹是 "h:<16hex>"，selectKey 里 parseInt(fp.slice(0,8),16) 得到 NaN，
  //     balanced[NaN] === undefined，随后读 .name 抛异常 → 整个请求 500。
  const cfg10 = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  cfg10.strategy = 'session';
  fs.writeFileSync(configPath, JSON.stringify(cfg10, null, 2), 'utf8');
  await fetch(`http://127.0.0.1:${PORT}/_gateway/reload`);
  const askWithSessionHeader = async (sid) => {
    const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer client-side',
        'x-reasonix-session-id': sid,
      },
      body: JSON.stringify({
        model: 'test-model',
        stream: true,
        messages: [{ role: 'user', content: 'header session probe' }],
      }),
    });
    await r.text();
    return r.status;
  };
  const h1 = await askWithSessionHeader('desktop-session-abc');
  const h2 = await askWithSessionHeader('desktop-session-abc');
  assert(h1 === 200 && h2 === 200, `x-reasonix-session-id requests should be 200, got ${h1}/${h2}`);
  const sessions10 = await (await fetch(`http://127.0.0.1:${PORT}/_gateway/sessions`)).json();
  assert(
    sessions10.recent.some((x) => String(x.session).startsWith('h:')),
    `header-based fingerprint should be registered as an h:... session, got ${JSON.stringify(sessions10.recent)}`,
  );
  console.log('PASS x-reasonix-session-id header fingerprint (no crash, header wins)');
  fs.writeFileSync(configPath, originalConfigText, 'utf8');
  await fetch(`http://127.0.0.1:${PORT}/_gateway/reload`);


  // 11) 并发正常请求
  const many = await Promise.all(Array.from({ length: 20 }, () => ask()));
  assert(many.every((r) => r.status === 200), '20 concurrent normal requests should all be 200');
  console.log('PASS 20 concurrent requests');

  console.log('logs tail:');
  console.log(childLog.split('\n').slice(-20).join('\n'));
}

main()
  .catch((e) => {
    console.error('\nTEST FAILED:', e.message);
    if (childLog) console.error('\n--- gateway log ---\n' + childLog);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { if (child) child.kill(); } catch {}
    await new Promise((r) => upstream.close(r));
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  });
