#!/usr/bin/env node
/**
 * quota-http.mjs -- local quota HTTP endpoint for UI panels (dsh web / Reasonix status bar).
 *   GET /quota          -> { ok, ts, rows: [...] }            (JSON, for UI panels)
 *   GET /balance        -> plain text one-liner (6 numbers)   (for Reasonix balance_url)
 *   GET /balance?format=json -> { is_available, balance_infos: [...] }
 *   GET /health         -> { ok: true }
 * Data source: goat-usage.ps1 (account metadata; querying costs no quota).
 */
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const PORT = Number(process.env.QUOTA_HTTP_PORT || 8790);
const SCRIPT = process.env.GOAT_USAGE_SCRIPT || 'D:\\Toolbox\\goat-gateway\\goat-usage.ps1';
const CACHE = path.join(os.tmpdir(), 'goat-quota-http-cache.json');
const TTL_MS = 10000;

let last = { at: 0, body: null };

function run(extra) {
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, '-Json',
    '-CacheSeconds', '10', '-CacheFile', CACHE].concat(extra || []);
  return execFileSync('powershell', args, { encoding: 'utf8', timeout: 90000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
}

function readQuota(force) {
  const now = Date.now();
  if (!force && last.body && now - last.at < TTL_MS) { return last.body; }
  let parsed;
  try { parsed = JSON.parse(run(force ? ['-Force'] : [])); }
  catch { parsed = JSON.parse(run(['-Force'])); }
  const body = { ok: true, ts: new Date().toISOString(), rows: Array.isArray(parsed) ? parsed : [parsed] };
  last = { at: now, body };
  return body;
}

const pct = (u, c) => (Number(c) > 0 ? Math.round((100 * Number(u)) / Number(c)) : 0);
const lbl = { fiveHour: '5h', weekly: '\u5468', monthly: '\u6708' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:' + PORT);
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 'no-store'
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  if (url.pathname === '/health') {
    res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors));
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (url.pathname === '/quota') {
    try {
      const body = readQuota(url.searchParams.get('force') === '1');
      res.writeHead(200, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors));
      res.end(JSON.stringify(body));
    } catch (e) {
      res.writeHead(500, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors));
      res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
    }
    return;
  }
  if (url.pathname === '/balance') {
    try {
      const body = readQuota(url.searchParams.get('force') === '1');
      const rows = (body.rows || []).filter(Boolean);
      if (url.searchParams.get('format') === 'json') {
        const infos = [];
        rows.forEach((r) => {
          [['5h', r.fiveHourUsed, r.fiveHourCap],
           [lbl.weekly, r.weeklyUsed, r.weeklyCap],
           [lbl.monthly, r.monthUsed, r.monthCap]].forEach((w) => {
            infos.push({
              currency: r.name + ' ' + w[0],
              total_balance: pct(w[1], w[2]) + '%',
              granted_balance: String(w[2]),
              topped_up_balance: String(Number(w[1]).toFixed(2))
            });
          });
        });
        res.writeHead(200, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors));
        res.end(JSON.stringify({ is_available: true, balance_infos: infos }));
        return;
      }
      const line = rows.map((r) => r.error
        ? r.name + ' error'
        : r.name + ' 5h ' + pct(r.fiveHourUsed, r.fiveHourCap) + '% '
          + lbl.weekly + ' ' + pct(r.weeklyUsed, r.weeklyCap) + '% '
          + lbl.monthly + ' ' + pct(r.monthUsed, r.monthCap) + '%').join('   |   ');
      res.writeHead(200, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, cors));
      res.end(line);
    } catch (e) {
      res.writeHead(500, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, cors));
      res.end('quota error');
    }
    return;
  }
  res.writeHead(404, cors); res.end();
});

server.listen(PORT, '127.0.0.1', () => console.log('quota-http on ' + PORT));
