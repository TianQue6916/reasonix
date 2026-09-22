---
name: reasonix-workspace-mergeback-doctor
description: Reasonix 工作区体检与 Merge-Back 收尾医师 — 定位「工作区被占用 / 合并报错」四类阻断项并按可逆流程修复
---
# Reasonix 工作区体检 / Merge-Back 收尾医师

## 何时自动触发

- 用户说：「工作区被占用」「当前工作区正在被写入」「合并回去报错」「worktree 合并不了」「Merge-Back 失败」
- 界面出现：`当前工作区正在被写入` / `另一个 Reasonix 窗口当前正在写入这个工作区` / `此工作区无法使用安全 Merge-Back` / `以下内容会阻止清理并保留工作区`
- 工具调用失败：`acquire workspace write lease: acquire file lock: context canceled`
- 日志出现：`workspace mutation conflicts with persisted state`

## 核心原则（2026-09-22 纠偏，最重要的一条）

Reasonix 原生原则：**只排除「可再生的依赖 / 缓存 / 运行时产物」；你的数据全部纳入版本控制。**

理由：worktree 隔离的副本**来自 git 索引** → 数据不提交，新会话在独立工作区里就看不到这些文件。

**绝不要用「把未提交项排除掉」去换 porcelain=0** —— 那只买到 `git status` 干净的假象，却让隔离副本残缺，
恰恰是「工作区像被占用 / 新会话里看不到文件」的来源。2026-09-22 我犯过这个错，已纠偏。

## 第一步：体检（零写入）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Desktop\reasonix-ops\reasonix-doctor.ps1"
```

## 第二步：四条阻断项对症

| 界面文案 | 实质 | 处置 |
|---|---|---|
| `worktree has uncommitted changes` | worktree 内有未提交/未忽略文件 | `-Heal -CommitBaseline` |
| `the recorded source checkout has uncommitted changes` | 源 checkout `git status` 非空 | `-Heal -CommitBaseline`（**提交它，不是排除它**） |
| `a source or worktree runtime still has active or waiting work` | 有会话正在该 worktree 里跑（`task.lock` 存在） | **结束会话后重试** |
| `tracked, untracked, or ignored files would be preserved` | worktree 内 `.reasonix\tasks\**` 日志（ignored 也算） | `-Heal -IncludeTaskLogs` |

`-IncludeTaskLogs` 会先把任务日志复制到 `backup\<时间戳>\task-logs\` 再删除。
`-ExcludeAll` 是**已废弃的旧行为**（排除一切），仅在明确「只要 porcelain=0」时用，且要说明它会让副本残缺。

## 第三步：判读要点（别误判）

- 面板显示 **领先 0 · 落后 0** 且 **+0/-0 行** → 该 worktree 没有可合并的代码内容，卡住的是「收尾清理」而非代码冲突，不要去找"冲突"。
- `baseline snapshot` 提交（commit message `chore: Reasonix baseline snapshot`，作者 `Reasonix Autosave`）与 UI 的「自动提交工作区未提交修改」是**同一机制、方向正确**，不是事故；它保证 worktree 副本完整。
- 「active work」那条是**正常保护**：合并会切换/删除 checkout，会话在跑时本就该被拦。
- **先读 `.git\info\exclude` 的内容再动手**：它可能被 Reasonix 重写（2026-09-21 被重写为「只排除依赖/缓存」的 26 行版）。

## 硬约束（违反视为错误）

1. 不 `push` / 不改 `config.toml` / 不重启应用 / 不删用户数据文件
2. 任何写操作前先备份（脚本自动备份到 `backup\<时间戳>\`）
3. 排除规则只写「依赖 / 缓存 / 运行时」；用 `ExcludeAll` 必须显式且说明代价
4. 中文路径规则用 `Get-ChildItem` 的**真实 Unicode 名**；git 的 `core.quotepath` 转义名不可直接采纳
5. 「要不要把某类文件纳入 git」这种版本管理决策交用户拍板，不擅自 commit

## 已知根因速查

- 写隔离粒度 = **workspace（workspaceRoot）**，租约 key 解析**最近的 `.git`** → 同仓库根及其子目录共享一个写者域（「不同项目文件也冲突」的官方根因）
- 租约在**首次变更时获取**并**贯穿 participating agents 与后台任务** → 后台化 ≠ 释放锁
- 官方立场（issue #8990）：**不**放开同区并发写；解法是 **worktree 隔离**（`Separate linked worktrees retain independent writer domains`）
- worktree 创建**前提**：source checkout 必须干净（有未提交/未跟踪会被拒建）
- worktree 创建**不复制未提交改动**（官方文案 `projectTree.worktreeCreatedDirty`）→ 这就是"数据必须提交"的根本原因
- 官方 open issue：#9077（回合结束仍占用 → 重启 reasonix-desktop）、#10509（state 层冲突）
- 相关记忆：`reasonix-workspace-lease-official-solutions`、`reasonix-workspace-write-lease-mechanism`、`reasonix-workspace-doctor-toolkit`
