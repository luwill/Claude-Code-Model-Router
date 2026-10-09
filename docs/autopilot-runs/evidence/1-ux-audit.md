# ccmr 新用户旅程 UX 审计 — 2026-10-09

- 运行：autopilot/ux-takeoff @ 109a372
- 方法：受控环境探针（`env -i` + 独立 HOME，杜绝会话环境里真实 key 的干扰——本次审计最大的方法论教训，见 R1）；三条旅程 + 相邻表面；原始证据见 `1-audit-journey-a.md`、`1-audit-journey-b.md`
- 成本：微型真实请求共 7 条（doctor 5 + 成功/失败路径 2），全部预授权范围内

## 总体结论

失败路径的 UX 成熟度**远高于起飞时的假设**；真实缺口集中在两处：**上手引导**（init 后让用户独自面对 18 个环境变量）与 **key 健康的持续可见性**（作者本人的 `.env` 六把 key 死了五把，没有任何主动信号）。

## 发现清单

| id | 严重度 | 发现 | 证据 | 处置 |
|---|---|---|---|---|
| H1 | High | 无引导式 setup：init 的下一步是「Edit .env and add your API keys」，用户独自面对 18 个 `*_API_KEY`，厂商控制台 URL 只存在于 .env 注释里 | journey-a A2 | Stage 4（C3） |
| H2 | High | key 腐烂无持续可见性：仓库 `.env` 6 家 key 5 家已失效（DEEPSEEK/KIMI/QWEN/MINIMAX/MIMO 全 401/403，仅 STEP 存活），doctor 能精准诊断但全靠用户主动想起；会话中途 401 才是实际暴露点。最小闭环：让 401 错误文本指路 `ccmr doctor`（并入 C2）；更大的健康看板另立 ledger | journey-b B2/B6 | Stage 3（C2 承接最小闭环）+ ledger 决策 |
| M1 | Medium | `ccmr models` 不标记默认模型：`use` 成功后列表无任何默认指示（网关 banner 有，CLI 没有） | journey-a A9 | Stage 2 |
| M2 | Medium | 上游 401/403 透传文案不自愈：`Upstream API error (deepseek): Authentication Fails...` 不告诉用户改哪个 env 变量、去哪换 key、下一步跑什么。四家厂商错误原文已采集存档 | journey-b B2/B6 | Stage 3（C2） |
| M3 | Medium | 零 key 错误体好但差一步：已点名模型与 env 变量，缺申请地址与下一步（`API key not configured for model 'Kimi K3'. Please set the KIMI_API_KEY environment variable.`） | journey-a A6、journey-b B3 | Stage 3（C2） |
| M4 | Medium | `ccmr stats` 不自报读取目标：默认端口静默命中 8080 实况网关，输出无一行说明数据来自哪个网关（多网关并存时误导） | journey-b B5/B8 | Stage 2 |
| M5 | Medium | 裸 `ccmr` 无首 Run 检测：无任何配置与 key 时仍只打 help，不引导 init/setup | journey-a A1 | Stage 4 顺带 |
| L1 | Low | doctor 零 key 时 42 行逐模型 `[SKIP]` 噪音；按 env 变量分组（18 行）即可 | journey-a A8 | ledger（本 run 不修：输出正确只是冗长，收益/风险比低） |
| L2 | Low | 网关零 key 警告建议路径顺序「~/.ccmr/.env (or ./.env)」对项目内配置场景易引导新手写错地方 | journey-a A4 第 99 行 | ledger（语义上两处都合法；随 Stage 4 setup 落地后此提示重要性下降） |
| R1 | 已推翻 | 起飞假设「零 key 显示假 [Ready]」：受控环境下 42/42 全部诚实 `[No API Key]`；起飞观察是**本会话 shell 导出了真实 key**（父环境优先级最高，属文档行为）+ zsh 管道 SIGPIPE 截断的双重混淆 | journey-a A3；`~/.ccmr/.env` 名单比对 | C1 转义为「回归锁定」：用测试固化三处诚实口径 |

## 值得保持的正样本（审计中发现的好设计，改动时不得破坏）

- 网关启动零 key 警告：`0/42 models have an API key. Every request will fail with 401 until a key is configured.` + 指路 doctor（journey-a A4）
- `ccmr claude` 启动预检：未知模型 / 缺 key 分支给出精确到命令的修复路径（src/cli.ts:560-595）
- `ccmr doctor` per-model 诊断：延迟 + 上游错误原文，一次暴露端点/Key/开通三类问题（journey-b B6）
- init 幂等 `[SKIP]` 提示（journey-a A2）
- 错误体保持 Anthropic error 格式，Claude Code 可正常渲染（journey-a A6）

## 401/403 厂商错误原文样本（Stage 3 素材，原样保留）

- deepseek: `Authentication Fails, Your api key: ****xxxx is invalid (request_id: ...)`
- moonshot: `Invalid Authentication`
- alibaba: `{"message":"invalid api-key","type":"authentication_error",...}`
- minimax-cn: `login fail: Please carry the API secret key in the 'X-Api-Key' field of the request header`
- xiaomi-token-sgp: `Invalid API Key`

## 需要用户知晓（非本运行动作）

仓库根 `.env` 的 DEEPSEEK/KIMI/QWEN/MINIMAX/MIMO key 已失效——落地时提醒换新；这是你的本地文件，运行不做任何修改。
