---
id: mem-4e30fdb224ab0f7cf5ab1dd4f1fabea1
revision: 3
created_at: "2026-09-20T01:27:40.78676Z"
updated_at: "2026-09-27T15:10:15.048Z"
name: tool-dsh-maxtokens-config-20260920
description: "dsh maxTokens 配置（defaultMaxTokens 65536 + 4 模型 262144）值仍成立，但配置位置已从 ~/.dsh/settings.yaml（0.1.5 时代）迁到 profile cordis 层；生效模型为 commandcode-goat/deepseek-v4.1-flash"
metadata:
  type: user
  fact_type: reference
  scope: global
---

## 结论（2026-09-27 实测）

**配置值全部成立，且已超出当初记录**——但**路径已过时**：

| 项 | 2026-09-20 记录 | 2026-09-27 实测（生效值） |
|---|---|---|
| 配置位置 | `~/.dsh/settings.yaml` | **该文件已不存在**。生效配置在 **profile 的 cordis 层**，用 `dsh --profile web --dump-config` 可读 |
| `defaultMaxTokens` | 65536 | **65536** ✅（dump line 91） |
| 各模型 `maxTokens` | 4 个模型 262144 | **262144** ✅（dump line 167/224/233/242） |
| `agent-default-model` | （当时） | **`provider: commandcode-goat` / `model: deepseek/deepseek-v4.1-flash`** ✅（dump line 50–54） |

**dsh 0.1.7-rc.2 的配置分层**（`~/.dsh` 顶层只剩三个文件）：
- `~/.dsh/.credentials.yaml`
- `~/.dsh/cordis.patch.yml`（deja 写的 MCP/hook 入口，会被读取）
- `~/.dsh/settings.new.yaml`（14511 B，**未被加载**；里面还是 `deepseek-v4-pro` + v4-flash 系列，**无 v4.1** —— 别拿它当现状）
- 历史副本：`~/.dsh/gate/settings-*.yaml`

→ **`~/.dsh/settings.yaml` 是 0.1.5 时代的路径；0.1.7 起模型/maxTokens 由 profile patch 层承担。**

## 复验命令

```bash
ls -l ~/.dsh/settings.yaml                       # 应不存在
timeout 150 dsh --profile web --dump-config 2>/dev/null | grep -nE "agent-default-model|deepseek|maxTokens" | head -20
# 期望看到：provider: commandcode-goat / model: deepseek/deepseek-v4.1-flash
#           defaultMaxTokens: 65536 / maxTokens: 262144
```

## 连带修正

- `deepseek-v4-flash-ga-0731` fact 的"模型 id 不变、零改动生效"仍成立，但**当前生效档位是 v4.1-flash**（2026-09-10 模型铁律：全任务统一 v4.1 flash、pro 弃用）
- GOAT 侧模型清单仍在 `commandcode-goat` provider 的 `models` 列表里（dump line 143 起，含 `deepseek/deepseek-v4.1-flash` 与 v4-flash 系列）
