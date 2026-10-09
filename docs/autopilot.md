# Autopilot contract — Claude Code Model Router (ccmr)

无人值守运行（autopilot skill）的常设规则。本文件由人类拥有：每次运行只读取、绝不修改。

Status: proposed <!-- 人类确认后改为 "in force since <date>" -->

## Workspace

每次运行从 main 新建分支 `autopilot/<slug>`，全部提交落在该分支。运行结束后人类决定合并。

主 checkout 本身不承载任何长期服务——用户的真实网关运行于 `~/Vibing/ccmr-start/`（8080 端口），与仓库无关，任何运行不得触碰。仓库内未跟踪的用户文件（`CLAUDE.md`、`learnings/`、`.antigravitycli/`、`.playwright-mcp/`）保持未跟踪、不提交、不修改。

## Preflight

| check | command | ready when |
|---|---|---|
| 类型检查 | `npm run typecheck` | exit 0 |
| 全量测试 | `npx vitest run` | 全部通过（当前基线 166/166，约 1.2s） |
| 构建 | `npm run build` | exit 0 |
| 基线干净 | `git status --porcelain --untracked-files=no` | 无已跟踪文件改动 |

## Machine gate

每个 stage 提交后、在干净工作树上运行；全部通过才算过门。`rerun` 表示 reviewer 可否重跑。

| command | proves | rerun |
|---|---|---|
| `npm run typecheck` | 类型健全 | safe |
| `npx vitest run` | 全部测试绿（离线、秒级） | safe |
| `npm run build` | dist 可编译 | safe |
| `node dist/cli.js models -c <scratch-config>` | CLI 能加载展开后的配置 | safe |
| `npm run smoke` | 网关烟雾测试（scratch 端口 8099：health/非流式/SSE/统计） | safe |
| `git status --porcelain --untracked-files=no` | 证据对应的正是被测提交 | safe |

dist/ 与 src/ 同提交提交（CI 校验 dist 时效性）。

## Pre-authorized

- 分支 `autopilot/<slug>` 上的全部编辑与提交（遵循 `type: subject` 提交规范）
- scratch 网关：端口 8090–8099（8099 保留给 smoke），配置放 /tmp 或会话 scratchpad；只杀自己拉起的 PID
- `ccmr doctor` 式微型真实请求验证：每个供应商每次调用 ≤1 条 tiny 请求（分级：美分级成本），key 仅取自仓库 `.env` 经 scratch 配置引用；结果原样记录
- 版本 bump（package.json）与 README changelog 写入——发布本身除外（见红线）
- 新增/修改测试、docs/autopilot* 文档、learnings 笔记
- 零新依赖为默认；确需新增依赖时不自行安装，按红线处理

## Red lines

| red line | prepare instead |
|---|---|
| `npm publish` / `vsce publish` / 任何 registry 或 marketplace 变更 | changelog + 版本 bump 提交就绪；人类点击发布 |
| `git push`（任何远端操作） | 全部提交留在本地分支；人类推送 |
| 合并回 main / 其他 landing 动作 | 交付验收走查清单；人类落地 |
| 编辑 `~/Vibing/ccmr-start/` | 只读参考；测试一律用 scratch 副本 |
| 杀掉/重配 8080 或 8088 端口的网关，或任何非本运行拉起的进程 | 仅 scratch 端口 |
| 厂商控制台动作（买套餐、开通模型、生成 key） | doctor 输出写明需要什么；人类操作 |
| 真实 key 进入被跟踪文件/fixture/提交信息 | key 只进 scratch `.env`（不提交）或进程环境 |
| 新增 npm 依赖 | 用内置实现；确实被卡死则 park 并说明理由 |
| 外部发布（推广文、issue、awesome-list 等） | 范围外；如需推广另开运行 |

## Evidence

证据文件放 `docs/autopilot-runs/evidence/`，文件名 `<stage>-<label>.md`：记录命令、退出码、时间、提交哈希。机器门证据由 `run-gate.sh` 生成；探针类证据（transcript、curl 输出）手工归档同目录。厂商上游错误文本一律原样保留，不改写。

## Review heuristics

reviewer 额外套用的项目规则路径：

- `CLAUDE.md`（仓库根）——尤其是 Five Copies 不变式、命名陷阱清单、质量门槛
- `.claude/rules/common/coding-style.md`、`testing.md`、`security.md`

## Run records

运行记录放 `docs/autopilot-runs/`，命名 `YYYY-MM-DD-<slug>.md`。
