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
| C1 | 零 key 全新安装下，`ccmr models` 与 `/health` 不出现任何虚假可用状态：无有效 key 的模型一律显示 [No API Key]（或等价诚实标记），默认模型同样受检 | scratch 零 key 探针输出（before/after）+ vitest 公共接口断言 | open | |
| C2 | 网关因缺 key / key 无效拒绝请求时，Claude Code 内用户可见的错误文本包含：模型名、缺失/无效的 env 变量名、（config 提供时的）申请地址；不再是无信息量的裸转发错误 | scratch 网关 curl 错误体 before/after + 测试 | open | |
| C3 | 一条命令完成引导式上手：检测已有 key → 选择要配的 provider → 粘贴 key →（可选）立即 tiny 验证 → 写入 .env → 设默认模型 → 打印下一步；全程支持非交互 flags（CI/脚本可用） | 脚本化 E2E transcript（flags 模式，scratch 配置）+ 测试 | open | |
| C4 | Stage 1 审计列出的每个 High/Medium 发现已修复，或在 ledger 有明确决策（为何不修/推迟） | ux-audit.md 条目与 ledger 逐条对照 | open | |
| C5 | 五份拷贝一致（模板一致性测试 + 跨仓库 grep 记录）；README 快速开始反映新上手流程并含 changelog 条目；全程机器门绿 | gate 输出 + grep 记录 + README diff | open | |

`status` 为 `open`、`proven` 或 `parked`。

## Stages

1. [ ] UX 审计 — 三条旅程（零 key / 单 key / 坏 key）脚本化复现，产出 ux-audit.md（每个发现含命令与输出）；为 C4 提供输入。docs-only，跳过评审门。
2. [ ] 诚实状态 — owns C1：key 判定根因修复、models 与 /health 口径一致、默认模型标记；顺带钉死「空值 [Ready] / GLM_GLOBAL 例外」的机制。
3. [ ] 自愈错误 — owns C2：router/server 错误路径按 C2 要求重写文案。
4. [ ] 引导式 setup — owns C3：新 CLI 命令（或 init 交互升级，按审计结论定）+ 非交互模式 + E2E。
5. [ ] 文档与收尾 — owns C4、C5：审计长尾逐条闭环、README 快速开始/changelog、跨仓库 grep、版本 bump（v1.22.0）。

## Ledger

### Decisions

| id | stage | chose | rejected | wrong if |
|---|---|---|---|---|
| D1 | takeoff | 范围=新用户旅程+状态诚实性+错误自愈 | 推广运营/社区发文（无代码落点，外部发布是红线） | 用户本意含市场动作——起飞批中原样确认 |
| D2 | takeoff | 版本一次性 bump 到 v1.22.0 于 Stage 5 | 每 stage 一个版本（changelog 噪音大） | 用户要求逐阶段发版 |
| D3 | takeoff | C3 形态（新命令 vs init 升级）留给 Stage 1 审计后定 | 起飞时拍死形态 | 审计证据与所选形态矛盾 |

### Review findings

| id | round | reviewer | finding | status | note |
|---|---|---|---|---|---|

`status` 为 `blocking-fixed`、`minor-fixed`、`minor-open`、`fixed-unreviewed`、`parked`、`rejected` 或 `dispute`。

### Parked

按人类执行顺序排列。

| id | needs | exact action | unblocks | verify afterward |
|---|---|---|---|---|
| P1 | 运行结束审核 | 审阅运行记录与验收走查；决定合并 `autopilot/ux-takeoff` → main | 发布 | `git log main..autopilot/ux-takeoff --oneline` 后合并 |
| P2 | P1 | `git push`（推送分支或 main） | CI / 远端备份 | GitHub Actions 绿 |
| P3 | P2 | `npm publish`（用户动作，绝不由运行执行） | 用户拿到 v1.22.0 | `npm view claude-code-model-router version` |
| P4 | P3 | VSCode 扩展同步（`../Claude-Code-Model-Router-VSCode`：依赖版本、secrets.ts、README/CHANGELOG） | 扩展用户 | 扩展 `npm test` 4/4 |

### Not verified

（起飞时为空，随运行补充。）

## Acceptance walk

风险优先，落地时填写。

| # | where | do | should see |
|---|---|---|---|
