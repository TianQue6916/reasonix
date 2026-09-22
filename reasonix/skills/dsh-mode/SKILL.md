---
name: dsh-mode
description: DeepSeek Harness (dsh) 模式大全——headless/web profile、native/code/both 工具呈现、首轮锚定极简机制、anchored-standard 预设、插件管理、DSH↔Reasonix 双向集成。需要调 dsh、走 harness、开创造模式、装插件、查会话日志时触发。
version: 1.1.0
---

# dsh-mode — DeepSeek Harness 模式与集成手册

> ## ⚠️ 当前状态（2026-09-04 用户拍板，以此为准）
> **本机（小电脑）不跑 dsh**（性能不足）——调用 dsh 一律走 `dsh-remote`（本机 `~/.local/bin/dsh-remote`，转发到主力机执行，pro+effort=max）。
> 本文件下述「本机 dsh / ~/.dsh / 本机 8 个 live 会话」等内容均为 **2026-08-16 之前本机实跑时期的原理档案**，仅存档参考，不再作为操作指令。主力机 dsh 机制仍适用（同机锁、settings 备份等）。
> 操作规范见记忆 `工具-dsh并发调度与命令铁律-20260904.md`。
>
> 本技能与 `dsh-gate`（调用钩子）互补：dsh-gate 是「怎么调」，本技能是「有什么模式、什么原理、怎么配」。

## 一、Profile 模式（三种启动形态）

| Profile | 命令 | 用途 | 会话形态 |
|---|---|---|---|
| headless | `dsh --profile headless "任务"` | 单发任务，打印结果退出 | 一次性，无端口 |
| web | `dsh web`（或 `--profile web`） | 浏览器 UI + Web API（http://127.0.0.1:3080） | 常驻服务，可建多会话 |
| tui | `dsh --profile tui` | 终端 UI（本机未装） | — |

**dsh-gate 默认走 headless**（轻量、无端口、适合 Reasonix 调用）。web 模式用于 GUI 会话或需要选 preset 的场景。

## 二、工具呈现模式（Tool Presentation Mode）

`DSH_TOOLS_MODE` 环境变量（headless/web profile 的 `tools` 行均读取）：

| 值 | 含义 | 适用 |
|---|---|---|
| native（默认） | 工具以 function calling 呈现，模型直接调用 | 常规 |
| **code** | **创造模式**：只暴露 `run_code` 传输 + 生成 TypeScript/Python SDK，模型写程序驱动所有工具（SDK 绑定精确类型），只有 run_code 可直接调用 | 复杂编码/多步流水线任务，强制收敛到「执行者」路径 |
| both | 两种形式都有，native 调用也可执行 | 混合 |

启用方式：
```bash
# 命令行
DSH_TOOLS_MODE=code dsh --profile headless "任务"
# 或通过 dsh-gate
dsh-gate --mode code "任务"
dsh-gate --mode code --pro "创造模式深度任务"
```

## 三、首轮锚定极简机制（2026-08-16 已启用）

headless profile 已打锚定 patch（`~/.dsh/profiles/headless/cordis.patch.yml`）：

- **首轮**只暴露 Minimal 工具对 `bash` + `str_replace_editor`，persona = `You are a helpful software engineer assistant.`（与官方 Minimal 逐字节一致）
- 会话出现首次持久晋升信号（tool/call 或 assistant/message，先到者）后开放全量工具目录
- 首轮自动剥离技能目录提醒 + 工作区指令摘要（True Minimal 不挂载）
- 原理：V4 Pro 对首轮 API 可见工具目录强条件化——Minimal schema 5/5 锚定 "We need" 轨迹（let me≈0），Standard 25 工具 schema 11/11 落入 standard-like（"Let me" 漫游）。来源：xiaobright/dsh-anchored-standard（Project2 实测 98/99 vs Standard 91）

**验证锚定是否生效**：
```bash
# 跑一个任务后检查最新会话日志
zstd -dc ~/.dsh/sessions/*/session-*/session.jsonl.zstd | python3 ~/.reasonix/global-workspace/scripts/dsh-analysis/analyze-session.py -
# 首个 request/header 的 tools 应为 ['bash', 'str_replace_editor']
```

## 四、anchored-standard 预设（web 用）

已安装到 `~/.dsh/.agent-presets/anchored-standard`（目录复制，无编译）。
用法：`dsh web` 启动 → 新建会话 → 选择 **Anchored Standard (experimental)**。
特性：首轮 Minimal 工具对 + minimal persona；晋升后 resident 集 = bootstrap 对 + 3 个发现工具（dev_tool_search / skill_search / skill_load），重型工具按需解锁；压缩后回到受控阶段。

## 五、插件管理

```bash
dsh plugin --profile web add <包名|目录>   # 装插件
dsh plugin --profile web list             # 列出（当前：dsh-hooks / dsh-llm-fallbacks / dsh-model-router）
```
- 插件装在 `~/.dsh/profiles/web/package.json` 的 dependencies + bundles
- 官方包解析自 dsh 主包 node_modules（@deepseek-ai/dsh-* 全套 100+ 包已内置）
- ⚠️ 改 profile 的 cordis.patch.yml 前先备份（`cp xxx xxx.bak-YYYYMMDD`）

## 六、模型与成本铁律（与 Reasonix 全局一致）

- 简单任务 → `deepseek-v4.1-flash` + high（省钱）
- 难任务/需 pro → `deepseek-v4-pro` + max（必须走 dsh-gate，不直接用 Reasonix 内置）
- ⚠️ **2026-09-09 起禁止关键词自动判定**（用户拍板）：dsh-gate/dsh-gate-conc 已删除 HARD_PATTERNS——调用方必须显式 `-pro` / `-m <model>` / `-e <effort>`，缺 model 即报错 exit 2。选型由 Reasonix agent 按真实难度判断，不靠任务文本关键词猜。
- ⚠️ **dsh-gate 并发说明（2026-09-04 新架构）**：旧版临时改写 `~/.dsh/settings.yaml`（trap 恢复）不可并发；现行 conc 版用独立 settings 副本可并发（见 dsh-gate 技能）

## 七、DSH ↔ Reasonix 双向集成

| 方向 | 机制 | 状态 |
|---|---|---|
| Reasonix → DSH | `dsh-gate` 钩子：难任务/需 pro 自动调 DSH headless，只整合结果不重复推理 | ✅ |
| DSH → Reasonix 记忆 | dsh-gate 注入 `~/.reasonix/memory` 目录（含画像），DSH 按需读取 | ✅ |
| DSH → Reasonix 技能 | dsh-skill-filesystem 的 `customSkillDirs` 指向 `~/.reasonix/skills`，skill_search/skill_load 可发现 | 可配 |
| DSH 输出落盘 | 本机 `/tmp/dsh-gate/`，主力机 `%TEMP%\dsh-gate\` | ✅ |

## 八、会话日志分析工具

`~/.reasonix/global-workspace/scripts/dsh-analysis/`：
- `analyze-session.py <jsonl>` — 打印每个 request/header 的模型、effort、工具目录、system 开头
- `fingerprint2.py <jsonl>` — 统计 reasoning 指纹（we / let's / let me）与字符数
- `dump-event.py <jsonl> <type> [n]` — dump 指定类型事件
- `summary.py <jsonl>` — 事件类型分布 + 最后事件 + error

用法：`zstd -dc <session.jsonl.zstd> > /tmp/x.jsonl && python3 analyze-session.py /tmp/x.jsonl`

## 九、已知坑

1. dev-sidecar 死代理会挂 npm（已清用户级代理变量）
2. headless 无 preset 选择——锚定靠 profile patch；web 才有 preset 选择
3. 会话日志按 cwd 分组：`~/.dsh/sessions/<cwd-encoded>/`
4. 本机 dsh 在 `~/.local/node22/bin/dsh`（系统 node 18 未动），主力机在 npm 全局

## 十、2026-08-16 实测事实（v1.1 新增，防止错误结论扩散）

1. **锚定机制生效但轨迹未迁移**：本机 8 个 live 会话首请求 tools=2（bash+str_replace_editor）100% 生效，但 reasoning 首行全部 "Let me …"（let_me=6~143），**无一 "We need"**。上游 98/99（Project2 英文编码任务）在本机中文架构任务上**不成立**。正确预期：锚定 = 首轮噪声隔离与成本结构优化，**不是**轨迹风格保证；不要以 we/let me 指纹作为本机 dsh 健康度指标。
2. **settings.yaml 中继状态**：dsh-gate 运行时临时改写 settings.yaml（trap EXIT INT TERM 恢复）；SIGKILL/断电会残留 pro+max，下个简单任务烧 pro。已加固：flock 并发锁（同机第二实例 exit 9）+ 启动预检（发现 .bak 即恢复）。**dsh-gate 同机不可并发**。
3. **三插件实态**：dsh-hooks 0.2.2 原本未配（2026-08-16 已补 turn/end 落盘）、dsh-llm-fallbacks 0.1.4 默认关（已补 settings.yaml `fallbacks:` 节，pro 失败降 flash）、dsh-model-router 0.8.1 auto 保留。
4. **routing-suite 结论**：不装。issue #13（首轮路由结构性失效，所有会话首轮落 weak）+ PR #10 只修 near-field + 与 dsh-gate 功能重叠。复查触发：issue #13 关闭 + 官方 rc.7 发布后再评估。（注：dsh-gate 的 HARD_PATTERNS 关键词判定已于 2026-09-09 废除，routing-suite 更无重叠价值）

## 十一、2026-09-11 实测事实（长任务必须 --async；-e 曾长期失效）

> 起因：用户报告 agent 调主力机 dsh 时「通知也没了」+「经常失败」。以下均有双机对照实验支撑。

### 1. 同步调用在 ~167s 丢失结果 —— 长任务必须 `--async`
同一任务/模型/`-e high` 的决定性对照：

| 调用方式 | 结果 | 耗时 | 输出 |
|---|---|---|---|
| 同步 `dsh-remote`（SSH 前台） | ❌ `rc=1` | 167s | **0 字节（stdout+stderr 全空）** |
| `--async`（schtasks 脱离 SSH 会话） | ✅ `done` | **192s** | 6426 字节 |

唯一变量是**进程树归属**。此项是 `-Async` 机制（本文件第一节）的强力佐证：不仅"S​SH 断开时保命"，**长任务在 SSH 前台本身就不可靠**。

已逐项排除：
- **API 上游**：同 prompt 用 curl 直打 `api.commandcode.ai`（走 dev-sidecar 代理）→ **148s / HTTP 200 / 10.37MB 成功**
- **dev-sidecar 代理**：`curl --noproxy '*'` 亦正常
- **Node 内存**：`NODE_OPTIONS=--max-old-space-size=8192` 无效，仍 167s `rc=1`
- **SSH/TCP/保活**：同 IP 字面量方式 SSH 空跑 **210s 后 `rc=0` 返回**
- **传参/长度/并发**：手动直调 `dsh --profile headless --patch ...`（绕过 dsh-remote）同样 168s `rc=1`；2462 字符占位任务成功

失败耗时刚性集中在 164–181s，成功 4–199s；失败时**零诊断输出**（= 进程被外部终止、来不及 flush）。
**操作结论：预计 >90 秒的任务一律 `--async`。**

### 2. `-e/--effort` 曾长期完全失效（2026-09-11 已修）
- 根因：`settings.yaml` 的 `agent-default-model:` 段**没有 `reasoningEffort:` 键**，而 `dsh-gate-conc.ps1` 只用
  `-replace '(?m)^  reasoningEffort: .*$'` → **静默空转**（无匹配即无操作、不报错）。
- 铁证：`-e high` 与 `-e off` 生成的 settings 副本 **SHA256 完全相同**。「用 `-e` 区分算力」此前是空文。
- 修复：`settings.yaml` 补 `reasoningEffort: high`；脚本改为**按键存在性判断**+写入校验。
- 验证：`-e off` → hash `C895E599…`，`-e max` → `hash D520EF91…`，两副本不同 ✔

### 3. 踩坑（自引入后已修，务必记住）
第一版修复用「`-replace` 前后是否变化」判断键是否存在；当 `-Effort` 恰好等于原值（`high`）时替换结果不变 →
误判为「无该键」→ **重复插入 → `DUPLICATE_KEY at line 7` → dsh 启动即失败（2s、4158B 报错）**。
**判断 YAML 键存在性必须用 `-match`，不能靠替换前后差异。**

### 4. 失败可见化（已落地）
`dsh-gate-conc.ps1` 现在把 `rc / 耗时 / 输出字节` 写进 `status.note`，并落盘 `.diag.txt`（含原始 stdout+stderr）。
实测输出形如 `完成 192s 6426B`、`失败 rc=1 0s 输出=5B`。此前只写"失败"，等于无信息。

### 5. 通知约束（已落地）
通知链路本身完好（本机 `notify-send` + 主力机反向 SSH 均实测发出横幅）。
「通知没了」的真因是**调用方在 9 处调用上全加了 `--no-notify`**。
**铁律：除非用户明确要求静默，禁止 `--no-notify`。**

### 6. 未钉死项
~167s 这个数字的**最底层触发者**（为何 167s 而非 SSH 实测的 210s 上限）未定位到具体代码行；
现象、边界与规避方案已被对照实验确定，规避方案（`--async`）已实测有效。
