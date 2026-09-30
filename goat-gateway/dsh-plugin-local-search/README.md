# dsh-plugin-local-search

把 dsh 的 `web_search` 底层 provider 换成**三源并发聚合**（不是 fallback 链）：
一次搜索同时发起三路，结果合并成一份列表统一返回。

| rank | 来源 | 说明 |
|---|---|---|
| 0 | **GitHub 全站** | repositories + code + issues；`priorityOwner` 的仓库在这个来源内部提前 |
| 1 | **DeepSeek 官方搜索** | dsh 的 `deepseek-official` provider（Anthropic 兼容 Messages + native `web_search` server tool）。**每搜一次 = 一次 model turn，要花钱、要等** |
| 2 | **Linux local-search 聚合器** | PocketWiki + 离线 Wikipedia ZIM（Tailscale 内网） |

合并规则（`mergeSources`，纯函数、有 selftest）：

1. 每个来源先吃自己的配额 `ceil(maxResults / 来源数)` —— 保证三源都露面；
2. 剩下的名额按 rank 顺序回填；
3. 跨源同一 URL 只保留 rank 最高的那一份；
4. 最后按 rank 稳定排序 → 输出永远是「github 块 → deepseek 块 → wiki 块」（`interleaveSources: true` 改成 round-robin 交错）；
5. 三源全空才回退到 `fallbackProviderId`（默认 `multi-search`）。

它不修改 dsh 核心，只通过 `ctx.web.registerSearchProvider` 注册一个 provider。

## 安装

```powershell
dsh plugin --profile web add "link:D:/Toolbox/goat-gateway/dsh-plugin-local-search"
dsh --profile web --dump-config | Select-String local-wiki-github   # 零副作用校验
```

bundle patch 会把 profile 的 `searchProvider` 设成 `local-wiki-github`。

## 生效方式（重要）

- `index.js` 与 `cordis.patch.yml` 都在 node_modules 里的 bundle → **不参与 HMR，必须重启 dsh 进程**。
- 只想改配置又不想重启：在 `~/.dsh/profiles/web/cordis.patch.yml` 里加一条**完整的**同名 row
  （row 是 replace 语义，`name` 和全部字段都要带上），那条走 `patchReload: live`。
- 校验：`dsh --profile web --dump-config`（零副作用，能在不重启的情况下看合成结果）。

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `aggregatorUrl` | `http://100.79.96.82:8810` | Linux local-search 服务 |
| `tokenFile` | `C:/Users/27063/.dsh/local-search-token` | 读取 aggregator token 的文件 |
| `enableWiki` / `enableGithub` / `enableDeepseek` | `true` | 三路来源开关 |
| `deepseekProviderId` | `deepseek-official` | deepseek 官方 provider 在 dsh 里注册的 id（**不是** row id `web-search-deepseek`） |
| `deepseekTimeoutMs` | `40000` | deepseek 单独的超时预算（一次 model turn）；必须 < `dsh-tool-web` 的 `searchTimeoutMs` |
| `deepseekCacheTtlMs` | `120000` | 同一 query 的 deepseek 结果短期复用，0 = 关（`dsh-tool-web` 的 `searchMaxQueries` 默认 4，可省 model turn） |
| `deepseekFailureCooldownMs` | `600000` | deepseek 凭证/账号类失败后的熔断时长，0 = 不熔断 |
| `timeoutMs` | `20000` | wiki / GitHub 单次超时 |
| `maxResults` | `8` | 合并后的总上限（`dsh-tool-web` 也会再裁一刀） |
| `interleaveSources` | `false` | `true` = round-robin 交错，而非 rank 分块 |
| `tagTitles` | `false` | `true` 时把来源名写进 title（`[github] xxx`）便于肉眼区分 |
| `enableFallback` | `true` | 三源全空时是否回退 |
| `fallbackProviderId` | `multi-search` | 回退目标。**别指向 `deepseek-official`**：它已是并发来源，代码会拦住避免白跑 model turn |
| `priorityOwner` | `TianQue6916` | 这个 owner 的 GitHub 结果在同来源内提前 |
| `githubCaFile` | `C:/Users/27063/.dev-sidecar/dev-sidecar.ca.crt` | 把 dev-sidecar 的本地 CA 追加到系统根证书，用于验证本地 MITM 代理 |
| `insecureTls` | `true` | `githubCaFile` 不存在时的兜底：跳过证书校验 |

## 自测

```powershell
node selftest.mjs    # 9 组：rank 顺序 / 配额 / 跨源去重 / 回填 / 交错 / 并发 / 单源失败 / 回退 / 缓存 / 熔断
```

不碰真实网络：GitHub 走实例 monkeypatch，deepseek 走假 provider，wiki 走本机 http stub。

## GitHub token

按优先级：`GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_PAT` 环境变量 → `githubTokenFile` → `git credential fill`。
没有 token 时仍会搜仓库和 issues（匿名限流），但不会搜代码。

## 成本与延迟

- 一次 `web_search` 工具调用最多 4 个 query（`dsh-tool-web` 的 `searchMaxQueries`），每个 query 都会并发打一次
  deepseek → 最坏 4 次 model turn。嫌贵：调小 `searchMaxQueries`、把 `deepseekCacheTtlMs` 调大，或 `enableDeepseek: false`。
- `deepseek` 慢或失败时，github 与 wiki 的结果照常返回（`Promise.allSettled`，单源失败只记日志）。

## 安全说明

- `local-search` 服务绑 Tailscale，内容端点不在公网。
- token 文件不写进插件配置，Linux 侧权限 `0600`。
- GitHub token 不落盘，优先用系统凭据。
