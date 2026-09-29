# 记忆索引 MEMORY.md（2026-09-24 双机统一版）

> **2026-09-24 双机合并**：Linux 分类精简版 + Windows 增量列表版合并为唯一权威索引，覆盖 `memory/global` 全部记忆。此后两端共用本文件，不再各自维护列表。
> **历史**：2026-08-16 记忆优化 59 → 26（-56%），原文全部在 `~/.reasonix/memory-archive-20260816/`（信息零丢失）；`memory-backup-20260816*/` 为全量备份；旧索引条目保留于 `.archive` / `.revisions`。

## 一、元规则与核心身份（6）
- [元规则-01-Reasonix核心身份](元规则-01-Reasonix核心身份.md) — 核心身份/只改名不改内容/标准化命名体系/会话分类 + 任务前画像校验逻辑
- [元规则-02-自动记忆规则](元规则-02-自动记忆规则.md) — 重要操作后自动 remember 的触发场景与格式
- [元规则-03-技能路由](元规则-03-技能路由.md) — 22 技能强制路由映射（2026-08-16 v2，技能精简后重写）
- [元规则-Reasonix核心身份](元规则-Reasonix核心身份.md) — 同上（旧命名版，保留溯源）
- [元规则-自动记忆规则](元规则-自动记忆规则.md) — 同上（旧命名版，保留溯源）
- [元规则-技能路由16条](元规则-技能路由16条.md) — 16 场景 Skill 自动触发映射（旧命名版）

## 二、用户画像与输出规范（8）
- [user-persona-cognitive-system-architect](user-persona-cognitive-system-architect.md) — 用户完整画像：v3.0 量化版 + 2026-09-23 Linux 侧重写版（认知操作系统/终局目标/当前阶段定位）+ 学业水平与教学适配，三版已归一（2026-09-27）
- [academic-level-and-teaching-style](academic-level-and-teaching-style.md) — 各学科当前水平、教材、阶段与最佳教学方式（大二上前窗口期）
- [use-user-persona-before-tasks](use-user-persona-before-tasks.md) — 铁律：翻译/教学/方案/代码等实质任务前先调画像校验输出
- [v4pro-for-complex-reasoning](v4pro-for-complex-reasoning.md) — 复杂推理场景可用更强模型（历史授权，现执行 2026-09-10 模型铁律）
- [输出规范](输出规范.md) — 默认输出目录 + MarkText 讨论模式
- [default-output-directory](default-output-directory.md) — 默认输出路径 `/home/tianque/桌面/输出文件/`
- [discussion-reply-in-marktext-md](discussion-reply-in-marktext-md.md) — 数学符号类讨论：写自由命名 md + marktext 打开，格式循双语规范
- [share-file-with-user-via-wps](share-file-with-user-via-wps.md) — 文件就绪直接用 WPS 打开（自动云同步到手机）；微信通道不支持发文件

## 三、API / 模型 / dsh 路由（16）
- [api-调用默认-command-code-goat](api-调用默认-command-code-goat-套餐-key-而非-deepseek-官方.md) — API 默认 Command Code GOAT；2026-09-09 官方 web_search 隔离 + dsh 强制显式铁律
- [commandcode-goat-额度查询端点与看板工具](commandcode-goat-额度查询端点与看板工具.md) — GOAT 额度（5小时/周/月）官方端点 + 本地看板 goat-usage.ps1（2026-09-23 打通）
- [github-public-备份泄露-goat-key-事件与根因修复](github-public-备份泄露-goat-key-事件与根因修复-2026-09-23.md) — user_ 前缀 key 明文躺 public 仓库约 3 个月：两个根因、已完成修复与历史清理、待轮换 key
- [deepseek-v4-flash-ga-0731](deepseek-v4-flash-ga-0731.md) — V4 Flash 正式版 0731 同名原地升级，模型 id 不变，Reasonix 零改动生效
- [dsh-gate-双机路由铁律](dsh-gate-双机路由铁律.md) — Pro 强制走 dsh + 双机分工铁律（模型铁律已更新：pro 弃用、统一 v4.1 flash）
- [dsh-gate-双机配置档案](dsh-gate-双机配置档案.md) — DSH 双机安装/演进/锚定/创造模式/并发禁令档案
- [dsh-gate-dual-machine-setup](dsh-gate-dual-machine-setup.md) — DeepSeek Harness 双机配置 + dsh-gate 决策钩子完整档案
- [dsh-调用-通知丢失-频繁失败-根因与修复](dsh-调用-通知丢失-频繁失败-根因与修复-2026-09-11-实测锁定.md) — 2026-09-11 实测锁定根因与修复
- [工具-dsh并发调度与命令铁律-20260904](工具-dsh并发调度与命令铁律-20260904.md) — dsh 并发调度与命令铁律（2026-09-04）
- [tool-dsh-015-upgrade-20260920](tool-dsh-015-upgrade-20260920.md) — dsh 0.1.1-rc.2 → 0.1.5-rc.2 升级：四处必改、插件面核查、双路径端到端验证、回滚法、双机待办
- [tool-dsh-maxtokens-config-20260920](tool-dsh-maxtokens-config-20260920.md) — dsh maxTokens 配置（defaultMaxTokens 65536 + 4 模型 262144）值仍成立，但配置位置已从 ~/.dsh/settings.yaml（0.1.5 时代）迁到 profile cordis 层；生效模型为 commandcode-goat/deepseek-v4.1-flash
- [tool-dsh-stream-interrupt-retry-20260920](tool-dsh-stream-interrupt-retry-20260920.md) — 流式中断（TRANSPORT）两档重试策略、-AlwaysRetry 落地、上游 issue 与 headless 无 resume 硬限制
- [tool-dsh-infinite-gen4-web-install](tool-dsh-infinite-gen4-web-install.md) — dsh「无限四代」插件 web profile 装卸档案：2026-09-23 已完整卸载，含 junction 坑与三重验证法
- [skill-安装-无限四代载荷存档](skill-安装-无限四代载荷存档.md) — 无限四代事件全档案（已全部卸载）：诉求演变、拒绝边界、`✗ 购买授权` 真实含义
- [meta-secret-redaction-select-string-pitfall](meta-secret-redaction-select-string-pitfall.md) — 教训：Select-String 校验含密钥配置会打印整行，key 明文进会话记录；含正确脱敏写法
- [dsh skills and memory bridge 20260926](dsh-skills-and-memory-bridge-20260926.md) — [global/reference] dsh web 与 reasonix 共用技能与记忆已落地：80 个技能镜像生效（分片验证通过）+ 只读记忆插件 memory_search/memory_read 已挂载（待重启 web 生效）

## 四、双机与远程控制（4）
- [windows-main-machine-full](windows-main-machine-full.md) — 主力机「天阙九泉」完整远控信息（SSH + RustDesk + IPv6），唯一凭据源
- [tailscale-tianque-jiuquan-mesh](tailscale-tianque-jiuquan-mesh.md) — Tailscale 组网：Linux 100.79.96.82 / Windows 100.84.67.49，开机自启与安装坑
- [ssh-passwordless-and-tool-skills-20260804](ssh-passwordless-and-tool-skills-20260804.md) — 免密 SSH（tqjq/天阙九泉）+ skill shadow 修复 + 3 个工具 skill
- [工具-网络与远程](工具-网络与远程.md) — Tailscale/SSH/dev-sidecar 网络与远程配置汇总

## 五、Reasonix 本体：工作区 / 并发 / 系统（19）
- [reasonix-32-parallel-limit-and-translation-division](reasonix-32-parallel-limit-and-translation-division.md) — 单批 ≤32 并行；模型铁律（2026-09-10）：全任务统一 v4.1 flash；全资源搜索
- [reasonix-多并发-长任务后台化规范](reasonix-多并发-长任务后台化规范.md) — 长任务后台化+写工作区外+会话长度控制；两个阻塞错误的根因与解法
- [reasonix-launcher-layout-migrate-fix](reasonix-launcher-layout-migrate-fix.md) — Linux 侧边栏启动失败：launcher 迁移缺 reasonix-cli 的根因与两步修复
- [reasonix-launcher-blocked-by-session0-name-collision](reasonix-launcher-blocked-by-session0-name-collision.md) — 点图标无反应：Session 0 bot 与 launcher 撞镜像名，改名隔离治本
- [reasonix-project-toml-sandbox-path-pitfall](reasonix-project-toml-sandbox-path-pitfall.md) — read_file 总失败：项目级 reasonix.toml 用 ${HOME} 跨平台路径致沙箱 canonicalize 失败
- [reasonix-workspace-write-lease-mechanism](reasonix-workspace-write-lease-mechanism.md) — 写锁真实粒度是「工作区」非文件；冲突根因 = 机制设计 + Windows 侧工作区未瘦身
- [reasonix-workspace-lease-official-solutions](reasonix-workspace-lease-official-solutions.md) — 工作区占用官方机制原文 + 三类型区分 + 解法清单，勘误 8/16 记忆两处
- [reasonix-global-workspace-index-cleanup-20260921](reasonix-global-workspace-index-cleanup-20260921.md) — 两轮清理使 Merge-Back 两条阻断项归零；第三条 = 活动会话；30 个 tasks 日志清理
- [reasonix-workspace-doctor-toolkit](reasonix-workspace-doctor-toolkit.md) — reasonix-ops 工具包（脚本+README+自动触发技能）：可逆修复「工作区被占用」四条阻断项
- [reasonix-workspace-autocommit-verification-20260923](reasonix-workspace-autocommit-verification-20260923.md) — 真正修复体 = reasonix-autocommit.ps1 + 每 2 分钟计划任务（排他证据），并纠正方向性错误
- [workspace-write-lag-fix](workspace-write-lag-fix.md) — 工作区写入卡顿修复（含双机同步 cron 09/14/21 点全量 walk）
- [tool-github-daily-backup-reasonix-dsh-zcode-trae](tool-github-daily-backup-reasonix-dsh-zcode-trae.md) — GitHub 每日备份机制：reasonix + tool-box 仓库 + 23:30 计划任务 + 强制脱敏 + 3 个脚本 bug 修法
- [系统-Linux配置档案](系统-Linux配置档案.md) — Linux 本机系统配置与踩坑档案（NTFS 挂载/desktop 坑/launcher 修复/同步 cron）
- [linux-ntfs-automount-media-os](linux-ntfs-automount-media-os.md) — NTFS C 盘开机自动挂载到 /media/OS（fstab + systemd 验证通过），含 sudo -S 管道陷阱
- [desktop-exec-gio-parsing-pitfall](desktop-exec-gio-parsing-pitfall.md) — .desktop 三坑：Exec 禁 \" 转义、gio trusted 标记、检查脚本用 echo;read 停窗
- [dev-sidecar-ca-installed](dev-sidecar-ca-installed.md) — dev-sidecar 证书两步安装法，含 pkill 自伤与 sudo 无终端教训
- [dev-sidecar-覆盖-gitconfig-与-npmrc-URL级配置绕过-20260927](dev-sidecar-覆盖-gitconfig-与-npmrc-URL级配置绕过-20260927.md) — **它每次启动都重写 .gitconfig/.npmrc 的代理项（手改必被覆盖）**；用 URL 级 `http.<url>.proxy` 绕过 + release 走镜像的实测数据 + ghdl/ghurl
- [github-加速体系与镜像自动选优-20260927](github-加速体系与镜像自动选优-20260927.md) — GitHub 加速三路径体系 + 镜像生态三类分化实测 + 自动化盘点 + 8 个踩坑。【2026-09-27 更正】git 侧不是固定 gh-proxy.com，而是由 ~/.ghmirror-git 每日选优决定（当前 edgeone.gh-proxy.org），与 gitconfig insteadOf 一致
- [meta-20260816-optimization](meta-20260816-optimization.md) — 2026-08-16 全系统优化总览（技能精简/记忆优化/dsh 锚定与创造模式/思维链实验）

## 六、翻译与文档处理流水线（16）
- [bilingual-ocw-translator-refactored-v2](bilingual-ocw-translator-refactored-v2.md) — 技能重构为 11 章单文件 v2.0：铁律前置/双审计/全资源搜索；双机同步以 Linux 版为准
- [bilingual-ocw-translator-v21-backup-iron-rule](bilingual-ocw-translator-v21-backup-iron-rule.md) — v2.1 新增铁律 19：每一步备份（5 个必做备份点，快照 ≥3 份）
- [bilingual-ocw-translator-版本与铁律索引](bilingual-ocw-translator-版本与铁律索引.md) — 技能版本/铁律/教训索引（技能本体为准，此处留溯源与路径）
- [bilingual-translator-no-en-zh-blocks](bilingual-translator-no-en-zh-blocks.md) — 核心禁令：禁止英中分段对照，必须中文主体 + 英文术语行内嵌入
- [bilingual-translator-实战铁律5条](bilingual-translator-实战铁律5条.md) — 英文不开句、无箭头对照、术语仅首次加括号、不合并句子、LaTeX 内不翻译
- [bilingual-translator-output-path](bilingual-translator-output-path.md) — 双语翻译默认输出路径 `/home/tianque/桌面/课程文件/`
- [strang-translation-lessons](strang-translation-lessons.md) — Strang 翻译教训：子 agent 四类陷阱 + 亲自逐句翻译优于子 agent
- [strang-part002-translation-complete](strang-part002-translation-complete.md) — Strang LaLFD part002（p51-100）双语翻译：范围、流程资产、OCR 工具链、成本经验
- [subtitleedit-skill-created](subtitleedit-skill-created.md) — SubtitleEdit 批量翻译流程验证（zh-CN 文档 + 另存为 Enter）与恢复步骤
- [tool-subtitleedit-goat-api-20260920](tool-subtitleedit-goat-api-20260920.md) — SubtitleEdit 引擎改指 GOAT：Settings.json 三字段、实测数据、两个验证坑、回退法
- [csapp summary methodology](csapp-summary-methodology.md) — [global/feedback pinned] CSAPP方舟复述方法论——设计问题驱动+跨课程连接+事实核查的课程总结标准
- [扫描件整理方法论-按章合并成册-带书签-dhash-去重-ocr-页码不可用于排序-名字与内容不符需抽查](扫描件整理方法论-按章合并成册-带书签-dhash-去重-ocr-页码不可用于排序-名字与内容不符需抽查.md) — 扫描件整理方法论：按章合并成册（带书签）+ dHash 去重；OCR 页码不可排序
- [空壳-word-占位文档识别与清理-判定标准-6-042j-547-5-文件-md5-不同-内容不同的教训](空壳-word-占位文档识别与清理-判定标准-6-042j-547-5-文件-md5-不同-内容不同的教训.md) — 空壳 Word 识别与清理判定标准；6.042J 547→5 文件；MD5 不同 ≠ 内容不同
- [wps-知识库-kdocs-wiki-完整抓取与下载方法-2026-09-23-课程资料推-github-进度](wps-知识库-kdocs-wiki-完整抓取与下载方法-2026-09-23-课程资料推-github-进度.md) — WPS 知识库（kdocs wiki）完整抓取下载方法 + 课程资料推 GitHub 进度
- [2026-09-23-课程仓库整理阶段-cpplearning-迁至-codetry-重复文件清理-名字与内容不符修正-information-theory-清理](2026-09-23-课程仓库整理阶段-cpplearning-迁至-codetry-重复文件清理-名字与内容不符修正-information-theory-清理.md) — CppLearning 迁至 codetry、重复文件清理、名字与内容不符修正
- [2026-09-23-第三阶段-视觉核对扫描件-按真实页码重排-空-docx-骨架合并为章节索引-wps-脚本交付-kdocs-pull-ps1](2026-09-23-第三阶段-视觉核对扫描件-按真实页码重排-空-docx-骨架合并为章节索引-wps-脚本交付-kdocs-pull-ps1.md) — 视觉核对扫描件、按真实页码重排、空 docx 骨架合并、kdocs-pull.ps1 交付

## 七、技能安装与归档（6）
- [技能-安装与归档历史](技能-安装与归档历史.md) — 技能安装历史（溯源用）
- [技能安装-第二批4个技能](技能安装-第二批4个技能.md) — 计划管理 + 开发方法论 + 幻灯片 + 浏览器自动化
- [技能安装-第三批AnthropicVercel](技能安装-第三批AnthropicVercel.md) — Anthropic 官方 + Vercel 官方 + 三个合集索引
- [技能安装-演示文稿技能](技能安装-演示文稿技能.md) — 三个由外部仓库转换安装的演示文稿技能
- [技能安装-MattPocock自动触发](技能安装-MattPocock自动触发.md) — Matt Pocock 技能集自动触发规则 + 已安装索引
- [academic research skills](academic-research-skills.md) — [global/reference] ARS 技能包（Claude Code）安装与核心功能备忘

## 八、降 AIGC（4）
- [降AIGC-核心结论](降AIGC-核心结论.md) — 降 AIGC 核心结论与数据（技能 aigc-master 配套）
- [降AIGC-确定性规则替换铁律](降AIGC-确定性规则替换铁律.md) — AI 改写 AI = 叠加指纹；唯一有效的是非 LLM 硬编码替换
- [降AIGC-ACS理工科-ALH文科](降AIGC-ACS理工科-ALH文科.md) — ACS(理工科)+ALH(文科) 技能，基于 25 篇知网论文真实数据
- [降AIGC-10轮实战日志](降AIGC-10轮实战日志.md) — 10 轮降率实战：策略对比与关键教训

## 九、工具与系统（27）
- [工具-离线维基百科](工具-离线维基百科.md) — 离线维基 ZIM 权威路径与搜索代码
- [工具-离线维基51GB-ZIM](工具-离线维基51GB-ZIM.md) — 英文 51.9GB ZIM 自动搜索流程与代码
- [offline wiki autosearch](offline-wiki-autosearch.md) — [global/project] 离线维基百科（英文，51.9GB ZIM）— 自动搜索流程与代码
- [离线维基zim迁移c盘-20260802](离线维基zim迁移c盘-20260802.md) — ZIM 完成 C 盘迁移 + 2026-06 新版升级，含 aria2 断点续传经验
- [工具-Windows工具箱与Codex](工具-Windows工具箱与Codex.md) — D:\Toolbox、Codex、OCR、PPT 工具信息
- [工具-Codex桌面版安装](工具-Codex桌面版安装.md) — Codex Desktop App v26.609.4994.0 安装与配置记录
- [工具-PDF翻译Codex工具箱](工具-PDF翻译Codex工具箱.md) — 工具箱含 PDFMathTranslate + Codex Desktop App 安装包
- [工具-PPT-Word自动生成](工具-PPT-Word自动生成.md) — 全自动 PPT/Word 文档生成工作流
- [工具-工具箱文件夹路径](工具-工具箱文件夹路径.md) — D:\Toolbox\ 快捷方式（内有工具箱.lnk）
- [工具-桌面工具箱快捷方式](工具-桌面工具箱快捷方式.md) — 桌面有工具箱.lnk → D:\Toolbox
- [工具-推荐OCR工具](工具-推荐OCR工具.md) — 推荐 OCR 工具记录
- [工具-B站与影视下载](工具-B站与影视下载.md) — B 站/影视下载方法、源侦察、迅雷清理
- [b站视频下载方法-downkyi-ytdlp](b站视频下载方法-downkyi-ytdlp.md) — DownKyi 登录 cookie + yt-dlp 模板（突破 412，720P 合并）
- [电影下载-B站源侦察与登录刷新-20260815](电影下载-B站源侦察与登录刷新-20260815.md) — 18 部动画电影源侦察 + 登录态刷新 + 可用源清单
- [工具-迅雷Base64下载](工具-迅雷Base64下载.md) — thunder:// 协议 Base64 转换 + PowerShell 推送
- [迅雷下载目录清理-20260805](迅雷下载目录清理-20260805.md) — D:\迅雷下载 清理约 81GB 重复文件（.xltd 自启恢复），含教训
- [chongchong-piano-downloader-linux](chongchong-piano-downloader-linux.md) — 虫虫钢琴下载器：位置、用法、原理、镜像坑、SSH 远控状态
- [tianque-vscode-semester-setup](tianque-vscode-semester-setup.md) — VS Code 33 扩展 + Python 数学库 + shellcheck 学期化配置
- [鲸鱼娘-goat-额度桌面挂件](鲸鱼娘-goat-额度桌面挂件.md) — 鲸鱼娘三人组挂件 v3：分层窗口真透明、400x228、含 6 个 DPI/截屏/编译踩坑
- [tool-ocs-ai-tiku-gateway-20260922](tool-ocs-ai-tiku-gateway-20260922.md) — OCS 题库指向本地 AI 网关（127.0.0.1:8899 → GOAT），含架构、协议、elevated 坑、回滚
- [tool-ocs-ai-tiku-gateway-keepalive-20260922](tool-ocs-ai-tiku-gateway-keepalive-20260922.md) — 网关「用一会儿连接失败」根因排查 + 计划任务与 1 分钟看门狗保活
- [weixin-bot-goat-provider-402-fix](weixin-bot-goat-provider-402-fix.md) — 微信 bot 402：bot home 配置落后于桌面版，已切 GOAT（两处配置面需同步）
- [weixin-bot-turn-hang-and-constrained-bash](weixin-bot-turn-hang-and-constrained-bash.md) — 微信 bot turn 卡死 + bash 被锁 ConstrainedLanguage：改 danger-full-access 并重启
- [daily-kit-git-scratch-and-pushall-20260927](daily-kit-git-scratch-and-pushall-20260927.md) — git 流水区双机落地（Windows D:/00-Inbox + Linux ~/00-Inbox，每天清零→远端 tag）+ pushall 批量推现有 repo；PREFIX=days/win/ 与 days/lin/ 防撞 tag；最大坑 remote.origin.fetch 不限定为 main 会让 gc 完全失效；35 项回归测试全绿
- [github-repo-hygiene-audit-20260927](github-repo-hygiene-audit-20260927.md) — 17 个 repo 审计：learn 563MB VS .ipch 垃圾（从未 push 过）、IT-full 与 Information-Theory 1.3G×2 重复、两组远端冲突
- [reasonix-autocommit-and-github-backup-restored-20260927](reasonix-autocommit-and-github-backup-restored-20260927.md) — reasonix/dsh 自动 commit + GitHub 备份三件套的机制、junction 修复、断档时间线；并记 2026-09-27 发现的 public 仓库凭据泄露（local-search-token 已阻断 / weixin context-tokens 已在库）
- [dsh-hooks-claude-code-setup-and-headless-finding-20260927](dsh-hooks-claude-code-setup-and-headless-finding-20260927.md) — dsh 挂 Claude Code hook 兼容层的做法（cmd wrapper + patch insert）+ 实测 headless 不派发 hook、web 待验；含「N entry did not activate」诊断法与 dsh-mimir 两个原有故障

## 十、学习与计划（9）
- [学习-离散数学](学习-离散数学.md) — 蒸馏：Chernoff Bound 全推导/图论/猜信封/概率流动/公平赌徒（原文 1349 行在 archive）
- [学习-高等数学问答](学习-高等数学问答.md) — 蒸馏：格林/高斯/斯托克斯统一架构、散度旋度通量环量、方向判定（原文 951 行在 archive）
- [学习-CSAPP](学习-CSAPP.md) — 蒸馏：缓存优化（转置/邻接矩阵/对角块）+ 全书目录设计问题映射（原文 788 行在 archive）
- [学习-CSAPP缓存优化](学习-CSAPP缓存优化.md) — CSAPP 深入学习：缓存矩阵、对角块优化等
- [学习-CSAPP目录结构](学习-CSAPP目录结构.md) — CSAPP 全书目录结构解析
- [学习-MIT-6042J回顾](学习-MIT-6042J回顾.md) — MIT 6.042J 离散数学课程前瞻性总结回顾
- [计划-方舟计划](计划-方舟计划.md) — 方舟计划蒸馏版（体系/清单/书目/周循环/财务/健康/档案）
- [计划-方舟计划总结](计划-方舟计划总结.md) — 方舟计划完整总结 + API 配置 + 学习体系规划
- [plan-20260816-second-tianque](plan-20260816-second-tianque.md) — 第二个天阙：大二上六个月学习战略（dsh pro 极简模式端到端测试产出）

## 十一、dsh 侧新增（自动维护）
- [dsh-codex-gap-analysis-and-memory-write-20260926](dsh-codex-gap-analysis-and-memory-write-20260926.md) — dsh 对标 Codex 的缺口清单（sqlite schema 实证）+ 记忆写入能力上线：memory_remember 打通 dsh 到 reasonix 的写入

- [dsh-agent-personalization-20260926](dsh-agent-personalization-20260926.md) — dsh agent 个性化：memory_profile 工具 + 画像加权 + persona 画像锚点，把「实质任务前先调画像」从记忆规则升级为机制
- [dsh-session-index-codex-threads-20260926](dsh-session-index-codex-threads-20260926.md) — dsh session_index 上线（Codex threads 表对应物）：跨 cwd 会话索引，827 个会话扫描 813ms、title 覆盖 99%；并确认 system32 的 640 个是批量任务独立会话
- [dsh-session-digest-ondemand-distill-20260926](dsh-session-digest-ondemand-distill-20260926.md) — dsh session_digest 上线（按需蒸馏会话：任务/轮次/工具调用/结论），并记录「为何不做无条件自动蒸馏」的设计判断
- [dsh-community-plugin-landscape-20260926](dsh-community-plugin-landscape-20260926.md) — dsh 社区插件清单（476 个仓库，含直接对应我缺口的 headroom/token/goal/recall/session-lab）+ 出网限制（web_search 402、bash 无网）+ 「应先调研社区再自写」的流程教训
- [dsh-skill-usage-weighting-20260926](dsh-skill-usage-weighting-20260926.md) — skill_search 加权上线（调用次数 + 时间远近，公式 match + 0.6*(log1p(loads)+exp(-age/14))）；并记录关键事实：两侧历史都没有技能调用数据，账本从零积累
- [rule-star-open-source-usage](rule-star-open-source-usage.md) — 元规则：用过/读过/借鉴过的开源项目必须 star（本次新增 9 个，累计 30）+ 纯 bash 的 star 执行路径
- [dsh-community-landscape-v2-and-powershell-egress-20260926](dsh-community-landscape-v2-and-powershell-egress-20260926.md) — PowerShell 能出网（bash 被禁）这一能力突破 + 社区实况实时数据（topic:dsh-plugin 16,218 个；更正 dsh-desktop 存在、记忆插件 star 量级）+ headroom/deja-vu 等对应方案
- [deja-vu-installed-and-reasonix-bridged-20260926](deja-vu-installed-and-reasonix-bridged-20260926.md) — deja-vu 0.21.2 落地 + 零开发桥接 reasonix（49 会话）；issue #4053 已提交；session-index.mjs 已退役；新配置经 3081 验证通过，3080 待用户择时重启
- [dsh-plugin-batch2-modlens-vision-20260927](dsh-plugin-batch2-modlens-vision-20260927.md) — 装了 modlens（视觉插件，4043★）让纯文本 DeepSeek 能看图；含 14 项候选插件清单与判定；并记录解除了一个卡死 22 分钟的 pnpm 安装
- [correction-deepseek-v41-flash-has-native-vision-20260927](correction-deepseek-v41-flash-has-native-vision-20260927.md) — 纠错：DeepSeek V4.1 Flash 原生多模态（非 text-only），dsh 与 GOAT 网关均支持图片透传；modlens 非必需（仅对确认 text-only 的模型如 v4-pro 生效）
- [network-egress-git-ghproxy-mirrors-20260927](network-egress-git-ghproxy-mirrors-20260927.md) — 【二次订正·已定位真因】curl 的 000 不是连不上、也不是代理死了，而是 dev-sidecar 做 MITM 导致证书信任失败（-v 可见 CONNECT 200 + Proxy-agent: dev-sidecar；curl -k 即 200，git 因 .gitconfig 里 sslVerify=false 而通）；我先前两次误判都源于采样到边车重启窗口；含 URL 级配置绕行正解、000/403/TLS 三分法与「不要重复写别人已写的记忆」纪律
- [dsh-batch3-headroom-mimir-and-codex-gap-recheck-20260927](dsh-batch3-headroom-mimir-and-codex-gap-recheck-20260927.md) — 插件第三批：卸 modlens（手工改 4 处 + 删 .bin shim，并回收 commander/undici）、装 headroom 0.3.0（工具输出可逆压缩）与 Mimir 0.21.0（学术工作台）；用 282 个官方包实证复核 Codex 缺口 #4-#7 全部仍未闭合及社区填充；收录 awesome-dsh-plugins 每日兼容性追踪等社区目录
- [dev-tool-search-false-unlock-fix-and-preset-reload-boundary-20260927](dev-tool-search-false-unlock-fix-and-preset-reload-boundary-20260927.md) — dev_tool_search 谎报解锁的 bug（无条件回显入参、零校验）已修，10 个单元用例 + 真机 headless 端到端双验证（假名 NOT unlocked / 真名解锁且 memory_profile 真的进了下一轮 request header）；实测 preset 热重载边界（新 row 对新 session 即时生效、改文件内容不进已有 session）；memory_* 已写进 UNLOCKABLE_INDEX；顺带查出 headless 线是半套配置（旧 persona、无 memory/skill），未改待决策
- [headless-profile-degraded-3-tools-no-persona-20260927](headless-profile-degraded-3-tools-no-persona-20260927.md) — 【已修复并验证】headless 批处理线（798 session / 95% 流量）原先只有 3 个工具、无 read/write、system prompt 里 persona 那行是**静默 no-op**（正确字段是 personaPrefix，z.object 非 strict 会丢弃未知 key）；已同步语言契约 + dev-tool-search/skill-search/memory 三条 row，实测工具面 3→6→8、read/write 可解锁、契约让全英文指令得到中文回答；含「模型无法内省自己的工具清单」的假阳性与「中途新增的工具会被漏看」
- [dsh-mimir-incompatible-with-017rc2-typert-codec-20260927](dsh-mimir-incompatible-with-017rc2-typert-codec-20260927.md) — dsh-mimir 0.21.0 与 dsh 0.1.7-rc.2 不兼容：typert-loader 的 requireStrictCodec 要求 invocation codec 带 create() 工厂，Mimir 的 research/addEvidenceEdge 没有 → boot 时 1 entry did not activate，用户侧表现为「插件都没有、全是故障」；因 3080 启动早于 Mimir 安装所以只有新起实例才暴露；已按 4 处卸载并验证（boot 日志干净 + index 页插件 client bundle 198 条含第三方、mimir 残留 0）；含「数组最后一项无尾逗号导致正则失配 + assert 在写入前 → 破损态」的坑与「判据要用 index 页 plugins 清单」的升级
- [deja-vu-issue-4053-implemented-upstream-not-yet-released-20260927](deja-vu-issue-4053-implemented-upstream-not-yet-released-20260927.md) — deja-vu issue #4053 被维护者直接实现并合入（aa900c96 + f9af3803 引用 #4053/#4067 后关闭，0 评论）：新增 internal/sources/reasonix.go +489 等 167->217 文件，Reasonix 成为一等支持的 store 并接上 MCP/skill/sidecar 扩展；但尚未发版（release v0.21.2 / nightly ddda1c05 均早于该提交，npm latest 仍是 0.21.2），本机暂用 DEJA_COMMANDCODE_ROOT 绕行
- [verification-fixes-and-tests-20260927](verification-fixes-and-tests-20260927.md) — 近三天核验中 4 个可修缺陷的修复与测试闭环 + 可重复运行的验收脚本 verify-4-fixes.sh（19 条判据，实测 PASS=19 FAIL=0）：backup-to-github.ps1 副本一致（junction + 两份真实副本，缺 user_ 脱敏与 3b 全量扫描已同步）、github 加速 fact 与实现一致（gh-proxy.com 硬编码 -> 指向 ~/.ghmirror-git）、skill 用量加权端到端可用（账本生成 + A/B 排序改变）、3080 开机自启（任务 Ready/LogonTrigger/IgnoreNew + 冷启动 5.45s + 幂等 2s 返回）。含四条元教训：判据写错会伪装成产品缺陷（当天犯了 4 次）、配置类 fact 应指向真相文件、同一失效模式跨层传导
- [goat-额度面板事故复盘-hook-timeout-单位与-dsh-刷新验证](goat-额度面板事故复盘-hook-timeout-单位与-dsh-刷新验证.md) — 两个事故的根因与修法：Reasonix hook 的 timeout 单位是毫秒（15 会中断会话，已修为 15000 并移除 UserPromptSubmit）；dsh 面板不刷新的真因。【2026-09-27 更正】原文写 REFRESH_MS「60000 -> 30000」，实测为 15000（client.js:22），已订正
- [dual-machine-memory-sync-conflict-copies-and-restores-20260927](dual-machine-memory-sync-conflict-copies-and-restores-20260927.md) — 双机 memory 同步「绝不覆盖」策略致 175 个 .conflict 副本、Linux 侧更新被降级到 .bak；已恢复 8 个 fact 并给出可靠判据
- [github-public-backup-credential-leak-round2-zstd-and-fixes-20260927](github-public-backup-credential-leak-round2-zstd-and-fixes-20260927.md) — public 仓库 TianQue6916/reasonix 第二轮凭据泄露：.zstd 压缩绕过脱敏致真 sk-/user_ key 进历史；已阻断（2002 文件移出 + XF/gitignore 扩展 + 新增 reasonix-home target + 修元 bug），待用户改 private 与轮换 key
- [deja-0213-upgrade-dsh-integration-and-dual-reasonix-home-20260927](deja-0213-upgrade-dsh-integration-and-dual-reasonix-home-20260927.md) — deja 定位与升级到 0.21.3（reasonix 成一等 harness、索引 851→1294 sessions）、dsh 侧集成安装与启动验证；并记录本机双 reasonix home 导致的 memory 双份漂移这一结构性坑
- [dual-reasonix-home-memory-fork-and-junction-unification-20260927](dual-reasonix-home-memory-fork-and-junction-unification-20260927.md) — 本机双 reasonix home 导致 memory 双份漂移（dsh 侧 ~/.reasonix/memory 338 项 vs 桌面版 %APPDATA%/reasonix/memory 321 项）；已合并零丢失并用 junction 归一，两路径均 351 项且字节一致
### 补录（2026-09-27，原索引缺失）

- [2026-09-25-linux-天阙机大同步-reasonix-139-dsh-015rc3-网关落地](2026-09-25-linux-天阙机大同步-reasonix-139-dsh-015rc3-网关落地.md) — 长期离线的 Linux 天阙机一次性对齐 Windows 主力机：reasonix 升 1.39.0（含桌面）、dsh 升 0.1.5-rc.3 并打四处补丁、部署 goat-gateway（systemd user）、
- [dsh-版本线快照-20260925](dsh-版本线快照-20260925.md) — dsh 版本现状快照（2026-09-25 实查 npm+GitHub+官网）：无正式版/GA（官网自称开发者预览版），npm latest=0.1.5-rc.3 / next=0.1.7-rc.2，本机 0.1.5-r
- [goat-额度-mcp-植入-reasonix-与-dsh](goat-额度-mcp-植入-reasonix-与-dsh.md) — 把 GOAT 额度以 MCP 方式植入 Reasonix 与 dsh（一个零依赖 stdio server 两边共用）：配置命令、工具名规则、preset 收窄与并发缓存两个大坑
- [goat-额度-窗口标题方案与时间含义-2026-09-25](goat-额度-窗口标题方案与时间含义-2026-09-25.md) — 解释额度面板里的三个时间（数据时间 / 5h 与周的窗口重置，滚动窗口非固定时刻）；并记录 Reasonix 侧“窗口标题显示额度”的落地方案（goat-title.ps1 + GoatTitle 计划任务，实测不被 E
- [goat-额度内置面板-dsh-web-ui-插件与-reasonix-hook](goat-额度内置面板-dsh-web-ui-插件与-reasonix-hook.md) — 把 GOAT 额度做成 dsh web 内置面板（UI 插件 + 局部 HTTP 端点），并给 Reasonix 配 hook + MCP；含 dsh 插件安装三坑与无头验证法
- [linux-天阙机-goat-额度同步-reasonix-balance-url-dsh-面板-2026-09-26](linux-天阙机-goat-额度同步-reasonix-balance-url-dsh-面板-2026-09-26.md) — Linux 天阙机补齐 GOAT 额度：重写纯 node 版 quota-http.mjs（原版硬编码 Windows 路径+调 powershell）、建 systemd user service、Reasonix 加
- [reasonix-状态栏余额-json-结构定案-显示开关定位-2026-09-25](reasonix-状态栏余额-json-结构定案-显示开关定位-2026-09-25.md) — Reasonix 的 balance_url 要求 DeepSeek 钱包余额 JSON 结构（is_available/total_balance/balance_infos[currency,topped_up_ba
- [reasonix-状态栏余额刷新时机与本地时区纠正-2026-09-25](reasonix-状态栏余额刷新时机与本地时区纠正-2026-09-25.md) — 实测 Reasonix 拉取 /balance 的中位间隔 51 秒（数据是新的），界面重渲染绑会话事件（配置改不了）；/balance 增为 7 条（+数据时间）；并纠正机器本地时区是 UTC+4 不是 +8、toLo
- [reasonix-状态栏余额打桩为-goat-六额度-2026-09-25](reasonix-状态栏余额打桩为-goat-六额度-2026-09-25.md) — Reasonix 桌面版底部状态栏的 balance（“余额”）项数据源 = provider 级 balance_url；已把它指向本地 http://127.0.0.1:8790/balance（返回 2 账号×5h
- [tool-dsh-017rc2-upgrade-20260925](tool-dsh-017rc2-upgrade-20260925.md) — dsh 0.1.5-rc.2 → 0.1.7-rc.2 升级全过程档案（2026-09-25）：settings 导入机制/preset declaration 化/包改名三处迁移、headless+web 双路验证证据
- [强制搜索优先级-local-wiki-github](强制搜索优先级-local-wiki-github.md) — 搜索必须优先 local-search（离线维基/PocketWiki + GitHub 全站），只有无结果才用 exa/parallel/nothumansearch

- [mnemon-three-tier-memory-deployed-20260927](mnemon-three-tier-memory-deployed-20260927.md) — 补齐 mnemon 三层记忆的第一层（runtime hot memory）：此前 USER.md/MEMORY.md 全空；纠正"不要直接编辑那两个 .md"（记忆中 memories.json 才是唯一事实源，.md 由控制层派生），改用 mnemon_runtime_memory 工具写入并做双向闭环验证
- [dsh-web-search-multi-removed-and-fallback-repointed-20260927](dsh-web-search-multi-removed-and-fallback-repointed-20260927.md) — 删除 dsh-web-search-multi（deps+bundles+lockfile 三块+node_modules），并把 dsh-plugin-local-search 的 fallbackProviderId 从 multi-search 改指 web-search-deepseek；含 provider id 的查法与缩进感知的 lockfile 块删除
- [codex-gap-4-5-filled-agent-jobs-and-thread-edges-20260927](codex-gap-4-5-filled-agent-jobs-and-thread-edges-20260927.md) — 补齐 Codex 缺口 #5：thread-edges.mjs 现在导出真正的父子树（session→workflow→agent），修掉三处静默丢数据的 bug（meta.description 提取、正则捕获组索引 mm[2]→mm[1]、DOT parent 精确匹配），并记录 workflow/subagent 的真实参数结构与 Python 写 JS 的反斜杠坑
- [codex-gap-6-7-recon-and-mnemon-recall-quality-20260927](codex-gap-6-7-recon-and-mnemon-recall-quality-20260927.md) — 用 GitHub search 补齐 #4-#7 的社区调研：发现 dsh-market ★4695 插件市场（4200+ 插件、hot disable、启动失败 Recovery）、#5 现成方案 dsh-thread 1.2.0、#6 最佳 liguobao/ds-harness-remote ★225、#7 最佳 mrpulor-gh/nuphus-mcp ★313（Rust 通用 MCP）；#4 社区空白自研唯一
- [ollama-silent-install-hang-and-mnemon-embedding-20260927](ollama-silent-install-hang-and-mnemon-embedding-20260927.md) — Ollama 便携版绕过 UAC（0.34.4 / RTX 5070 / nomic-embed-text）、开机自启改走启动文件夹 vbs（AtLogOn 触发器报 Access denied）、mnemon embedding 达 100%（需跑 --all 两轮）；并实测出 mnemon 的 intent 只认问句线索、中文陈述式查询会退化成 GENERAL
- [dsh-patchreload-live-new-session-and-mnemon-dsh-side-verified-20260928](dsh-patchreload-live-new-session-and-mnemon-dsh-side-verified-20260928.md) — 纠正"改配置需重启 3080"的误判：patchReload=live 下新会话即读到新配置，进程无需重启；并实录 mnemon 在 dsh 侧的双向验收（mnemon_status 实调返回与 CLI 完全一致）及 deja 家族工具也同时接上
- [headless-profile-mnemon-not-viable-rolled-back-20260928](headless-profile-mnemon-not-viable-rolled-back-20260928.md) — headless profile 装 mnemon 的实测结论：插件加载成功但工具面不暴露（headless 工具面刻意极简），且引入 connection patch 警告，已完整回滚；含"包/bundles/工具面"三层验收判据
- [dsh-profile-backup-inventory-and-rollback-tool-20260928](dsh-profile-backup-inventory-and-rollback-tool-20260928.md) — 补齐 goal (3) 的"可回滚备份"：dsh-profile-rollback.mjs 盘点 85 个备份（含 11 个孤儿）、支持按时间点/单文件 dry-run 回滚；并固化 heredoc 吃反斜杠的 4 次踩坑与 4 条对策
- [mnemon-four-graph-store-verified-20260928](mnemon-four-graph-store-verified-20260928.md) — four-graph store 的实证：直查 mnemon.db 的 edges 表得出四种 edge_type（entity 81.8% / semantic 9.6% / temporal 7.1% / causal 1.5%）的分布与权重，补齐 objective 四项点名能力的最后一项硬证据；含"绕开 CLI 汇总、直查持久化层"的验证方法论
### 补录（202609271626，memory-index-heal）


- [memory-index-self-heal-20260928](memory-index-self-heal-20260928.md) — 「替代手工索引」端到端验收通过：模拟其他 agent 直接写 fact 文件（不走 memory_remember），计划任务 MemoryIndexHeal 自动把索引从 0 补到 1、条目 165→166 并留备份；清理后终态 165 fact / 165 索引 100% 覆盖。含 (1) 的完整验收清单与自动化闭环最终形态
- [dsh-market-installed-20260928](dsh-market-installed-20260928.md) — 装 dsh-market（dshmarket 1.66.2）插件市场并隔离验证通过；附关键发现"装插件必须用 dsh plugin CLI 而非 pnpm add（前者才会自动加 bundles）"，以及市场能力的完整清单（4200+ 目录 / hot disable / 启动失败 Recovery / WebDAV 备份）
- [dsh-plugin-catalog-4377-and-evaluation-20260928](dsh-plugin-catalog-4377-and-evaluation-20260928.md) — 拿到完整插件目录（awesome-dsh-plugin.com/plugins.json，4377 插件）并做横向评估：memory 类 top（OpenViking ★38736 / hindsight ★32440 / 已装 mnemon ★417）、remote 类 top（dsh-web-remote ★8037 远超旧候选）、以及官方标注的 468 个安全红线插件
- [dsh-replay-installed-for-gap5-20260928](dsh-replay-installed-for-gap5-20260928.md) — 用最强方案补齐 #5：装 @mingozhou/dsh-replay 0.4.1（会话回放 + fork lineage + audit + cost）并隔离验证通过；查明 dsh-conversation-map 存在两个同名不同作者的仓库（一个 minimap 一个血缘），且真正对口的那个不成熟；#5 最终形态为自研离线导出 + 社区在线审计互补
- [hindsight-project-memory-installed-20260928](hindsight-project-memory-installed-20260928.md) — 装 hindsight-coding-agents 0.7.0（项目级自动记忆，daemon 模式）并隔离验证通过；与 mnemon 互补（它 auto 注入项目上下文，mnemon 是 guided 通用记忆）；含 uv 必须用官方脚本装、uv 需进用户级 PATH 两个坑
- [backup-pipeline-two-fixes-privkey-and-mnemon-db-20260928](backup-pipeline-two-fixes-privkey-and-mnemon-db-20260928.md) — 备份链路两处修复：（1）"元 bug"复发——我写的警示性 fact 自己含 PRIVATE KEY 字面量致 5 文件被中止；（2）架构错误——mnemon 的 SQLite 库是派生数据且含密钥、二进制无法脱敏，已从备份 target 与 repo 中移除。含"只备份 source of truth、不备份派生数据"的边界原则与摘 print 配置时的打码纪律
- [mnemon-db-rebuild-verified-20260928](mnemon-db-rebuild-verified-20260928.md) — 实证 mnemon 库可重建：删库后从 markdown 一条命令恢复（195→205 insights / 5498→5868 edges / embedding 自动 100%），验证了 round 21 "派生数据不进备份"的判断；提炼"不进备份的派生数据必须实测可重建"这条原则
### 补录（202609271731，memory-index-heal）


- [gap-6-7-decision-brief-20260928](gap-6-7-decision-brief-20260928.md) — #6/#7 的完整决策依据：从 catalog 提取各候选的 capabilities 与 capabilityRedLines，含"redLines 为空≠安全""capabilities None=风险未知"两条读法；指出 ★8037 的 dsh-web 系插件权限面未标注、推荐能力面明确的 ds-harness-remote ★224
- [hindsight-broke-headless-incident-20260928](hindsight-broke-headless-incident-20260928.md) — 事故复盘：hindsight 写全局 patch 后破坏 headless profile（format v4 message requires a producer-owned source kind），已移除该段并验证两 profile 恢复；核心教训是"写全局 patch 的插件必须在所有 profile 上验证，且 headless 的判据必须是真跑一个任务而非进程起没起来"
- [gitbash-schtasks-arg-conversion](gitbash-schtasks-arg-conversion.md) — Git Bash 调 schtasks 必须 MSYS_NO_PATHCONV=1 + 单斜杠，否则 //query 被转成 C:/Git/query 输出错误
- [dsh-replay-thinking-patch](dsh-replay-thinking-patch.md) — 把 dsh-replay 的鲸小深加载动画换成 thinking 指示器：改动范围、脚本、3 个踩坑、验证手段
- [autostart-verification-method-20260928](autostart-verification-method-20260928.md) — 自启机制的验证方法与结论：先确认是否真重启，父链判断谁启动，两条路径实测
- [backup-pipeline-selfreference-and-scope-fix](backup-pipeline-selfreference-and-scope-fix.md) — backup-to-github 的两个根本问题：自指陷阱（修私钥泄漏的 fact 自己成源）+ 同步范围失控（291MB 会话进 public repo）
- [skill-usage-weight-normalization-fix](skill-usage-weight-normalization-fix.md) — skill_search 用量权重的量纲缺陷与归一化修复（含改前改后量化对比、可复用抽函数验证法）
- [weixin-bot-current-architecture](weixin-bot-current-architecture.md) — 微信 bot 现状架构基线：官方 iLink 协议、改名副本与独立 home、leader 由 bot 内置、凭据位置与 bot 配置形态
- [computer-use-l2-isolation-verified](computer-use-l2-isolation-verified.md) — #7 computer-use 的 L2 隔离验证：NODE_OPTIONS 崩 pnpm、plugin add 不进 bundles、勿跑 selftest、22 个工具清单
- [incident-credential-echo-leak](incident-credential-echo-leak.md) — 凭据打印事故（第 2 次）：同一表达式混用 ${VAR:+} 与 ${VAR:-} 会把值打印出来；含安全写法清单
- [dsh-goal-stop-mechanism](dsh-goal-stop-mechanism.md) — dsh goal 自动续跑的 6 条停止路径、pause 的误导性症状与只能由人做的恢复、以及"卡死"诊断方法
- [rule-no-premature-goal-block](rule-no-premature-goal-block.md) — 不得因"某个子项需要用户拍板"而整体 block goal；先推进不需要授权的剩余项
- [dsh-mnemon-realtime-sync](dsh-mnemon-realtime-sync.md) — 修复 memory→mnemon 同步的三处 bug，并新增 memory_remember 实时同步通路（含开关与回滚）
- [dsh-thread-edges-v2](dsh-thread-edges-v2.md) — #5 thread_spawn_edges 的真实实现：parentSession 权威边 + 全量扫描 + 每日刷新任务
- [windows-task-REDACTED](windows-task-REDACTED.md) — 两个验收陷阱：ScheduledTask 的 LastTaskResult 不是退出码；node 内置 zstd 静默截断多 frame 流
- [dsh-agent-jobs-v2](dsh-agent-jobs-v2.md) — #4 agent_jobs 的真实交付：端到端证据 + 4 个修复 + 26 项 self-test 断言
- [dsh-tools-dir-archived-20260928](dsh-tools-dir-archived-20260928.md) — 工具目录归档：24 个一次性脚本移入 _archive-20260928（含引用安全检查与回滚）
- [mnemon-acceptance-evidence-20260928](mnemon-acceptance-evidence-20260928.md) — mnemon 三层记忆的逐项验收实证，以及"不重建生产库"的判定与依据
- [backup-to-github-copies-and-excludes](backup-to-github-copies-and-excludes.md) — backup-to-github.ps1 的副本真相与去漂移、tmp-probe 排除、PowerShell 零副作用语法校验法，以及 2026-09-28 新增的 ~/.dsh/remote/ 私钥排除与 robocopy /L 验证法
- [dsh-isolated-instance-verify-recipe](dsh-isolated-instance-verify-recipe.md) — 隔离 dsh 实例验证配方：三件套环境变量、mem-verify profile 构建、patch insert 语义坑、三条判据
- [rule-long-running-process-needs-job](rule-long-running-process-needs-job.md) — 长命进程必须用 job 工具而非前台 bash；以及一条会挂住的命令为什么不报错、我犯过的报告失真错误
- [ds-harness-remote-installed-20260928](ds-harness-remote-installed-20260928.md) — #6 remote_control 收尾：ds-harness-remote 0.4.20 装进生产 web profile 并在 rc-lab 隔离验证（零公网 listener / 未登录零出站），读取的默认配置项、volatile schema 会写回 cordis.patch.yml 的坑、以及待用户做的一次重启+登录
- [dsh-restart-20260928-post-remote-install](dsh-restart-20260928-post-remote-install.md) — 2026-09-28 18:12:30 dsh 重启后的事实与验证方法论：cordis.yml mtime = boot 时刻指纹、三个失败的「插件加载了吗」判据、stdout 才是可靠判据、长期实例必须由 launch-dsh.ps1 起否则证据链断
- [reasonix-memory-fully-integrated-into-mnemon-20260928](reasonix-memory-fully-integrated-into-mnemon-20260928.md) — reasonix→mnemon 整合收尾：198 个 fact 全覆盖缺口 0；修掉 memory-to-mnemon.py 只读 global 目录导致 project/ 与 hash scope 从未导入的缺口；并记下「核对覆盖率必须用 frontmatter name 不是文件名」这条把我骗过一次的教训
- [dsh-config-editor-writeback-and-mnemon-settings](dsh-config-editor-writeback-and-mnemon-settings.md) — DSH config-editor 写回机制全解 + 2026-09-28 18:50 一次真实 UI 写入的现场证据：entries() 的两个硬过滤（parent 必须 include、id 必须唯一，重复即静默消失）、三支写入逻辑、写完回读校验与回滚、以及「insert 里的 row 永远不是宿主」这条踩坑点
- [dsh-home-local-git-versioning-20260928](dsh-home-local-git-versioning-20260928.md) — ~/.dsh 建成本地 git 版本控制：基线 commit 2e5b898 / 222 文件 / .gitignore 取舍 / dsh-autocommit.ps1 + DshConfigAutocommit 任务；含四条诊断（原本无版本控制、Reasonix autocommit 不覆盖 ~/.dsh、记忆与 session 都无 git 字段）与仍未做的会话注入+记忆锚点
- [dsh-git-context-and-memory-anchors-20260928](dsh-git-context-and-memory-anchors-20260928.md) — 「记得自己 git」两半补完 + 自我验证的最短路径：headless 线没有 context-gate 所以第一轮就能验（7 秒），以及 agent.cordis.yml 不被扫描这个静默失效的坑；含全部验收证据与生效时机对照
- [incident-git-context-missing-id-corrupted-sessions-20260929](incident-git-context-missing-id-corrupted-sessions-20260929.md) — 事故复盘：我给会话注入的 git-context 消息缺 id，导致 8 个 session 被判 corrupt（113 条消息）；含 dsh-session 的权威校验规则原文、幂等修复法（uuid5 + zstd 重压）、以及「preset row 一旦 mount 改 config 无法靠 HMR 停掉」这条实验结论
- [incident-includeSubagents-broke-mnemon-subagents-20260929](incident-includeSubagents-broke-mnemon-subagents-20260929.md) — 事故复盘：preset 的 tool-bootstrap.includeSubagents:true 让 subagent 第一轮只有 2 个工具，而 dsh-mnemon 六个 operation 都靠 subagent 调 result 工具回传，于是"memory subagent completed without recording its result"；含实现级传导链、修法与验收教训
## 归档说明
- 原文全量备份：`~/.reasonix/memory-backup-20260816/`（59 份）与 `~/.reasonix/memory-backup-20260816-consolidate/`
- 合并/蒸馏原始件：`~/.reasonix/memory-archive-20260816/`
- 旧 project key 残留：`~/.reasonix/memory-archive-20260816/legacy-eecdfd/`
- 双机冲突留存：`*.conflict.linux.*.bak` / `*.conflict.win.*.bak`（同步策略为「冲突保留双份」，绝不覆盖）

- [reasonix core identity](reasonix-core-identity.md) — [global/user pinned] Reasonix Code 核心身份与运营规则——只改名字不改内容/标准化命名体系/会话分类规则

- [skill routing rules](skill-routing-rules.md) — [global/project] 强制技能路由规则 — 16个场景的 Skill 自动触发映射

- [auto remember critical milestones](auto-remember-critical-milestones.md) — [global/feedback pinned] 完成重要操作后自动 remember 保存结果，不等用户提醒

- [csapp structure](csapp-structure.md) — [global/project] CSAPP全书目录结构解析

- [csapp deep](csapp-deep.md) — [global/project] CSAPP深入学习：缓存矩阵、对角块优化等

- [mit6042j review](mit6042j-review.md) — [global/project] MIT6.042J离散数学课程前瞻性总结回顾

- [discrete math](discrete-math.md) — [global/project] 离散数学深入学习：Chernoff Bound等推导

- [advanced math](advanced-math.md) — [global/project] 高等数学学习对话与问题解答

- [codex installed](codex-installed.md) — [global/reference] OpenAI Codex Desktop App v26.609.4994.0 安装与配置记录

- [pdf2zh toolbox](pdf2zh-toolbox.md) — [global/reference] 工具箱 D:\Toolbox\ 内含 PDFMathTranslate + Codex Desktop App 安装包及快捷方式

- [ppt word gen](ppt-word-gen.md) — [global/project] 全自动PPT/Word文档生成工作流

- [toolbox folder shortcut](toolbox-folder-shortcut.md) — [global/reference] D:\Toolbox\ 快捷方式：内有工具箱.lnk

- [recommended ocr tools](recommended-ocr-tools.md) — [global/reference] 用户上次推荐的OCR工具记录

- [toolbox desktop shortcut](toolbox-desktop-shortcut.md) — [global/reference] 桌面有工具箱.lnk → D:\Toolbox

- [thunder download method](thunder-download-method.md) — [global/reference] 迅雷调用方法：thunder://协议Base64转换+Powershell推送

- [matt pocock skills auto](matt-pocock-skills-auto.md) — [global/project] Matt Pocock 技能集 — 自动触发规则 + 已安装技能索引

- [installed ppt skills](installed-ppt-skills.md) — [global/reference] 三个由外部仓库转换安装的 Reasonix 演示文稿技能

- [installed skills round3](installed-skills-round3.md) — [global/reference] 第三批安装：Anthropic 官方技能 + Vercel 官方技能 + 三个技能合集索引

- [installed skills round2](installed-skills-round2.md) — [global/reference] 第二批安装的4个Reasonix技能：计划管理+开发方法论+幻灯片+浏览器自动化

- [future planning](future-planning.md) — [global/user pinned] 方舟计划完整总结、API配置、学习体系规划

- [aigc detection battle log](aigc-detection-battle-log.md) — [global/project] 10轮AIGC降率实战经验总结：策略对比与关键教训

- [acs alh skills created](acs-alh-skills-created.md) — [global/reference] ACS(理工科)+ALH(文科)降AIGC技能已创建，基于25篇知网论文真实数据分析

- [aigc deterministic only](aigc-deterministic-only.md) — [global/feedback pinned] 核心发现：AI改写AI文本=叠加AI指纹，唯一有效的是非LLM硬编码规则替换

- [GOAT 模型菜单实况 + pro 是 latest 滚动指针 + pro 使用基线（2026-09-28 实测）](goat-model-menu-and-pro-latest-pointer-baseline-20260928.md) — [global/reference] GOAT 网关 82 模型菜单实测（无 v4.1-pro）、deepseek-v4-pro 是 latest 滚动指针（v4.1-pro 上线大概率不新增 id）、6 天日志 pro 零调用基线，以及判断 v4.1-pro 是否需要时的触发条件
