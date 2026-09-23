// gateway.mjs — Command Code GOAT 多 key 网关
//
// 作用：在 127.0.0.1 上暴露一个 OpenAI 兼容入口，把请求转发到 api.commandcode.ai，
//      并在多个 GOAT 套餐 key 之间「轮询均衡 + 故障自动跳过」。
//      对 reasonix / dsh 完全透明：它们只看到 baseURL 变成本机地址，key 由网关代换。
//
// 退出码：0 正常退出，2 配置/启动失败。

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const p = (...a) => path.join(ROOT, ...a);

// 允许用环境变量隔离实例（方便 selftest，不影响生产默认路径）
const CONFIG_PATH = process.env.GATEWAY_CONFIG || p('config.json');
const KEYS_PATH = process.env.GATEWAY_KEYS || p('keys.json');
const STATE_FILE = process.env.GATEWAY_STATE || p('state.json');
const LOG_DIR = process.env.GATEWAY_LOG_DIR || p('logs');

const DEFAULTS = {
  listen: { host: '127.0.0.1', port: 8788 },
  upstream: {
    origin: 'https://api.commandcode.ai',
    basePath: '/provider/v1',
    localPrefix: '/v1',
    // 统一上游 User-Agent：不再原样透传客户端指纹。
    // 原因：reasonix(Go-http-client) 与 dsh(undici) 头不同，Cloudflare 对它们的风控命中率不同，
    // 会出现「同一个 key，一个客户端 200、另一个 1010」。置空字符串 = 保持透传。
    userAgent: 'commandcode-goat-gateway/1.0',
    // 这些客户端自定义头只在本地用于「会话粘 key」，对上游没有意义，还会多一个指纹。
    stripClientHeaders: ['x-reasonix-', 'x-session-id', 'x-conversation-id', 'x-topic-id'],
  },
  maxAttemptsPerRequest: 4,
  attemptsPerKey: 1,
  retryDelayMs: 250,
  retryableStatus: [401, 402, 403, 408, 429, 500, 502, 503, 504],
  // 冷却时长（毫秒）：额度/鉴权类失败冷却久一点，瞬时错误冷却短
  cooldownMs: {
    unauthorized: 1800000, // 401/403 —— key 无效或无权限，30 分钟
    quota: 600000,         // 402 —— 额度/欠费，10 分钟
    rateLimit: 60000,      // 429 —— 限流，1 分钟
    server: 15000,         // 5xx —— 上游故障，15 秒
    network: 20000,        // 网络异常，20 秒
  },
  maxBodyBytes: 64 * 1024 * 1024,
  bodyTimeoutMs: 120000,
  maxSessions: 2000,
  upstreamTimeoutMs: 900000,
  logKeepDays: 30,
};

// ── 配置与 key 池（reload 时可重读；keys.json 支持 mtime 热重载）──────────
function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

let CFG = null;

function loadConfig() {
  let rawCfg;
  try {
    rawCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    if (CFG) {
      log(`CONFIG-WARN 读取/解析失败，保留上一版配置：${e.message}`);
      return CFG;
    }
    rawCfg = {};
  }
  return {
    ...DEFAULTS,
    ...rawCfg,
    listen: { ...DEFAULTS.listen, ...(rawCfg.listen || {}) },
    upstream: { ...DEFAULTS.upstream, ...(rawCfg.upstream || {}) },
    cooldownMs: { ...DEFAULTS.cooldownMs, ...(rawCfg.cooldownMs || {}) },
  };
}

CFG = loadConfig();
let upOrigin = new URL(CFG.upstream.origin);
let agent = makeAgent();

function makeAgent() {
  const lib = upOrigin.protocol === 'http:' ? http : https;
  return new lib.Agent({ keepAlive: true, maxSockets: 128, timeout: 60000 });
}

function getTransport() {
  return upOrigin.protocol === 'http:' ? http : https;
}

function reloadRuntimeConfig() {
  const oldPort = CFG.listen.port;
  CFG = loadConfig();
  upOrigin = new URL(CFG.upstream.origin);
  agent = makeAgent();
  if (CFG.listen.port !== oldPort) {
    log(`WARN config reload: listen.port 从 ${oldPort} 变成 ${CFG.listen.port}；端口需要重启进程才会生效`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let keysCache = { mtime: 0, keys: [] };
function loadKeys() {
  let st;
  try {
    st = fs.statSync(KEYS_PATH);
  } catch {
    return keysCache.keys;
  }
  if (st.mtimeMs === keysCache.mtime) return keysCache.keys;
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(KEYS_PATH, 'utf8'));
  } catch (e) {
    log(`KEYS-WARN 读取/解析失败，保留上一版 keys：${e.message}`);
    return keysCache.keys;
  }
  if (!raw || !Array.isArray(raw.keys)) {
    log('KEYS-WARN keys.json 结构非法，保留上一版 keys');
    return keysCache.keys;
  }
  const keys = (raw.keys || [])
    .filter((k) => k && typeof k.key === 'string' && k.key.trim().length > 0)
    .map((k) => ({
      name: k.name || k.key.slice(0, 12),
      key: k.key.trim(),
      enabled: k.enabled !== false,
      note: k.note || '',
    }));
  keysCache = { mtime: st.mtimeMs, keys };
  return keys;
}

// ── 运行时状态（冷却、轮询指针、计数）─────────────────────────────────────
const state = readJSON(STATE_FILE, null) || {
  rr: 0,
  sticky: '',
  sessions: {},
  keys: {},
  stats: { requests: 0, forwarded: 0, retries: 0, switched: 0, since: new Date().toISOString() },
};
state.stats ||= { requests: 0, forwarded: 0, retries: 0, switched: 0, since: new Date().toISOString() };
state.keys ||= {};
state.sticky ||= '';
state.sessions ||= {};

let stateDirty = false;
let stateSaving = false;
function saveState() {
  if (!stateDirty || stateSaving) return;
  stateSaving = true;
  const tmp = `${STATE_FILE}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    try {
      fs.renameSync(tmp, STATE_FILE);
    } catch (e) {
      // Windows 某些文件系统上 rename 覆盖可能失败，退回 copy+unlink。
      fs.copyFileSync(tmp, STATE_FILE);
      try { fs.unlinkSync(tmp); } catch {}
    }
    stateDirty = false;
  } catch (e) {
    stateDirty = true;
    log(`WARN 状态写入失败: ${e.message}`);
    try { fs.unlinkSync(tmp); } catch {}
  } finally {
    stateSaving = false;
  }
}
setInterval(saveState, 2000).unref();

function kstate(name) {
  state.keys[name] ||= { ok: 0, fail: 0, cooldownUntil: 0, lastStatus: 0, lastError: '', lastUsedAt: '' };
  return state.keys[name];
}
function isCooling(name) {
  return kstate(name).cooldownUntil > Date.now();
}
function isCloudflareBlock(detail) {
  // Cloudflare 的 1010 是“浏览器/客户端指纹被拦”，不是 key 失效；
  // 用 30 分钟 unauthorized 冷却会把两个账号都误伤，所以单独识别。
  return /error code:\s*1010|cloudflare|cf-ray|attention required/i.test(String(detail || ''));
}
function cooldownReason(status, detail = '') {
  if (isCloudflareBlock(detail)) return ['network', CFG.cooldownMs.network];
  if (status === 401 || status === 403) return ['unauthorized', CFG.cooldownMs.unauthorized];
  if (status === 402) return ['quota', CFG.cooldownMs.quota];
  if (status === 429) return ['rateLimit', CFG.cooldownMs.rateLimit];
  if (status >= 500) return ['server', CFG.cooldownMs.server];
  return ['network', CFG.cooldownMs.network];
}
function applyCooldown(name, status, detail) {
  const [reason, ms] = cooldownReason(status, detail);
  const ks = kstate(name);
  ks.fail += 1;
  ks.lastStatus = status;
  ks.lastError = String(detail || '').slice(0, 300);
  ks.cooldownUntil = Date.now() + ms;
  ks.cooldownReason = reason;
  stateDirty = true;
  log(`COOLDOWN key=${name} reason=${reason} status=${status} for=${Math.round(ms / 1000)}s :: ${ks.lastError}`);
}
function clearCooldown(name) {
  const ks = kstate(name);
  ks.cooldownUntil = 0;
  ks.cooldownReason = '';
  ks.ok += 1;
  ks.lastUsedAt = new Date().toISOString();
  stateDirty = true;
}

// 轮询（仅 strategy=round-robin 时用）：在「已启用且未冷却」的 key 里按顺序取下一个
function pickKey(pool) {
  const n = pool.length;
  if (!n) return null;
  state.rr = (state.rr + 1) % 1000000;
  return pool[state.rr % n];
}

// ── 会话指纹：按会话粘 key 判定的「身份」──────────────────────────────────
//
// 优先使用 x-reasonix-session-id / x-session-id 等 session header；
// 没有 header 时用第一条 user message 做稳定指纹，最后才退回前两条消息。
// 无 messages 的请求（如 GET /v1/models）返回空串，走全局粘滞分支。
function sessionFingerprint(parsed, headers = {}) {
  for (const name of ['x-reasonix-session-id', 'x-session-id', 'x-conversation-id', 'x-topic-id']) {
    const v = headers[name];
    if (typeof v === 'string' && v.trim()) {
      return 'h:' + crypto.createHash('sha1').update(v.trim()).digest('hex').slice(0, 16);
    }
  }
  if (!parsed || !Array.isArray(parsed.messages) || !parsed.messages.length) return '';
  try {
    const firstUser = parsed.messages.find((m) => m && m.role === 'user');
    const basis = firstUser ? [firstUser] : parsed.messages.slice(0, 2);
    const head = basis.map((m) => {
      const c = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '');
      return `${m.role || '?'}|${c}`;
    });
    return crypto.createHash('sha1').update(head.join('\u0000')).digest('hex').slice(0, 16);
  } catch {
    return '';
  }
}

// sessions 表只用于「记住某会话绑在哪个 key」，超过上限按最久未用淘汰
function pruneSessions() {
  const names = Object.keys(state.sessions);
  if (names.length <= CFG.maxSessions) return;
  names.sort((a, b) => (state.sessions[a].t || 0) - (state.sessions[b].t || 0));
  for (const n of names.slice(0, names.length - CFG.maxSessions)) delete state.sessions[n];
}

// 选 key（默认 strategy=session）
//
// 为什么不做轮询：上游 prompt cache（KV cache）按账号隔离，同一段对话前缀交替打到两个账号，
// 两边缓存都被打断，换 key 的那个请求输入几乎全按未命中计费 —— 本套餐命中 ¥0.02019/M
// vs 未命中 ¥1.0095/M（差 ~50 倍）。三种策略：
//   session（默认）同一会话永远粘同一个 key（保缓存），不同会话按指纹分散（用上双账号并发）
//   sticky         全局只粘一个 key，只在其失败时换（最保守）
//   round-robin    交替使用（仅调试，会打断缓存、显著抬高成本）
// 会话指纹可能是 16 位十六进制（消息指纹），也可能是 "h:<16hex>"（客户端 session header）。
// 早期直接 parseInt(fp.slice(0,8),16)：header 形态会得到 NaN，balanced[NaN] === undefined，
// 随后读 .name 抛异常 → 整个请求 500。这里统一转成稳定整数。
function fingerprintBucket(fp, n) {
  const v = String(fp);
  const hex = v.startsWith('h:') ? v.slice(2) : v;
  let num = parseInt(hex.slice(0, 8), 16);
  if (!Number.isFinite(num)) {
    num = parseInt(crypto.createHash('sha1').update(v).digest('hex').slice(0, 8), 16);
  }
  return (Number.isFinite(num) ? num : 0) % n;
}

function selectKey(candidates, fp) {
  const strategy = String(CFG.strategy || 'session').toLowerCase();

  if (strategy === 'round-robin') return pickKey(candidates.filter((k) => !isCooling(k.name)));

  if (strategy === 'session' && fp) {
    const bound = state.sessions[fp];
    if (bound) {
      const held = candidates.find((k) => k.name === bound.key);
      if (held && !isCooling(held.name)) {
        bound.t = Date.now(); // 只用于 LRU 淘汰，不标脏（免得每 2 秒重写 state.json）
        return held;
      }
    }
    const fresh = candidates.filter((k) => !isCooling(k.name));
    if (!fresh.length) return null;
    // 首次见到该会话，或它原来绑定的 key 已不可用（冷却/被本轮试过）→ 重新分配并改写绑定。
    // 分配规则：优先落到「当前绑定会话最少」的 key，让双账号的并发尽量均衡；并列时按指纹决定，
    // 保证同样状态下结果确定。一旦切走就不再切回 —— 该会话在新 key 上继续，原 key 的缓存对它已无价值。
    const load = {};
    for (const k of fresh) load[k.name] = 0;
    for (const v of Object.values(state.sessions)) {
      if (v.key in load) load[v.key] += 1;
    }
    const minLoad = Math.min(...fresh.map((k) => load[k.name]));
    const balanced = fresh.filter((k) => load[k.name] === minLoad);
    const pick = balanced[fingerprintBucket(fp, balanced.length)];
    const prev = state.sessions[fp];
    if (!prev || prev.key !== pick.name) {
      log(
        `SESSION-BIND ${fp.startsWith('h:') ? fp.slice(0, 9) : fp.slice(0, 8)} ${prev ? prev.key + ' -> ' : ''}${pick.name}` +
          ` (sessions per key: ${fresh.map((k) => `${k.name}=${load[k.name]}`).join(' ')})`,
      );
    }
    state.sessions[fp] = { key: pick.name, t: Date.now(), hits: (prev?.hits || 0) + 1 };
    stateDirty = true;
    pruneSessions();
    return pick;
  }

  // 无会话指纹，或 strategy=sticky：退化为全局粘滞
  const held = state.sticky ? candidates.find((k) => k.name === state.sticky) : null;
  if (held && !isCooling(held.name)) return held;

  const fresh = candidates.filter((k) => !isCooling(k.name));
  if (!fresh.length) return null;
  const next = fresh[0];
  if (next.name !== state.sticky) {
    log(`STICKY-SWITCH ${state.sticky || '(none)'} -> ${next.name}`);
    state.sticky = next.name;
    stateDirty = true;
  }
  return next;
}

// ── 日志 ────────────────────────────────────────────────────────────────
fs.mkdirSync(LOG_DIR, { recursive: true });
function log(line) {
  const ts = new Date().toISOString();
  const text = `${ts} ${line}\n`;
  process.stdout.write(text);
  try {
    const day = ts.slice(0, 10);
    fs.appendFileSync(path.join(LOG_DIR, `gateway-${day}.log`), text);
  } catch {}
}
function pruneLogs() {
  try {
    const cut = Date.now() - CFG.logKeepDays * 86400000;
    for (const f of fs.readdirSync(LOG_DIR)) {
      const full = path.join(LOG_DIR, f);
      if (fs.statSync(full).mtimeMs < cut) fs.unlinkSync(full);
    }
  } catch {}
}

// ── hop-by-hop 头处理 ───────────────────────────────────────────────────
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);
function stripHopByHop(headers) {
  for (const k of Object.keys(headers)) {
    if (HOP_BY_HOP.has(k.toLowerCase())) delete headers[k];
  }
  return headers;
}

// ── 路径映射：本地 /v1/xxx  →  上游 /provider/v1/xxx ─────────────────────
function mapPath(url) {
  const u = new URL(url, 'http://localhost');
  let pathname = u.pathname;
  const { localPrefix, basePath } = CFG.upstream;
  if (localPrefix && pathname.startsWith(localPrefix)) pathname = pathname.slice(localPrefix.length);
  if (!pathname.startsWith('/')) pathname = '/' + pathname;
  // 只规范化拼接处，别碰 query —— 否则 ?a=x//y 这类参数会被破坏
  return basePath.replace(/\/+$/, '') + pathname + u.search;
}

// ── 单次上游转发；成功即 pipe 给客户端并返回 {ok:true} ─────────────────────
function forward(clientReq, clientRes, keyEntry, body, meta) {
  return new Promise((resolve) => {
    let clientGone = false;
    let responseStarted = false;
    const target = mapPath(clientReq.url);
    const headers = stripHopByHop({ ...clientReq.headers });
    delete headers.host;
    delete headers.authorization;
    delete headers['content-length'];
    // 客户端自定义会话头只在本地选 key 用；转发给上游毫无用处，只会多一个可被风控的指纹
    for (const prefix of CFG.upstream.stripClientHeaders || []) {
      const pre = String(prefix).toLowerCase();
      for (const k of Object.keys(headers)) {
        if (k.toLowerCase().startsWith(pre)) delete headers[k];
      }
    }
    // 统一 User-Agent（可配置；空字符串表示继续透传客户端原值）
    if (CFG.upstream.userAgent) headers['user-agent'] = String(CFG.upstream.userAgent);
    // 客户端请求已被 Node 解 chunk；转发时重新按 Buffer 设置 content-length，避免带上原始 chunked 头。
    headers.authorization = `Bearer ${keyEntry.key}`;
    if (body && body.length) headers['content-length'] = String(body.length);
    else if (clientReq.method === 'POST') headers['content-length'] = '0';

    const reqId = clientReq._reqId;
    const model = meta.model;
    const isStream = meta.stream;
    const sess = meta.fp ? meta.fp.slice(0, 8) : '-';

    const upReq = getTransport().request(
      {
        protocol: upOrigin.protocol,
        hostname: upOrigin.hostname,
        port: upOrigin.port || 443,
        path: target,
        method: clientReq.method,
        headers,
        agent,
      },
      (upRes) => {
        const status = upRes.statusCode || 0;
        const elapsed = () => Date.now() - upReq._startTs;

        if (CFG.retryableStatus.includes(status)) {
          // 失败响应：读一小段用于日志/诊断，绝不发给客户端 —— 这样客户端还没收到任何字节，
          // 换 key 重试对它是完全透明的。
          let done = false;
          const finish = (result) => {
            if (done) return;
            done = true;
            resolve(result);
          };
          const chunks = [];
          let len = 0;
          upRes.on('data', (c) => {
            if (len < 8192) {
              chunks.push(c);
              len += c.length;
            }
          });
          upRes.on('aborted', () => {
            finish({ ok: false, status: 0, body: 'upstream aborted before body end', clientGone });
          });
          upRes.on('error', (e) => {
            finish({
              ok: false,
              status: 0,
              body: `${e.code || 'ERROR'}: ${e.message}`,
              clientGone,
            });
          });
          upRes.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            log(
              `FAIL id=${reqId} ${clientReq.method} ${target} key=${keyEntry.name} status=${status} ${elapsed()}ms` +
                ` sess=${sess} model=${model} stream=${isStream}` +
                (isCloudflareBlock(text) ? ' cloudflare=1010' : '') +
                ` ua=${JSON.stringify(String(headers['user-agent'] || ''))} body=${JSON.stringify(text.slice(0, 400))}`,
            );
            finish({ ok: false, status, body: text, clientGone });
          });
          return;
        }

        // 正常响应（含 SSE 流）：原样透传；同时轻量 tail 一下以提取 usage
        const outHeaders = stripHopByHop({ ...upRes.headers });
        try {
          clientRes.writeHead(status, outHeaders);
          responseStarted = true;
        } catch (e) {
          upRes.destroy();
          resolve({ ok: false, status: 0, body: `writeHead failed: ${e.message}`, clientGone: true });
          return;
        }
        let tail = '';
        let streamDone = false;
        const finishStream = (result) => {
          if (streamDone) return;
          streamDone = true;
          resolve(result);
        };
        upRes.on('data', (c) => {
          if (tail.length < 65536) tail += c.toString('utf8');
        });
        upRes.pipe(clientRes);
        upRes.on('end', () => {
          if (streamDone) return;
          let usage = '';
          const m = tail.match(/"usage"\s*:\s*\{[^}]*\}/g);
          if (m && m.length) usage = m[m.length - 1].replace(/\s+/g, '');
          log(
            `OK id=${reqId} ${clientReq.method} ${target} key=${keyEntry.name} status=${status} ${elapsed()}ms` +
              ` sess=${sess} model=${model} stream=${isStream} ua=${JSON.stringify(String(headers['user-agent'] || ''))}` +
              `${usage ? ' usage=' + usage : ''}`,
          );
          finishStream({ ok: true, status, usage });
        });
        const endClientOnUpstreamFailure = () => {
          if (!clientGone && responseStarted && !clientRes.writableEnded) {
            try { clientRes.destroy(); } catch {}
          }
        };
        upRes.on('aborted', () => {
          if (streamDone || clientGone) return;
          log(`STREAM-ERR id=${reqId} key=${keyEntry.name} upstream aborted`);
          endClientOnUpstreamFailure();
          finishStream({ ok: true, status, streamError: 'upstream aborted' });
        });
        upRes.on('error', (e) => {
          if (streamDone) return;
          if (clientGone) {
            log(`CLIENT-ABORT id=${reqId} key=${keyEntry.name} stream`);
            finishStream({ ok: false, status: 0, body: 'client aborted', clientGone: true });
            return;
          }
          log(`STREAM-ERR id=${reqId} key=${keyEntry.name} ${e.message}`);
          endClientOnUpstreamFailure();
          finishStream({ ok: true, status, streamError: e.message });
        });
      },
    );

    upReq._startTs = Date.now();
    upReq.setTimeout(CFG.upstreamTimeoutMs, () => {
      upReq.destroy(new Error(`upstream timeout after ${CFG.upstreamTimeoutMs}ms`));
    });
    upReq.on('error', (e) => {
      if (clientGone) {
        log(`CLIENT-ABORT id=${reqId} key=${keyEntry.name} before-headers`);
        resolve({ ok: false, status: 0, body: 'client aborted', clientGone: true });
        return;
      }
      // 响应头已经发给客户端之后，不能再换 key 透明重试：客户端已经看到了半截流。
      // 返回 ok:true 让 handle() 直接结束本请求，不冷却、不切 key。
      if (responseStarted) {
        log(`STREAM-ERR id=${reqId} key=${keyEntry.name} after-headers ${e.message}`);
        if (!clientRes.writableEnded) {
          try { clientRes.destroy(); } catch {}
        }
        resolve({ ok: true, status: 0, streamError: e.message });
        return;
      }
      log(`NETWORK id=${reqId} key=${keyEntry.name} ${e.code || ''} ${e.message}`);
      resolve({ ok: false, status: 0, body: `${e.code || 'ERROR'}: ${e.message}` });
    });

    // 客户端断开 → 立刻掐掉上游，别白烧 token。
    // 关键：这属于“用户/Reasonix 主动取消”，不是 key 故障；
    // 必须带 clientGone=true 返回，避免 handle() 把当前 key 冷却并随机切到另一个 key。
    clientRes.on('error', () => {
      // 客户端响应流出错通常等于对端断开；标记后不要冷却/切 key。
      clientGone = true;
    });
    clientRes.on('close', () => {
      if (!clientRes.writableEnded) {
        clientGone = true;
        upReq.destroy(new Error('client aborted'));
      }
    });

    if (body && body.length) upReq.write(body);
    upReq.end();
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let len = 0;
    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      // 不要在这里 req.destroy()：先把 408 响应发出去，再由 handle() 关连接。
      finish(reject, new Error(`request body timeout after ${CFG.bodyTimeoutMs}ms`));
    }, Math.max(1, CFG.bodyTimeoutMs || 120000));
    req.on('data', (c) => {
      len += c.length;
      if (len > CFG.maxBodyBytes) {
        finish(reject, new Error(`request body too large (>${CFG.maxBodyBytes} bytes)`));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => finish(resolve, Buffer.concat(chunks)));
    req.on('aborted', () => finish(reject, new Error('request aborted before body end')));
    req.on('error', (e) => finish(reject, e));
    req.on('close', () => {
      if (!done && !req.complete) finish(reject, new Error('request closed before body end'));
    });
  });
}

function sendJSON(res, status, obj) {
  if (res.writableEnded || res.headersSent) return;
  const text = JSON.stringify(obj, null, 2);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(text) });
  res.end(text);
}

// ── 健康检查 / 自述端点（不转发上游）──────────────────────────────────────
function handleLocal(req, res, url) {
  const keys = loadKeys();
  const now = Date.now();
  if (url.pathname === '/health' || url.pathname === '/_gateway/health') {
    sendJSON(res, 200, {
      ok: true,
      pid: process.pid,
      uptimeSec: Math.round(process.uptime()),
      startedAt: state.stats.since,
      upstream: CFG.upstream.origin + CFG.upstream.basePath,
      strategy: (() => {
        const s = String(CFG.strategy || 'session').toLowerCase();
        if (s === 'round-robin') return 'round-robin + failover（注意：会打断 prompt cache）';
        if (s === 'session') return 'session：同一会话粘同一个 key + failover';
        return 'sticky：全局粘一个 key + failover';
      })(),
      stickyKey: state.sticky || '(尚未选过)',
      sessions: Object.keys(state.sessions).length,
      stats: state.stats,
      keys: keys.map((k) => {
        const ks = kstate(k.name);
        return {
          name: k.name,
          enabled: k.enabled,
          available: k.enabled && ks.cooldownUntil <= now,
          cooldownMsLeft: Math.max(0, ks.cooldownUntil - now),
          cooldownReason: ks.cooldownReason || '',
          ok: ks.ok,
          fail: ks.fail,
          lastStatus: ks.lastStatus,
          lastError: ks.lastError,
          lastUsedAt: ks.lastUsedAt,
          note: k.note,
        };
      }),
    });
    return true;
  }
  if (url.pathname === '/_gateway/reload' || url.pathname === '/reload') {
    reloadRuntimeConfig();
    keysCache.mtime = 0;
    const keys = loadKeys();
    stateDirty = true;
    log(`RELOAD config=${CONFIG_PATH} keys=${keys.map((k) => k.name).join(',') || '(none)'}`);
    sendJSON(res, 200, {
      ok: true,
      config: CONFIG_PATH,
      keys: keys.map((k) => ({ name: k.name, enabled: k.enabled })),
    });
    return true;
  }
  if (url.pathname === '/_gateway/reset') {
    for (const k of Object.keys(state.keys)) {
      state.keys[k].cooldownUntil = 0;
      state.keys[k].cooldownReason = '';
    }
    stateDirty = true;
    log('RESET all cooldowns cleared');
    sendJSON(res, 200, { ok: true, cleared: Object.keys(state.keys) });
    return true;
  }
  // 查看 / 手动指定主用 key：?name=163 指定，?clear=1 清空（下次请求按池顺序重选）
  if (url.pathname === '/_gateway/sticky') {
    const want = url.searchParams.get('name');
    if (url.searchParams.has('clear')) {
      state.sticky = '';
      stateDirty = true;
      log('STICKY cleared');
      sendJSON(res, 200, { ok: true, stickyKey: null });
      return true;
    }
    if (want) {
      const k = loadKeys().find((x) => x.name === want);
      if (!k) {
        sendJSON(res, 404, { ok: false, error: `keys.json 里没有名为 ${want} 的 key`, known: loadKeys().map((x) => x.name) });
        return true;
      }
      state.sticky = k.name;
      stateDirty = true;
      log(`STICKY set -> ${k.name}`);
      sendJSON(res, 200, { ok: true, stickyKey: k.name });
      return true;
    }
    sendJSON(res, 200, { ok: true, stickyKey: state.sticky || null, strategy: CFG.strategy || 'session' });
    return true;
  }
  // 会话绑定概览：哪些会话（指纹）绑在哪个 key 上（验证分散效果用）
  if (url.pathname === '/_gateway/sessions') {
    const entries = Object.entries(state.sessions);
    const byKey = {};
    for (const [, v] of entries) byKey[v.key] = (byKey[v.key] || 0) + 1;
    entries.sort((a, b) => (b[1].t || 0) - (a[1].t || 0));
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 20)));
    sendJSON(res, 200, {
      ok: true,
      total: entries.length,
      byKey,
      recent: entries.slice(0, limit).map(([fp, v]) => ({
        session: fp.slice(0, 8),
        key: v.key,
        hits: v.hits || 0,
        lastUsedAt: v.t ? new Date(v.t).toISOString() : null,
      })),
    });
    return true;
  }
  return false;
}

// ── 主处理：选 key → 转发 → 失败换 key ────────────────────────────────────
let reqSeq = 0;
async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (handleLocal(req, res, url)) return;

  req._reqId = ++reqSeq;
  state.stats.requests += 1;
  stateDirty = true;

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    const status = msg.includes('too large') ? 413 : msg.includes('timeout') ? 408 : 400;
    try { res.setHeader('connection', 'close'); } catch {}
    sendJSON(res, status, { error: { message: msg, type: 'gateway_body_error' } });
    try { req.destroy(); } catch {}
    return;
  }

  // 解析一次请求体：会话指纹（选 key 用）+ 日志字段，避免在 forward 里重复 parse
  let parsed = null;
  try {
    parsed = body.length ? JSON.parse(body.toString('utf8')) : null;
  } catch {
    parsed = null;
  }
  const meta = {
    model: parsed && typeof parsed.model === 'string' ? parsed.model : '',
    stream: !!(parsed && parsed.stream === true),
    fp: sessionFingerprint(parsed, req.headers),
  };

  const all = loadKeys().filter((k) => k.enabled);
  if (!all.length) {
    sendJSON(res, 503, {
      error: { message: 'goat-gateway: keys.json 里没有可用 key', type: 'gateway_no_keys' },
    });
    return;
  }

  const attemptsPerKey = Math.max(1, Number(CFG.attemptsPerKey) || 1);
  const maxAttempts = Math.max(1, Math.min(
    Number(CFG.maxAttemptsPerRequest) || 1,
    all.length * attemptsPerKey,
  ));
  const failures = new Map(); // keyName -> 本轮已失败次数
  const attempted = new Set();
  let last = null;

  for (let i = 0; i < maxAttempts; i++) {
    // 只把「本轮失败次数还没到 attemptsPerKey」的 key 交给 selectKey。
    const candidates = all.filter((k) => (failures.get(k.name) || 0) < attemptsPerKey);
    const target = selectKey(candidates, meta.fp);
    if (!target) break;
    attempted.add(target.name);

    if (i > 0) {
      state.stats.retries += 1;
      state.stats.switched += 1;
      stateDirty = true;
      const delay = Math.max(0, Number(CFG.retryDelayMs) || 0) * i;
      log(`RETRY id=${req._reqId} attempt=${i + 1}/${maxAttempts} -> key=${target.name} delay=${delay}ms`);
      if (delay > 0) await sleep(delay);
    }

    const r = await forward(req, res, target, body, meta);
    if (r.ok) {
      state.stats.forwarded += 1;
      if (r.streamError) {
        state.stats.failures = (state.stats.failures || 0) + 1;
        log(`STREAM-DONE id=${req._reqId} key=${target.name} streamError=${r.streamError}`);
      } else {
        clearCooldown(target.name);
      }
      stateDirty = true;
      return;
    }
    if (r.clientGone) return;

    last = r;
    const count = (failures.get(target.name) || 0) + 1;
    failures.set(target.name, count);
    // 401/402/403/429 属于“明确不能继续用这个 key”，立即冷却换 key；
    // 其它瞬时错误（5xx/网络/超时）允许在 attemptsPerKey 内先重试同一 key。
    // 401/402/403/429 属于「这个 key 明确不能用」，立即冷却换 key；
    // 唯独 Cloudflare 1010 是「客户端指纹被拦」，跟 key 无关：先在同一 key 上重试，
    // 避免一次风控就把两个账号一起冷却 20s（客户端那边表现成「卡住」）。
    const cfBlocked = isCloudflareBlock(r.body);
    const immediateCooldown = [401, 402, 403, 429].includes(Number(r.status)) && !cfBlocked;
    const limit = immediateCooldown ? 1 : attemptsPerKey;
    if (count >= limit) {
      applyCooldown(target.name, r.status, r.body);
    } else {
      log(
        `RETRY-SAME-KEY id=${req._reqId} key=${target.name} status=${r.status} fail=${count}/${attemptsPerKey}` +
          (cfBlocked ? ' cloudflare=1010' : ''),
      );
    }
  }

  // 全部失败：把最后一个上游错误原样（或包装）返回
  const stillCooling = all.filter((k) => isCooling(k.name)).map((k) => k.name);
  state.stats.failures = (state.stats.failures || 0) + 1;
  stateDirty = true;
  log(`EXHAUSTED id=${req._reqId} tried=${[...attempted].join(',')} cooling=[${stillCooling.join(',')}]`);
  sendJSON(res, last?.status && last.status >= 400 ? last.status : 503, {
    error: {
      message:
        `goat-gateway: 所有 key 均失败（已尝试 ${[...attempted].join(',') || '无'}）。` +
        `最后一个错误：${last?.body ? last.body.slice(0, 500) : 'n/a'}`,
      type: 'gateway_all_keys_failed',
      upstream_status: last?.status || 0,
    },
  });
}

// ── 启动 ────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    log(`FATAL-HANDLER ${e.stack || e.message}`);
    sendJSON(res, 500, { error: { message: String(e.message), type: 'gateway_internal' } });
  });
});
server.keepAliveTimeout = 120000;
server.headersTimeout = 130000;
server.requestTimeout = 0;

server.on('error', (e) => {
  log(`FATAL listen failed: ${e.message}`);
  process.exit(2);
});

server.listen(CFG.listen.port, CFG.listen.host, () => {
  const keys = loadKeys();
  log(
    `START goat-gateway pid=${process.pid} listen=http://${CFG.listen.host}:${CFG.listen.port}` +
      ` upstream=${CFG.upstream.origin}${CFG.upstream.basePath} keys=[${keys.map((k) => k.name + (k.enabled ? '' : ':off')).join(', ')}]`,
  );
});

pruneLogs();
setInterval(pruneLogs, 6 * 3600 * 1000).unref();

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    log(`STOP signal=${sig}`);
    saveState();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
process.on('uncaughtException', (e) => log(`UNCAUGHT ${e.stack || e.message}`));
process.on('unhandledRejection', (e) => log(`UNHANDLED ${e && (e.stack || e.message || e)}`));
