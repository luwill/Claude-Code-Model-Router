# ccmr 易用性起飞 — 产品与工具体验专项

- status: flying
- workspace: autopilot/ux-takeoff
- base: 6ab5444
- contract: docs/autopilot.md

## Goal

用户原话：「从产品和工具易用性的角度出发，让 ccmr 这个项目起飞」。

解读：把「新用户从 npm install 到在 Claude Code 里收到第一条回复」的旅程做到不困惑、不撒谎、可自愈；日常状态信息（models/health/错误）诚实可行动。推广运营无代码落点且属外部发布红线，不在本运行范围。

## Acceptance criteria

冻结于起飞。运行只改 `status` 与 `evidence`，不改判据。

| id | criterion | proven by | status | evidence |
|---|---|---|---|---|
| C1 | 零 key 全新安装下，`ccmr models` 与 `/health` 不出现任何虚假可用状态：无有效 key 的模型一律显示 [No API Key]（或等价诚实标记），默认模型同样受检 | scratch 零 key 探针输出（before/after）+ vitest 公共接口断言 | proven | evidence/1-audit-journey-a.md A3（42/42 NoKey，受控 env -i + 独立 HOME）；tests/config.test.ts 聚合锁定 + tests/server.test.ts /v1/models 与 /health 锁定（82f64bd） |
| C2 | 网关因缺 key / key 无效拒绝请求时，Claude Code 内用户可见的错误文本包含：模型名、缺失/无效的 env 变量名、（config 提供时的）申请地址；不再是无信息量的裸转发错误 | scratch 网关 curl 错误体 before/after + 测试 | proven | before：1-audit-journey-a.md A6；after：evidence/4-stage3-live.md E1/E2（零 key 与真实失效 key 双路径，厂商原文保留）；tests/router.test.ts 上游 401/403 与零 key 文案断言（acef946） |
| C3 | 一条命令完成引导式上手：检测已有 key → 选择要配的 provider → 粘贴 key →（可选）立即 tiny 验证 → 写入 .env → 设默认模型 → 打印下一步；全程支持非交互 flags（CI/脚本可用） | 脚本化 E2E transcript（flags 模式，scratch 配置）+ 测试 | proven | evidence/6-stage4-live.md F1–F4（首 Run 检测、零 key --yes exit 1、--yes --validate 含 1 条真实验证、管道 stdin 全交互流程）；tests/setup.test.ts 11 项（27dd03a） |
| C4 | Stage 1 审计列出的每个 High/Medium 发现已修复，或在 ledger 有明确决策（为何不修/推迟） | ux-audit.md 条目与 ledger 逐条对照 | proven | H1→Stage4、H2→Stage3 最小闭环 + D6、M1→Stage2、M2/M3→Stage3、M4→Stage2、M5→Stage4；L1/L2 见 D7/D8（本记录 Ledger） |
| C5 | 五份拷贝一致（模板一致性测试 + 跨仓库 grep 记录）；README 快速开始反映新上手流程并含 changelog 条目；全程机器门绿 | gate 输出 + grep 记录 + README diff | proven | 机器门 2–5 全 6/6（evidence/3,5,7,8）；console_url 三处同步由 tests/config.test.ts 钉死；跨仓库 grep：扩展按 envName 工作、无 console_url 依赖（5789279 提交体）；README 快速开始/命令说明/环境变量/更新日志 v1.22.0（5789279） |

`status` 为 `open`、`proven` 或 `parked`。

## Stages

1. [x] UX 审计 — 三条旅程（零 key / 单 key / 坏 key）脚本化复现，产出 ux-audit.md（每个发现含命令与输出）；为 C4 提供输入。docs-only，跳过评审门。（4973213）
2. [x] 诚实状态 — owns C1（回归锁定）+ M1 默认标记 + M4 stats 自报网关。（82f64bd）
3. [x] 自愈错误 — owns C2 + H2 最小闭环：console_url 单一事实源、零 key/上游 401 指路。（acef946）
4. [x] 引导式 setup — owns C3 + M5 首 Run 检测；发现并修复裸命令 Quick Start 死代码。（27dd03a）
5. [x] 文档与收尾 — owns C4/C5：README 四处更新、版本 v1.22.0、跨仓库核对、IMPLEMENTATION_PLAN。（5789279）

## Ledger

### Decisions

| id | stage | chose | rejected | wrong if |
|---|---|---|---|---|
| D1 | takeoff | 范围=新用户旅程+状态诚实性+错误自愈 | 推广运营/社区发文（无代码落点，外部发布是红线） | 用户本意含市场动作——起飞批中原样确认 |
| D2 | takeoff | 版本一次性 bump 到 v1.22.0 于 Stage 5 | 每 stage 一个版本（changelog 噪音大） | 用户要求逐阶段发版 |
| D3 | 1 | C3 形态定为**新命令 `ccmr setup`**：init 保持幂等的文件生成语义，setup 负责交互配置；init 下一步与裸命令首 Run 都指向 setup | 升级 init 为交互式（破坏其可脚本化与幂等语义） | 用户更想要 init 一条命令全包 |
| D4 | 1 | 起飞发现「零 key 假 [Ready]」判定为**已推翻**（R1）：受控环境 42/42 诚实；原观察源于会话 shell 导出真实 key + SIGPIPE 截断。C1 判据不变，转义为「回归锁定」 | 维持「修 bug」叙事（无 bug 可修） | 受控环境复测出现任何假 Ready |
| D5 | 1 | 机器门「完全干净」要求与用户未跟踪文件冲突：用 `.git/info/exclude` 本地屏蔽 `.antigravitycli/`、`.playwright-mcp/`、`CLAUDE.md`、`learnings/`（纯本地、不进版本库、可随时删） | 改 .gitignore（会误导提交候选）/ git worktree（每 stage 重建 node_modules） | 用户依赖 `git status` 看到这些文件提醒提交 |
| D6 | 1 | H2「key 健康持续可见性」本轮只做最小闭环：401 错误文本指路 doctor（并入 C2/Stage 3）；健康看板类大功能记为后续 | 本轮做完整健康看板（规模失控） | 用户要求看板进本轮 |
| D7 | 1 | L1（doctor 零 key 42 行 SKIP 噪音）不修：输出正确仅冗长，聚合无 key 场景已被 setup/首 Run 检测分流，收益/风险比低 | 按 env 变量分组的 18 行摘要 | 用户高频跑零 key doctor |
| D8 | 1 | L2（零 key 警告建议路径顺序）不修：两处 .env 均合法且提示并列展示；setup 落地后该提示的阅读场景大幅减少 | 调整文案顺序 | 新用户被误导写入错误位置的报告 |
| D9 | 4 | setup 交互在非 TTY stdin 上允许管道驱动（EOF 优雅降级为空答案 + 明确报错），而非硬拒绝 | isTTY 硬门禁（杀死脚本化能力，且 --yes 已覆盖纯 CI） | 管道误用导致挂死或写出错误配置 |
| D10 | 4 | 粘贴的 key 写 .env 后同步注入 process.env（值本就来自用户输入，进程随 CLI 退出） | 让 ConfigManager 重读 .env 文件（需新增公共 API，改动面大） | 注入造成环境泄漏报告 |
| D11 | review | codex CLI 本会话不可用（所有模型报「ChatGPT 账号不支持」，账号级故障）：各 stage 对抗评审由**新上下文 Claude agent + CODEX-BRIEF** 替代，损失「异构模型」属性、保留对抗属性；已列 P5 待用户修复 codex | 跳过对抗评审（评审门是硬要求） | 用户要求所有评审必须异构模型 |
| D12 | review | RF16 定性「blocking-fixed（演示伪影 + 机制属实）」：对抗评审的 pty 复现脚本继承了会话真实 key，secret 实际落入可见提问；但干净 pty 下原始模式连隐藏提示符都无法出现——修复保留且双向验证 | 直接按演示采信（证据不实）或整体驳回（机制真） | 干净环境下原始模式被证实完全无异常 |
| D13 | review | pty 类验证必须先清洗 `*_API_KEY` 再 fork：本会话 shell 导出全部真实 key，任何继承型子进程都会让「无 key」场景失真——本轮两次评审翻案（R1 假 Ready、RF16 回显）都源于此 | 只信 transcript 不做环境清洗复测 | 无 |

### Review findings

| id | round | reviewer | finding | status | note |
|---|---|---|---|---|---|
| RF1 | 1/s2 | auditor-stage2 | 账本在 stage-2 head 未落盘（C1 open、证据未提交） | minor-fixed | 49bc187 + da2426f 补齐 |
| RF2 | 1/s2 | auditor-stage2 | C1 缺 head 上的 after 探针归档 | minor-fixed | evidence/9-review-round1.md R1（42/42 NoKey + 默认标记） |
| RF3 | 1/s2 | auditor-stage2 | 门脚本 tail=15 截断 models 被测面 | minor-mitigated | 起 10 号证据 GATE_TAIL_LINES=100（10/11/12 号全尾巴）；脚本本身归技能所有不改 |
| RF4 | 1/s2 | auditor-stage2 | codex 失败日志被 `*.log` 忽略 | minor-fixed | 改名 `3-stage2-codex-outage.txt` 入库，D11 引用 |
| RF5 | 1/s2 | adversary-stage2 | 简写默认模型（provider 裸键）标记半触发：图例在、无星行 | minor-fixed | `resolveListedDefaultName` + 3 测试 + R2 实证（1df1f5e） |
| RF6 | 1/s3 | auditor+adversary-stage3（独立收敛） | 流式路径上游 401 裸文案——C2 主旅程（Claude Code 默认流式）未覆盖 | blocking-fixed | forwardStream 同构注释 + 流式测试 + R3 SSE 实证（1df1f5e） |
| RF7 | 1/s3 | auditor-stage3 | live 证据盖基线脏树戳、未记命令 | minor-fixed | R3 以全元数据（命令/退出码/时间/提交）重录 |
| RF8 | 1/s3 | auditor-stage3 | MiMo 三家无 console_url 且阈值宽松放行静默丢失 | minor-fixed | 无 URL 集合精确钉死为三兄弟（1df1f5e） |
| RF9 | 1/s3 | auditor-stage3 | `.env.example` 未被测试钉住且缺 StepFun（既有漂移） | minor-fixed | 逐 env 覆盖率测试 + StepFun 段（1df1f5e） |
| RF10 | 1/s3 | auditor-stage3 | 运行记录滞后 | minor-fixed | da2426f |
| RF11 | 1/s4 | auditor+adversary-stage4（同源，后者定 blocking） | setup 写 key 不跑 `ensureEnvIgnored`——git 仓库内可暂存明文 key | blocking-fixed | f0fe5cc + R4 实证（[GUARD] + .gitignore） |
| RF12 | 1/s4 | auditor-stage4 | `pickDefaultModel` chosen 参数生产死代码；默认提示自由文本静默采纳 | minor-fixed | f0fe5cc（交互传刚配置项、非交互传全部 keyed；未识别输入重问） |
| RF13 | 1/s4 | auditor-stage4 | `.env` 手写 `NAME = value` 会被重复追加 | minor-fixed | f0fe5cc（空格容错正则 + 测试） |
| RF14 | 1/s4 | auditor-stage4 | transcript 盖提交前脏树戳 | minor-acknowledged | 其核验与提交代码逐字一致；后续证据（R3/R4/R5）均带元数据 |
| RF15 | 1/s4 | auditor-stage4 | init 文案改动无运行时证据 | minor-fixed | R4 归档输出 |
| RF16 | 1/s4 | adversary-stage4 | TTY 下「隐藏输入」明文回显（blocking，演示实为环境伪影：pty 继承会话真实 key → secret 落入可见提问；但机制隐患属实——干净 pty 下原始模式隐藏提示符无法出现） | blocking-fixed | b3606d7：close-recreate 模式；干净 pty 实证提示出现 + 0 回显 + 全流程完成（R5） |
| RF17 | 1/s4 | adversary-stage4 | 默认 action 使未知命令 exit 0 | minor-fixed | b3606d7：非空参数 → stderr + exit 1（实证） |
| RF18 | 2 | round2-review（对抗+验收合体，审 3990024..1df1f5e 修复差分） | （回传后填写） | pending | 其范围外的 f0fe5cc/b3606d7 修复依规则记 fixed-unreviewed，由落地终审覆盖 |

`status` 为 `blocking-fixed`、`minor-fixed`、`minor-open`、`fixed-unreviewed`、`parked`、`rejected` 或 `dispute`。

### Parked

按人类执行顺序排列。

| id | needs | exact action | unblocks | verify afterward |
|---|---|---|---|---|
| P1 | 运行结束审核 | 审阅本运行记录与验收走查；决定合并 `autopilot/ux-takeoff` → main | 发布 | `git log main..autopilot/ux-takeoff --oneline` 后合并 |
| P2 | P1 | `git push`（推送分支或 main） | CI / 远端备份 | GitHub Actions 绿 |
| P3 | P2 | `npm publish`（用户动作，绝不由运行执行） | 用户拿到 v1.22.0 | `npm view claude-code-model-router version` 显示 1.22.0 |
| P4 | P3 | VSCode 扩展同步：`../Claude-Code-Model-Router-VSCode` 依赖 ^1.22.0、README/CHANGELOG、版本 bump；**无需**结构性改动（扩展按 envName 工作，console_url 为可选字段） | 扩展用户 | 扩展 `npm test` 4/4 |
| P5 | 随时 | 修复 codex CLI：所有模型报 `not supported when using Codex with a ChatGPT account`（账号级），检查 `~/.codex/config.toml` 的 model 与登录态 | 下次运行恢复异构对抗评审 | `codex exec 'OK'` 成功 |
| P6 | 随时 | 仓库根 `.env` 的 DEEPSEEK/KIMI/QWEN/MINIMAX/MIMO key 已失效（B6 实测），按需换新；本地文件，本运行未改动 | doctor 全绿体验 | `ccmr doctor`（仓库 .env 环境下） |

### Not verified

- **真实 TTY 下的隐藏输入**：交互流程以管道 stdin 验证（F4）；raw-mode 逐键输入、退格、Ctrl+C 走查需真终端——验收走查第 1 步
- **`ccmr claude` 全链路 E2E**（拉起 Claude Code → /model 切换 → 收到回复）：launcher 路径本运行未改动，留给验收走查第 3 步用真实终端体验
- **网关运行中 setup 写 .env 的热重载联动**：watcher 为既有代码（reload.test.ts 覆盖），本运行未端到端实测「setup 后免重启生效」
- doctor 在 8080 实况网关之外的并发行为、Windows 终端下的 ANSI/交互表现（无环境）

## Acceptance walk

风险优先。

| # | where | do | should see |
|---|---|---|---|
| 1 | 随便一个空目录，真终端 | `ccmr setup` | 18 个厂商列表（含控制台 URL）→ 选号 → 粘贴 key 时**不回显** → 可选验证 → .env 写入 → 默认模型确认 → Next steps |
| 2 | 同目录 | `export STEP_API_KEY=sk-... && ccmr setup --yes --validate` | `[OK] step-5-preview`（1 条微型真实验证）+ Default model: step-5-preview |
| 3 | 项目目录 | `ccmr claude`，会话内 `/model` 切到 setup 配的模型并发一句话 | 自动拉起网关、模型列表可切、收到回复（产品时刻） |
| 4 | 同会话 | `/model` 切到一个**没配 key** 的模型并发一句话 | 错误文本点名 env 变量 + 申请地址 + `ccmr doctor <model>` 指引（C2） |
| 5 | 终端 | `ccmr models` 与 `ccmr stats` | 默认模型带 `*` 与图例；stats 首行自报网关端口 |
| 6 | 你自己决定发布后 | `npm publish` → 扩展同步（P4） | npm 版本 1.22.0；扩展 4/4 测试绿 |
