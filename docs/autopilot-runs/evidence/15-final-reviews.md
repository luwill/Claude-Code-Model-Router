# 迟到评审原文归档 — 2026-10-09

三份评审在运行记录首版落笔后才交付（final-audit/final-adversary 因配额 429 一度被判定失败，后自行恢复；round-2 交仓名义在先但原文未归档）。原文逐字保存，未经改写。

---

## 一、round2-review（审 3990024..1df1f5e 修复差分）

verdict: **approve**，1 条 minor（→RF19）。

五项 claim 核实：流式 401 提示与非流式路径（327-334、386-393）模板完全对称（provider 前缀 + 原样厂商文本 + 仅 401/403 追加 "— key rejected." + env var + console URL + doctor 命令）；failover/recordError 逻辑未动。tests/router.test.ts:321 起真实本地 401 服务器驱动 forwardStream，断言 SSE 事件含全部注解字段（3ms，真实探测非 mock）。裸 provider-key 默认标记实测复现（acme → 标记落在 acme-pro）。config.test.ts 钉死属实：no-console_url 集合精确 toEqual；.env.example 覆盖测试真实读文件；StepFun 段已补。证据文件属实（R1/R2/R3，密钥掩码；codex 宕机原样归档）。机器门 6/7 属实——第 6 项见下。

Finding（minor）：resolveListedDefaultName 按 model_id 字符串匹配，但 model_id 跨 provider 不唯一（step/step-plan 同为 step-5-preview、四个 mimo 同 mimo-v2.5-pro）；自定义无别名 provider 对复刻该模式时标记落到另一家 provider 的行（实测 default_model: acme-plan → 标记落在 acme-pro）。仅展示层误导。建议按 ModelConfig 对象引用匹配（shorthand 与默认变体同一引用），model_id 仅回退。

独立复验：隔离 worktree（无 .env，真钥零加载）在 1df1f5e 跑全套 199/199 通过、1.18s；已提交 dist/ 与重编译一致；无新依赖。

其另注：落地门首跑 npm audit exit 1（proxy-addr critical 等 4 漏洞）后由 bbbcd34 修复——评审在恢复后确认 13-landing-gate.md 与 13b 的先后关系。

## 二、final-adversary（全程 6ab5444..62d2dd4）

verdict: **approve**，2 条 minor（→RF21/RF22，均已修复）。

1. `ccmr setup --yes --validate` exits 0 whenever keys exist, even when EVERY provider validation fails（README 宣传 CI 友好但门禁不能红）。建议全败 exit 1。
2. questionHidden 只处理 \r \n Ctrl+C DEL/BS；Ctrl+D（EOT）落入 else 分支被追加进 key buffer，trim 不剥 \u0004，控制字符原样写入 .env；多行粘贴的内嵌换行同理。建议 \u0004 视为中止 + 剥离控制字符。

干净项（直查确认）：secrets 全量扫描仅占位符；bbbcd34 严格传递 semver 升级（express 4.22.2→4.22.3、qs 6.15.3→6.16.0、path-to-regexp ~0.1.12→~0.1.13、proxy-addr 2.0.7→2.0.8、dev-only source-map-js），顺带修复 lockfile 陈旧版本；默认 action 未知命令恢复 exit 1、-V/-h 由 commander 先截获（仅美化问题：裸 ccmr 的手写命令列表与 program.help() 输出重复，未列为 finding）；readline close-recreate 模式正确且有 pty 证据、Ctrl+C 恢复 raw 模式 exit 130；.env 写入器原位填充不覆盖既有值、空格容错有测试钉住；五份拷贝 console_url 由真实 raw-yaml 测试钉死（trap #12）、真实 key 陷阱 #3 由 env 置空防御。

## 三、final-audit（全程 6ab5444..62d2dd4 验收审计）

verdict: **accept**，6 条 minor（→F1–F6 裁定见运行记录 RF20/RF23 相关行）。

C1–C5 全部 proven（证据链见其报告）。红线核查通过：分支无 upstream 未 push；package.json 仅版本行；bbbcd34 只动 lockfile；全量 diff 密钥扫描仅占位符；scratch 端口在预授权区间；.git/info/exclude 已披露；fixed-unreviewed 三提交均核实为真（f0fe5cc/b3606d7/0bd275c，含 config.ts:833-834 同引用确证）。

Findings：F1 审计期间工作树有 head 后在途改动（后经 1264a15 等提交过门收口）；F2 RF18 状态值 proven 越界 + round-2 原文未归档（本文件补齐）；F3 探针脏树戳（RF7/RF14 已承认）；F4 b8b5207 标题称 7/7 而证据实录 FAILED（后续提交已纠正，历史不改写）；F5 默认模型重问 3 次未识别后仍静默采纳（已修：改为跳过）；F6 4d7e7ce 类型误标 fix:（仅文档，历史不改写）。
