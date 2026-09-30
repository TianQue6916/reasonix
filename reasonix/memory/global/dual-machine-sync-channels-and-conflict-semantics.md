---
id: mem-fdeea51baf47f6a8f9ff012a78d148c6
revision: 1
created_at: "2026-09-30T13:53:52.749Z"
updated_at: "2026-09-30T13:53:52.749Z"
name: dual-machine-sync-channels-and-conflict-semantics
description: "双机同步通道现状：reasonix cron 已停用、sync_dsh.py 只管 ~/.dsh，skills 无自动通道；冲突「双方保留」不收敛，删除必须三端对称"
metadata:
  type: user
  fact_type: reference
  scope: global
---

## 通道分工（2026-09-30 实测）

| 根目录 | 同步器 | 现状 |
|---|---|---|
| `~/.reasonix`（memory / skills / projects / archive / sessions / global-workspace / mind-transcripts） | `~/.reasonix/global-workspace/sync/sync_reasonix.py`（Linux 侧 paramiko，连 Windows `100.84.67.49`，账密写死在脚本里） | ⚠️ **cron 已停用**（`sync_cron.sh` 的 `30 8,12,21` 被注释，理由「改用 dsh 同步」）⇒ 只有手动 `--sync` 才跑 |
| `~/.dsh` | `~/.dsh/storages/tools/sync_dsh.py`（复用同一份 `Syncer`） | 新的主力通道，但**只覆盖 `~/.dsh` 这一对**，**不含 skills/memory** |
| `~/.reasonix` ↔ Windows `AppData\Roaming\reasonix`（桌面端）**与** Windows `.reasonix`（legacy） | 同上 sync_reasonix（`WIN` + `WIN_LEGACY` 两趟） | 两个 Windows 目录都被同步；dsh 的 `~/.dsh/skills/*` symlink 指向 legacy `.reasonix`，Desktop 读 Roaming ⇒ 同一 skill 可能两份不同内容 |

## 冲突语义（两个脚本一字相同）
- 同名且 **size 不同** → **双方主文件都不动**，各自把对方版本另存为 `<name>.conflict.<对方host>.<md5前10>.bak`；`stats['conflict'] += 1`。
- 同名且 **size 相同** → 直接判为 same（**不做内容比对**）⇒ **等长改动不传播**（例：zh→en 等长状态文件）。要传就把文件大小改到不同。
- 仅一方有 → 向另一方补齐（上传/下载）。
- `.conflict.*.bak` 自身不参与同步（防套娃）。

## 由此推出的操作铁律
1. **删除 / 停用 / 改名必须三端同时做**，否则「仅一方有 → 补齐」会把文件补回来，停用失效。
2. 冲突**永远不会自动收敛**：两端会长期各留一份主文件（本技能就因此在 Windows legacy 侧冻结了 20 天、差 937 行）。发现两处同名文件内容不同时，**必须人工裁决**。
3. 判据**只能**是「剥掉 frontmatter 比正文」；`revision` / `updated_at` / `mtime` / 行数全部不可靠（mtime 是 `sftp.put` 落盘时间）。
4. 收尾验收：**三端 sha256 一致**（size 相同 ⇒ 后续同步判 same ⇒ 不再产生 conflict）。
5. `.conflict.*.bak` 是唯一的自动安全网——清理前先确认无独有信息。

## 机器与别名
- Linux 天阙（`192.168.1.13` / Tailscale `100.79.96.82`）：Windows 侧 `ssh tianque`，key 免密（`~/.ssh/id_ed25519`）。
- Windows 天阙九泉（`192.168.1.16` / Tailscale `100.84.67.49`）：Linux 侧走 paramiko 账密，dsh-gate 用 `ssh tqjq` 别名。
- skill 计数：`.reasonix` 98 项 vs Roaming/Linux 97 项（差 `ai-vibe-writing-skills`，2026-09-30 未处理）。
