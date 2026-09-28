// dsh-plugin-local-search — dsh web_search 的「本地 wiki + 全 GitHub」优先 provider。
//
// 搜索顺序：
//   1. Linux 侧 local-search 聚合器（PocketWiki + 离线 Wikipedia ZIM）
//   2. GitHub 全站（repos + code + issues；优先 TianQue6916 的结果）
//   3. 如果上面都没结果，再回退到已注册的 web-search-deepseek（Bing/Tavily/Brave…）
//
// 设计参考社区做法：不改 dsh 核心，只通过 ctx.web.registerSearchProvider 替换 provider；
// token 走本地文件，不写进插件配置；GitHub token 优先环境变量，其次 git credential fill。

import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import tls from 'node:tls';
import { spawnSync } from 'node:child_process';

const IS_WIN = process.platform === 'win32';
const HOME = os.homedir();

const DEFAULT_CONFIG = {
  aggregatorUrl: process.env.LOCAL_SEARCH_AGGREGATOR_URL || 'http://100.79.96.82:8810',
  tokenFile: IS_WIN
    ? `${HOME}/.dsh/local-search-token`
    : `${HOME}/.config/local-search/token`,
  githubTokenFile: IS_WIN ? '' : `${HOME}/.config/local-search/github-token`,
  timeoutMs: 20000,
  maxResults: 8,
  enableGithub: true,
  enableFallback: true,
  fallbackProviderId: 'web-search-deepseek',
  priorityOwner: 'TianQue6916',
  githubCaFile: IS_WIN
    ? 'C:/Users/27063/.dev-sidecar/dev-sidecar.ca.crt'
    : `${HOME}/.dev-sidecar/dev-sidecar.ca.crt`,
  insecureTls: true,
};

function readTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    return '';
  }
}

function timedSignal(parent, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`timeout after ${timeoutMs}ms`));
  }, timeoutMs);
  timer.unref?.();
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  if (parent) {
    if (parent.aborted) {
      controller.abort(parent.reason);
    } else {
      const onAbort = () => controller.abort(parent.reason);
      parent.addEventListener('abort', onAbort, { once: true });
      controller.signal.addEventListener('abort', () => parent.removeEventListener('abort', onAbort), { once: true });
    }
  }
  return controller.signal;
}

function dedupeSources(sources, maxResults) {
  const seen = new Set();
  const out = [];
  for (const source of sources) {
    if (!source || typeof source.url !== 'string' || !source.url.trim()) continue;
    const url = source.url.trim();
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ ...source, url });
    if (out.length >= maxResults) break;
  }
  return out;
}

class LocalSearchProvider {
  constructor(getConfig, web) {
    this.id = 'local-wiki-github';
    this.getConfig = getConfig;
    this.web = web;
    this.githubTokenCache = undefined;
  }

  available() {
    const cfg = this.getConfig();
    return Boolean(cfg.aggregatorUrl);
  }

  async search(request, signal) {
    const cfg = this.getConfig();
    const maxResults = Math.max(
      1,
      Math.min(Number(request.maxResults || cfg.maxResults || 8), Number(cfg.maxResults || 8)),
    );
    let sources = [];

    try {
      const local = await this.searchAggregator(request.query, Math.max(1, Math.ceil(maxResults / 2)), signal);
      sources.push(...local);
    } catch (error) {
      console.warn(`[local-search] wiki aggregator failed: ${error?.message || error}`);
    }

    if (cfg.enableGithub !== false && sources.length < maxResults) {
      try {
        const github = await this.searchGithub(request.query, maxResults, signal);
        sources.push(...github);
      } catch (error) {
        console.warn(`[local-search] github search failed: ${error?.message || error}`);
      }
    }

    sources = dedupeSources(sources, maxResults);
    if (sources.length > 0) return { sources, truncated: false };

    if (cfg.enableFallback !== false && cfg.fallbackProviderId && cfg.fallbackProviderId !== this.id) {
      const fallback = this.web?.searchProviders?.get(cfg.fallbackProviderId);
      if (fallback && typeof fallback.search === 'function' && (typeof fallback.available !== 'function' || fallback.available())) {
        return await fallback.search({ ...request, maxResults }, signal);
      }
    }

    return { sources: [], truncated: false };
  }

  localSearchToken() {
    const cfg = this.getConfig();
    return process.env.LOCAL_SEARCH_TOKEN || readTextFile(cfg.tokenFile);
  }

  async searchAggregator(query, maxResults, signal) {
    const cfg = this.getConfig();
    const token = this.localSearchToken();
    if (!token) throw new Error(`missing local-search token (${cfg.tokenFile})`);
    const url = new URL('/search', cfg.aggregatorUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('max', String(maxResults));
    const response = await fetch(url, {
      headers: { 'x-local-search-token': token },
      signal: timedSignal(signal, cfg.timeoutMs || 20000),
    });
    if (!response.ok) throw new Error(`local-search HTTP ${response.status}`);
    const data = await response.json();
    return Array.isArray(data.sources) ? data.sources : [];
  }

  githubToken() {
    if (this.githubTokenCache !== undefined) return this.githubTokenCache;
    const cfg = this.getConfig();
    const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_PAT;
    if (envToken) return (this.githubTokenCache = envToken);
    if (cfg.githubTokenFile) {
      const fileToken = readTextFile(cfg.githubTokenFile);
      if (fileToken) return (this.githubTokenCache = fileToken);
    }
    try {
      const result = spawnSync('git', ['credential', 'fill'], {
        input: 'protocol=https\nhost=github.com\n\n',
        encoding: 'utf8',
        timeout: 5000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });
      if (result.status === 0) {
        const match = /(?:^|\n)password=(.+)/.exec(result.stdout || '');
        if (match && match[1].trim()) return (this.githubTokenCache = match[1].trim());
      }
    } catch {
      // ignore
    }
    return (this.githubTokenCache = '');
  }

  githubJson(path, signal, accept = 'application/vnd.github+json') {
    const cfg = this.getConfig();
    const token = this.githubToken();
    let ca;
    try {
      if (cfg.githubCaFile) ca = [...tls.rootCertificates, fs.readFileSync(cfg.githubCaFile, 'utf8')];
    } catch {
      ca = undefined;
    }
    return new Promise((resolve, reject) => {
      const headers = {
        'User-Agent': 'dsh-plugin-local-search/0.1',
        Accept: accept,
        'X-GitHub-Api-Version': '2022-11-28',
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const req = https.request(
        {
          hostname: 'api.github.com',
          path,
          method: 'GET',
          headers,
          ca,
          rejectUnauthorized: ca !== undefined ? true : cfg.insecureTls === false,
        },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                resolve(JSON.parse(body));
              } catch (error) {
                reject(error);
              }
              return;
            }
            const error = new Error(`GitHub HTTP ${res.statusCode}: ${body.slice(0, 180)}`);
            error.status = res.statusCode;
            reject(error);
          });
        },
      );
      req.on('error', reject);
      if (signal) {
        if (signal.aborted) {
          req.destroy(new Error('aborted'));
          return;
        }
        const onAbort = () => req.destroy(new Error('aborted'));
        signal.addEventListener('abort', onAbort, { once: true });
        req.on('close', () => signal.removeEventListener('abort', onAbort));
      }
      req.end();
    });
  }

  async searchGithub(query, maxResults, signal) {
    const cfg = this.getConfig();
    const token = this.githubToken();
    const timeoutSignal = timedSignal(signal, cfg.timeoutMs || 20000);
    const sources = [];

    // 1) 仓库：全 GitHub
    try {
      const data = await this.githubJson(
        `/search/repositories?q=${encodeURIComponent(query)}&per_page=${Math.min(5, maxResults)}`,
        timeoutSignal,
      );
      for (const item of data.items || []) {
        sources.push({
          url: item.html_url,
          title: `${item.full_name}${item.language ? ` · ${item.language}` : ''}`,
          snippet: `${item.description || ''}${item.stargazers_count != null ? ` ★${item.stargazers_count}` : ''}`.trim(),
          provider: 'github',
        });
      }
    } catch (error) {
      console.warn(`[local-search] github repo search failed: ${error?.message || error}`);
    }

    // 2) 代码：有 token 才走 code search（GitHub 要求认证，且限流更紧）
    if (token) {
      try {
        const data = await this.githubJson(
          `/search/code?q=${encodeURIComponent(query)}&per_page=${Math.min(5, maxResults)}`,
          timeoutSignal,
          'application/vnd.github.text-match+json',
        );
        for (const item of data.items || []) {
          const repo = item.repository?.full_name || '';
          const fragment = (item.text_matches || [])
            .map((m) => String(m.fragment || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .join(' … ');
          sources.push({
            url: item.html_url,
            title: `${repo} / ${item.path || ''}`,
            snippet: fragment.slice(0, 300),
            provider: 'github',
          });
        }
      } catch (error) {
        console.warn(`[local-search] github code search failed: ${error?.message || error}`);
      }
    }

    // 3) Issues / Discussions：补充问答类结果
    try {
      const data = await this.githubJson(
        `/search/issues?q=${encodeURIComponent(query)}&per_page=${Math.min(4, maxResults)}`,
        timeoutSignal,
      );
      for (const item of data.items || []) {
        if (!item.html_url) continue;
        sources.push({
          url: item.html_url,
          title: `[GitHub] ${item.title || ''}`,
          snippet: String(item.body || '').replace(/\s+/g, ' ').trim().slice(0, 220),
          provider: 'github',
        });
      }
    } catch (error) {
      console.warn(`[local-search] github issue search failed: ${error?.message || error}`);
    }

    // 自己的仓库优先，其余保持 GitHub 返回顺序
    const owner = String(cfg.priorityOwner || '').toLowerCase();
    if (owner) {
      sources.sort((a, b) => {
        const aOwn = a.url.toLowerCase().includes(`github.com/${owner}/`) ? 0 : 1;
        const bOwn = b.url.toLowerCase().includes(`github.com/${owner}/`) ? 0 : 1;
        return aOwn - bOwn;
      });
    }
    return sources;
  }
}

export const name = 'local-search';
export const inject = ['web'];

export function apply(ctx, initialConfig = {}) {
  const config = { ...DEFAULT_CONFIG, ...(initialConfig || {}) };
  ctx.inject(['web'], (wctx) => {
    const provider = new LocalSearchProvider(() => config, wctx.web);
    wctx.web.registerSearchProvider(provider);
  });
}
