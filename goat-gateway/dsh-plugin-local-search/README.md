# dsh-plugin-local-search

把 dsh 的 `web_search` 底层 provider 换成：

```text
1. Linux local-search 聚合器（PocketWiki + 离线 Wikipedia）
2. GitHub 全站搜索（repositories + code + issues）
3. 如果前两步都没结果，回退到已注册的 multi-search（Bing/Tavily/Brave…）
```

它不修改 dsh 核心，只通过 `ctx.web.registerSearchProvider` 注册一个 provider，
和 `dsh-web-search-multi` 属于同一种社区插件接法。

## 安装

```powershell
dsh plugin --profile web add "link:D:/Toolbox/goat-gateway/dsh-plugin-local-search"
dsh plugin --profile headless add "link:D:/Toolbox/goat-gateway/dsh-plugin-local-search"
```

然后把 `dsh-plugin-local-search` 加进 profile 的 `dsh.profile.bundles`
（通常 `dsh plugin add` 会自动加）。它的 bundle patch 会设置：

```yaml
- id: web
  config:
    searchProvider: local-wiki-github
```

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `aggregatorUrl` | `http://100.79.96.82:8810` | Linux local-search 服务 |
| `tokenFile` | `C:/Users/27063/.dsh/local-search-token` | 读取 aggregator token 的文件 |
| `timeoutMs` | `20000` | 单次搜索超时 |
| `maxResults` | `8` | 返回结果上限 |
| `enableGithub` | `true` | 是否启用 GitHub 全站搜索 |
| `enableFallback` | `true` | 本地/GitHub 都空时是否回退 multi-search |
| `fallbackProviderId` | `multi-search` | 回退的 provider id |
| `priorityOwner` | `TianQue6916` | 这个 owner 的 GitHub 结果排在同级结果前面 |
| `githubCaFile` | `C:/Users/27063/.dev-sidecar/dev-sidecar.ca.crt` | 把 dev-sidecar 的本地 CA 追加到系统根证书，用于验证本地 MITM 代理 |
| `insecureTls` | `true` | `githubCaFile` 不存在时的兜底：跳过证书校验 |

## GitHub token

按优先级：

1. `GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_PAT` 环境变量
2. `githubTokenFile`
3. `git credential fill`（Windows 凭据管理器）

没有 token 时仍会搜仓库和 issues（匿名限流），但不会搜代码。

## 安全说明

- `local-search` 服务绑 Tailscale，内容端点不在公网。
- token 文件不写进配置，Linux 侧权限 `0600`。
- GitHub token 不落盘，优先用系统凭据。
