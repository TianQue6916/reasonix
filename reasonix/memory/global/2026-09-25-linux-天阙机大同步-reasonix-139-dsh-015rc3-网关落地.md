---
id: mem-9f3c1a7be52d48c6a1d0f4e8b7c25a93
revision: 1
created_at: "2026-09-25T11:40:00Z"
updated_at: "2026-09-25T11:40:00Z"
name: 2026-09-25-linux-天阙机大同步-reasonix-139-dsh-015rc3-网关落地
title: Linux 天阙机大同步（2026-09-25）：reasonix 1.39.0 + dsh 0.1.5-rc.3 + goat-gateway 落地 + 课程/记忆合并
description: 长期离线的 Linux 天阙机一次性对齐 Windows 主力机：reasonix 升 1.39.0（含桌面）、dsh 升 0.1.5-rc.3 并打四处补丁、部署 goat-gateway（systemd user）、config/settings 指向网关、memory+skills 合并、课程文件增量、13 个课程仓库 clone；含 dsh 启动失败的根因（cordis 版本钉死 4.0.2）
keywords: Linux天阙机,同步,reasonix 1.39.0,dsh 0.1.5-rc.3,cordis 4.0.2,goat-gateway,systemd user,gh-proxy,node22,rsync -au
activation: relevant
metadata:
  type: user
  fact_type: project
  scope: global
---

# Linux 天阙机大同步（2026-09-25）

## 0. 背景与口径
Linux（Ubuntu 24.04.4，100.79.96.82 / LAN 192.168.0.103）长期离线（tailscale 显示 6h+）。上线后一次性对齐 Windows 主力机。
**同步口径（用户拍板）**：课程文件全量 + 配置/记忆/技能按「**哪边修改新就以哪边为主**」（= 同名取较新 mtime，双方独有内容都保留）。
实现方式：`rsync -au`（--update 只覆盖目标更旧的），**不做删除**。

## 1. 两机差异对账（同步前）
| 项 | Windows | Linux |
|---|---|---|
| OS / node | Win11 / v24.15.0 | Ubuntu 24.04.4 / 系统 v18.19.1 + 专用 **v22.23.2**（`~/.local/node22`） |
| reasonix CLI | 1.39.0（npm） | **v1.19.3**（`/usr/bin/reasonix`，root，8/3） |
| reasonix 桌面 | 1.38.10 active | **v1.38.3** |
| dsh | 0.1.5-rc.2（node24） | **0.1.1-rc.2**（node22） |
| goat-gateway | 有（8788） | 无 |
| provider | `http://127.0.0.1:8788/v1` | 直连 `api.commandcode.ai` |
| memory / skills | 318 / 200 文件 | 183 / 177 |
| 课程文件 | 1994 文件 / 492MB | 1969 / 481MB |
| 课程仓库 | `D:\gh-publish` 13 仓 1.7GB | 无（且**无 GitHub SSH key**） |

## 2. 完成项
1. **goat-gateway 部署**：`~/goat-gateway`（`D:\Toolbox\goat-gateway` 的 Linux 版）；systemd **user** 服务 `goat-gateway.service`（`enable --now`，Restart=always，日志 `logs/gateway.*.log`；Linger=yes）。`/v1/models` 200，2 key 均 available。
2. **配置指向网关**：`~/.reasonix/config.toml` 的 commandcode-goat provider `base_url/chat_url/request_url` → `http://127.0.0.1:8788/v1` + `no_proxy = true`；`~/.dsh/settings.yaml` baseURL 同改（并按「较新为准」用 Windows 版覆盖：补 `reasoningEffort: high`、`defaultMaxTokens: 65536`、`retryPolicy`）。`reasonix doctor` 已显示 `commandcode-goat ... 127.0.0.1:8788 key:present`。
3. **reasonix 升 1.39.0**：`desktop-v1.39.0`（2026-09-24 发布）；包 `Reasonix-linux-amd64.tar.gz`(170MB) → 解到 `~/.local/bin/versions/v1.39.0/`（`reasonix-cli`+`reasonix-desktop`+`app/`），并更新 `~/.local/bin/{reasonix,reasonix-launcher,reasonix-guard}` + `current.json`。旧 `v1.38.3` 保留可回滚。
4. **dsh 升 0.1.5-rc.3 + 四处补丁**：`npm i -g @deepseek-ai/dsh@0.1.5-rc.3`（**必须** `export PATH="$HOME/.local/node22/bin:$PATH"`，否则 npm 的 shebang 命中系统 node18 → prefix 解析成 `/usr/lib/node_modules` → EACCES）；补丁：① 3 个 mjs 加 `sessionEvents()` 兼容 ② `agent.cordis.yml` persona `text:`→`prefix:` ③ `cordis.patch.yml` 补挂 `@deepseek-ai/dsh-tool-str-replace-editor`（maxOutputChars 16000）④ 链接维护（dsh 启动自动重建）。验证：`dsh --profile headless "用 bash 执行 echo DSH_TOOL_OK"` → 返回 `DSH_TOOL_OK`。
5. **memory/skills 合并**：`rsync -au`（排除 `.revisions/`/`.archive/`），memory 130 文件、skills 156 文件；随后删除 262 个 `*.conflict.*.bak`（两机同步冲突垃圾）。备份在 `~/rx-sync-linux/backup-<时间戳>/`。
6. **课程文件增量**：`rsync -au` → 1969→**1999** 文件（+30：`data lerning/18.065_*双语详解` 12 个、`Strang part004/005`、11 张 assets 图）；Linux 独有的临时产物保留。
7. **13 个课程仓库 clone**：`~/课程资料`（1.8GB），经 **gh-proxy 镜像**（见 §4）。

## 3. dsh 升级失败的关键根因（重要教训）
首次装 `0.1.5-rc.2` 后启动报 `plugin tree failed to load: @deepseek-ai/dsh-sandbox-local`。
- 排查：包存在、链接已重建、单独 `import()` **成功** → 不是包缺失。
- **真根因**：npm 在 2026-09-25 用 `0.1.5-rc.2` 的依赖范围解析出**全家桶 0.1.5-rc.3 + cordis 4.0.4**；而 rc.3 版 `dsh-sandbox-local` 的 `peerDependencies` 把 cordis **硬钉为精确 `4.0.2`**（rc.2 版是 `^4.0.2`）→ peer 不满足，Cordis 拒绝加载。
- **修法**：装 `@deepseek-ai/dsh@0.1.5-rc.3`（当前 dist-tags latest，`0.1.7-rc.2` 是 next）→ 依赖自洽，cordis 回到 4.0.2，启动正常。
- **通用教训**：`0.1.5-rc.x` 系各包 peerDeps 互相钉精确版本；升级 dsh 时**别停在中间小版本**，直接跟 dist-tags `latest`，否则会落到"半套 rc.3"的坏组合。

## 4. Linux 侧操作铁律（本次踩坑）
- **ssh + PowerShell 内联命令不可用**：PowerShell 会吞掉内层双引号、展开 `$VAR`/`$(...)`（连 `$src` 这类本地变量都会污染远程命令）。**一律写 .sh 文件 → scp → `sed -i 's/\r$//'` → `bash` 执行**。
- **`$env:TEMP` 被 Reasonix 重定向**到 `reasonix-session-tmp-*`，与真实 temp 不同；中转文件请放 `~`（本次用 `~/rx-sync-linux`）。
- **GitHub 直连不通**：Linux 连 `api.github.com` 可以，但 release 文件（`objects.githubusercontent.com`）**http=000 完全不通**；Windows 直连同样不通（dev-sidecar 代理 31181 也没救）。可用镜像：**`https://gh-proxy.com/https://github.com/...`（实测 2–4 MB/s）**，`ghfast.top` ≈0.26MB/s、`ghproxy.net` ≈0.18MB/s、`github.moeyy.xyz` 不通。
- **Linux 的 dsh 必须用 node22**：`~/.local/node22/bin/{node,npm,dsh}`；非交互 ssh 的 PATH 不含它，需显式 `export PATH="$HOME/.local/node22/bin:$PATH"`。
- reasonix 桌面启动器：`~/.local/share/applications/reasonix.desktop` 的 Exec 指向 `~/.local/bin/reasonix-peak-warn`（峰值告警包装）。

## 5. 遗留 / 待观察
- `/usr/bin/reasonix` 仍是 root 所有 v1.19.3（未动，作为兜底）；终端里 `which reasonix` 在非 login shell 会命中它（桌面与 `~/.profile` 的 login shell 则用 `~/.local/bin/reasonix` v1.39.0）。
- Linux 上运行中的 `reasonix bot start --channels weixin`（pid 9143）是升级**前**启动的旧二进制进程，如需新版行为需重启该 bot。
- `~/rx-sync-linux/` 内有 keys.json、reasonix.env（含密钥）与 600MB 中转包（courses.tar.gz / Reasonix tar）→ 用完应清理。
