# v1.8.0 实施计划（易用性 + 风险修复）

## v1.8.3 审查修复计划（2026-07-16）

本轮按风险优先级逐项修复，并为每项补回归测试；不删除现有项目文件。

| # | 阶段 | 内容 | 状态 |
|---|------|------|------|
| 1 | 配置隔离 | 阻止 `ccmr claude` 跨项目复用来源不一致的后台网关 | ✅ 完成 |
| 2 | 流式可靠性 | 增量 UTF-8 解码、CRLF SSE、断连取消、响应背压 | ✅ 完成 |
| 3 | 鉴权与密钥 | 统一客户端/服务端令牌、可撤销 `.env` 热加载、网络绑定 fail-closed | ✅ 完成 |
| 4 | 配置与功能 | CLI/YAML/env 优先级、严格校验、能力约束、token counting 代理 | ✅ 完成 |
| 5 | 发布工程 | 修复依赖审计、补 LICENSE、更新 README/CI，并完成全量发布检查 | ✅ 完成 |

---

按 review 结论分 5 个阶段实施，测试先行（vitest 基线 → 新功能 red-green）。

| # | 阶段 | 内容 | 状态 |
|---|------|------|------|
| 0 | 测试基建 | vitest + ConfigManager/ModelRouter 基线测试 + DEFAULT_CONFIG↔YAML 模板一致性测试 | ✅ 完成 |
| 1 | doctor + init 防护 | `ccmr doctor` 真实连通性自检；init 自动 .gitignore `.env` | ✅ 完成 |
| 2 | 自动拉起 + 版本提示 | `ccmr claude` 探测 /health，不可达自动拉起网关；版本不一致警告 | ✅ 完成 |
| 3 | CI | GitHub Actions: Node 18/20/24 build + test + dist 一致性 | ✅ 完成 |
| 4 | 全局配置 + 热重载 + use | `~/.ccmr/` 兜底；watchFile 热重载；`ccmr use <model>` | ✅ 完成 |
| 5 | 用量 + failover | UsageTracker + GET /usage + `ccmr stats`；fallback 降级链 | ✅ 完成 |
| 6 | 杂项风险 | 流式空闲超时、timingSafeEqual、无条件日志、EADDRINUSE、移除 node-fetch/chalk | ✅ 完成 |
| 7 | 自测 + 发布准备 | 69 测试全绿；init/use/热重载/doctor/自动拉起/stats 全部真实运行验证；README；v1.8.0 | ✅ 完成 |

## 自测记录（2026-07-07）

- `vitest run`：69/69 通过；一致性测试当场抓到模板两处真实漂移（`default_variant: 5.2` 未加引号、缺 `kimi-k2.6` 别名）并修复
- `ccmr init`（scratch git 仓库）：`.env` 自动写入 `.gitignore` ✅
- 热重载：`ccmr use kimi` → 网关日志出现 `[reload]`，`/health` 的 default_model 免重启切换 ✅
- `ccmr doctor`（真实 key，ccmr-start）：7 ok / 3 fail / 18 skip；确认 seed-2.1-pro 已开通可用，暴露 seed-2.1-turbo 未开通、mimo-token-cn Key 失效 ✅
- 自动拉起 E2E：`ccmr claude -p ... --gateway-port 8096`（空端口）→ 网关自动拉起 → DeepSeek 真实请求返回 `SELFTEST-OK` ✅
- `ccmr stats`：正确显示 1 次请求 39148/41 tokens ✅

## v1.8.3 自测记录（2026-07-16）

- `npm run check`：TypeScript 类型检查、107/107 测试、构建与网关烟雾测试全部通过 ✅
- 烟雾测试覆盖健康检查、非流式转发、SSE 流式转发与用量统计 ✅
- `npm audit --audit-level=high`：0 vulnerabilities ✅
- `npm pack --dry-run`：发布包内容检查通过 ✅
