---
id: mem-012afd51d6e2750ec295d9e041f5cad0
revision: 4
created_at: "2026-09-26T15:43:05.032Z"
updated_at: "2026-09-28T05:28:44.716Z"
name: rule-star-open-source-usage
description: "元规则：用过/读过/借鉴过的开源项目必须 star（本次新增 9 个，累计 30）+ 纯 bash 的 star 执行路径"
metadata:
  type: user
  fact_type: feedback
  scope: global
---

# 元规则：用过别人的开源项目要记得 star（2026-09-26 用户指示）

## 规则
凡是我**实际使用、阅读或借鉴**过的开源项目，都要给它的仓库 **star**，并在记忆里留档：读了 README/源码 → star；装了插件/借了设计思路 → star；调研中引用了它的机制并写进结论 → star。
**理由**：对开源作者的基本尊重；也让「我到底用过什么」可追溯。**"引用即 star"，不要攒批。**
**注意**：即使某个插件后来因为不适用被**卸载**了，只要我用过/读过它，仍然要 star（用过了就是用过了）。

## 执行状态

### 第一批（2026-09-26，17 个，ok=17 fail=0）
EIGHTfs/dsh-skill-scoreboard、csyangwen/dsh-memory-evolve、Phant0Meow/dsh-meow-memory、adoresever/graph-memory、mem9-ai/mem9、omdsh-dev/dsh-mnemon、cameronrye/openzim-mcp、epheterson/Zimi、Tencent/BrowserSkill、wqty123/dsh-browser、Breeze136/dsh-kb-rag、ZiYuan258/dsh-skill-router、volcengine/OpenViking、MichengAI/dsh-agency-agents、ZSeven-W/dsh-crew、PerryLink/dsh-auto-review、deepseek-ai/deepseek-harness

### 第二批（2026-09-27，4 个新增 + 1 个已在）
| 仓库 | 关系 | 结果 |
|---|---|---|
| `giter00/dsh-headroom` | 装了 0.3.0（工具输出可逆压缩） | STARRED |
| `1692775560/dsh-Mimir-Academic-research` | 装了 dsh-mimir 0.21.0（学术工作台） | STARRED |
| `vshulcz/deja-vu` | 装了 dsh-deja 0.21.2，并给它提了 issue #4053 | STARRED |
| `liustack/modlens` | 装过、读过 README、后因 V4.1 原生多模态而卸载 | STARRED（卸载不影响） |
| `cinob/dsh-web-search-multi` | 修好了 `web_search` | 早已 star |

### 第三批（2026-09-28，本次净新增 9 个，全部 204）
| 仓库 | 关系 |
|---|---|
| `lanbaolu/dsh-wechat-bridge` | 本次微信 bot 迁移的主选，装了 0.9.0 + 读源码核实凭据 schema |
| `Yu-tao-Li/dsh-computer-use-win` | #7 computer-use 主选，装到 L2 隔离环境 + 读 README/源码 |
| `MingoZhou/dsh-replay` | 改了它的 client.js / viewer.js（鲸小深 loading → thinking） |
| `dsh-market/dsh-market` | 装了 dshmarket（插件市场） |
| `liguobao/ds-harness-remote` | #6 remote_control 首选，读了 README（未安装） |
| `AbcdefgXW/dsh-msg-hub` | 微信迁移备选，其 `loadWeixinAccount()` 的原文件名兼容分支是源码级强证据 |
| `pan17/dsh-wechat` | 微信候选，读过源码；因其「只有退出登录、没有独立停 poller」而出局 |
| `PerryLink/dsh-click` | computer-use 次选，读过 README（四道闸设计） |
| `jing-hy/computer-user` | computer-use 试水候选，caps 全库最窄（只有 shell） |

（`omdsh-dev/dsh-mnemon`、`giter00/dsh-headroom`、`vshulcz/deja-vu` 本批重复出现，已在册。）

**累计 30 个。**

## 执行路径（已订正 · 2026-09-27，本批复验有效）

> **订正**：先前记「bash 被沙箱禁网、必须交给 PowerShell」，**错**。
> bash 一直有网，是 env 里 `127.0.0.1:31181` 那个**没开的代理**把它挡住了。

**最短路径（纯 bash；本批 12 个全部 204 = 一次成功）**：

```bash
TOKEN=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null | sed -n 's/^password=//p' | tr -d '\r\n')
curl -s --noproxy '*' -X PUT -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/user/starred/<owner>/<repo>          # 204 = 成功
```

- 账号 `TianQue6916`，token 长度 **40**，存在 Windows 凭据管理器（`LegacyGeneric:target=git:https://github.com`）
- token 走环境变量，**不落盘、不打印**；用 `sed -n 's/^password=//p'` 单取，避免把整段 credential 输出打出来
- `--noproxy '*'` 是关键（绕开那个没开的代理）
- **先查后写**：`GET /user/starred/{owner}/{repo}` 返回 204 就跳过，避免重复调用
- 逐个 `sleep 0.4`，12 个连发没有被 secondary rate limit 拦
- **catalog 里查 repo URL 的落点**：`plugins.json` 的 `url` 字段（比猜 owner 可靠）

## 本机无 gh CLI
`gh` 在 Windows 侧与 Linux 天阙机上都**不存在**。上面是等价替代；若以后要装，`winget install GitHub.cli` + `gh auth login` 会更省事。
**另注**：本机 GitHub 走 SSH（`git@github.com`，见 `~/.ssh/config` 里 `HostName ssh.github.com / Port 443`），但 REST API 仍需要那个 40 字符 token —— 两者是不同通道，别混。
