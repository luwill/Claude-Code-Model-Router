# v1.8.0 实施计划（易用性 + 风险修复）

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
