[![npm version](https://img.shields.io/npm/v/claude-code-model-router.svg)](https://www.npmjs.com/package/claude-code-model-router)
[![npm downloads](https://img.shields.io/npm/dm/claude-code-model-router.svg)](https://www.npmjs.com/package/claude-code-model-router)


# Claude Code Model Router

一个轻量级 API 网关，让你在使用 Claude Code 时可以切换到第三方 AI 模型。

支持 Windows、macOS、Linux 跨平台使用。

## 快速开始

### 方式一：全局安装（推荐）

```bash
npm install -g claude-code-model-router

# 然后使用 ccmr 命令
ccmr init      # 初始化配置（git 仓库内自动把 .env 加入 .gitignore）
               # 或 ccmr init --global 写入 ~/.ccmr 全目录共享
ccmr doctor    # （可选）连通性体检，确认各模型可用

# 启动 Claude Code（网关未运行时自动拉起，无需单独开终端）
ccmr claude    # 第三方模型（网关模式）
claude         # 官方订阅（默认模式）

# 日常切换默认模型
ccmr use kimi
```

### 方式二：使用 npx

```bash
# 1. 初始化配置文件（git 仓库内自动把 .env 加入 .gitignore）
npx claude-code-model-router init

# 2. 编辑 .env 文件，填入 API Keys

# 3. （可选）连通性体检，确认各模型可用
npx claude-code-model-router doctor

# 4. 启动 Claude Code——网关未运行时会自动拉起，无需单独开终端
# 第三方模型（网关模式）：
npx claude-code-model-router claude

# 官方订阅（默认模式）：
claude
```

> 也可以手动 `ccmr start` 前台启动网关（日志直接可见）；`ccmr claude` 自动拉起的网关日志在 `~/.ccmr/gateway.log`。

## 命令说明

```bash
# 初始化配置文件（git 仓库内会自动把 .env 加入 .gitignore）
npx claude-code-model-router init
npx claude-code-model-router init --global  # 写入 ~/.ccmr，全目录共享一份配置

# 启动网关（前台运行；models.yaml / .env 修改后自动热重载，无需重启）
npx claude-code-model-router start
npx claude-code-model-router start --port 9000  # 指定端口
npx claude-code-model-router start --host 0.0.0.0  # 需设置入站鉴权令牌

# 查看本机正在运行的网关（端口 / PID / 版本 / 配置来源 / Key 状态）
npx claude-code-model-router status

# 停止网关（含 `ccmr claude` 后台自动拉起的那个）
npx claude-code-model-router stop
npx claude-code-model-router stop --port 9000
npx claude-code-model-router stop --all

# 查看可用模型
npx claude-code-model-router models

# 切换默认模型（持久化写回 models.yaml，运行中的网关自动生效）
npx claude-code-model-router use kimi

# 连通性体检：对每个已配 Key 的模型发一条微型真实请求
# 一次性暴露端点错误、Key 失效、账号未开通模型等问题
npx claude-code-model-router doctor            # 检查全部
npx claude-code-model-router doctor seed kimi  # 只检查指定模型

# 查看网关的按模型用量统计（请求数 / 错误数 / tokens）
npx claude-code-model-router stats

# 启动 Claude Code（网关模式；网关未启动时会自动拉起）
npx claude-code-model-router claude
npx claude-code-model-router claude --gateway-port 9000  # 自定义网关端口

# 启动 Claude Code（官方订阅）
claude
```

> **配置发现顺序**：`-c 指定路径` > `./models.yaml` > `./config/models.yaml` > `./.claude-router.yaml` > `~/.ccmr/models.yaml`。显式 `-c` 不存在或配置非法时会直接报错，不会回退到另一份配置。`.env` 按 `~/.ccmr/.env` < `./.env` < 配置文件相邻 `.env` 的优先级加载，父进程环境变量优先级最高（`CCMR_HOME` 可改写全局目录位置，日志也随之移动）。

### 网关的生命周期

| 启动方式 | 关掉终端窗口后 | 日志去向 |
|----------|----------------|----------|
| `ccmr start` | **随之退出**（前台进程） | 直接打印在终端 |
| `ccmr claude` 自动拉起 | **继续在后台运行** | `~/.ccmr/gateway.log` |

自动拉起的网关是 detached 进程（自成进程组、`PPID=1`），收不到终端的 `SIGHUP`——这是有意设计：多个 Claude Code 会话可以共用同一个网关，关掉其中一个窗口不该打断其他会话。代价是它不会自己消失，用 `ccmr status` 查看、`ccmr stop` 收掉。

复用网关前会比较配置路径、路由内容、`.env` 来源及 API Key 的不可逆摘要。若端口上的网关来自另一个项目，`ccmr claude` 会拒绝复用并提示换端口或先停止旧网关，避免提示词发往错误的供应商账号。

> `ccmr stop` 会同时校验 `/health` 身份和 `~/.ccmr/gateway-<port>.identity.json` 中的本机随机身份记录，匹配后才会发送信号。只伪造 HTTP 响应不能诱导它停止任意 PID。由 v1.8.2 及更早版本启动的旧网关没有身份记录，沿用其 `/health` 自报 PID 停止，升级后仍可正常回收。

> **安全提示**：网关默认绑定到 `127.0.0.1`（仅本机可访问）。网关会用你本地配置的各厂商 API Key 代理上游请求，因此任何能访问该端口的人都能消耗你的额度。
> 若确需通过 `--host 0.0.0.0` 暴露到局域网，必须设置环境变量 `CCMR_REQUIRED_AUTH_TOKEN`，此时调用方需在 `x-api-key` 或 `Authorization: Bearer <token>` 中携带该令牌。未设置时网关默认拒绝启动；仅在已隔离且明确接受风险时使用 `--allow-insecure-network`。远程未认证的 `/health` 只返回基础存活信息，不暴露 PID、路径或 Key 状态。

### Claude Code 原生参数支持

`ccmr claude` 命令完整支持 Claude Code 的原生启动参数：

```bash
# YOLO 模式（跳过所有权限确认）
ccmr claude --dangerously-skip-permissions

# 继续上一次会话
ccmr claude --continue
ccmr claude -c

# YOLO 模式 + 继续上一次会话
ccmr claude --dangerously-skip-permissions --continue

# 恢复指定会话（交互式选择）
ccmr claude --resume
ccmr claude -r

# 恢复指定会话 ID
ccmr claude --resume <session-id>

# 调试模式
ccmr claude --debug
ccmr claude --verbose

# 连接 IDE
ccmr claude --ide

# 指定权限模式
ccmr claude --permission-mode bypassPermissions

# 打印模式（非交互式）
ccmr claude -p "你的问题"
ccmr claude --print --output-format json "你的问题"
```

**支持的完整参数列表：**

| 参数 | 说明 |
|------|------|
| `-c, --continue` | 继续最近的会话 |
| `-r, --resume [id]` | 恢复指定会话或打开会话选择器 |
| `--fork-session` | 恢复时创建新会话 ID |
| `--dangerously-skip-permissions` | 跳过所有权限检查（YOLO 模式） |
| `--permission-mode <mode>` | 权限模式：acceptEdits, bypassPermissions, default, dontAsk, plan |
| `-p, --print` | 打印模式（非交互式） |
| `--output-format <format>` | 输出格式：text, json, stream-json |
| `--model <model>` | 指定模型（覆盖网关路由） |
| `--system-prompt <prompt>` | 自定义系统提示 |
| `--add-dir <dirs...>` | 添加额外目录权限 |
| `-d, --debug` | 调试模式 |
| `--verbose` | 详细输出 |
| `--ide` | 自动连接 IDE |
| `--gateway-port <port>` | 指定网关端口（默认 8080） |

> **提示：** 任何 Claude Code 原生支持的参数都可以直接传递给 `ccmr claude`

`ccmr claude` 会为网关模式自动注入独立环境变量：

- `CLAUDE_CONFIG_DIR=~/.claude-gateway`
- `ANTHROPIC_BASE_URL=http://127.0.0.1:<gateway-port>`
- `ANTHROPIC_AUTH_TOKEN=ccmr-local-gateway`
- `ANTHROPIC_MODEL` 和 Claude 默认模型变量会指向当前 `default_model`
- `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 会按启动模型的 `context_window` 自动注入（如 Seed/Kimi 256K、DeepSeek 1M），避免 Claude Code 把第三方模型默认裁剪到 ~200k。若你已自行设置该变量，则尊重你的值不覆盖。注意它是会话级全局：运行时用 `/model` 切到不同上下文窗口的模型时，请重启或用 `ccmr claude --model <模型>` 重新启动以匹配

这些变量只作用于 `ccmr claude` 启动的 Claude Code 子进程，不会修改你的官方 Claude Code 配置，也不会影响直接运行 `claude` 的官方订阅模式。

## 支持的模型

| 短名称 | 版本别名 | 模型 | 提供商 |
|--------|----------|------|--------|
| `deepseek-v4-pro` | `deepseek`, `deepseek-v4`, `deepseek-pro`, `ds` | DeepSeek V4 Pro | DeepSeek |
| `deepseek-v4-flash` | `deepseek-flash`, `deepseek-chat` | DeepSeek V4 Flash | DeepSeek |
| `kimi-k3` | `k3` | Kimi K3 | Moonshot（国际站） |
| `kimi-k2.6` | `kimi`, `kimi-k2`, `moonshot` | Kimi K2.6 | Moonshot（国际站） |
| `kimi-k2.7-code` | `kimi-code`, `k2.7-code` | Kimi K2.7 Code | Moonshot（国际站） |
| `kimi-k2.7-code-highspeed` | `kimi-highspeed`, `k2.7-highspeed` | Kimi K2.7 Code HighSpeed | Moonshot（国际站） |
| `kimi-cn-k3` | `kimi-cn`, `moonshot-cn`, `k3-cn` | Kimi K3 | Moonshot（国内开放平台） |
| `kimi-cn-k2.6` | - | Kimi K2.6 | Moonshot（国内开放平台） |
| `kimi-cn-k2.7-code` | - | Kimi K2.7 Code | Moonshot（国内开放平台） |
| `kimi-cn-k2.7-code-highspeed` | - | Kimi K2.7 Code HighSpeed | Moonshot（国内开放平台） |
| `minimax-m3` | `minimax`, `minimax-cn`, `mm` | MiniMax M3 | MiniMax CN |
| `minimax-global-m3` | `minimax-global`, `minimax-io` | MiniMax M3 | MiniMax Global |
| `qwen3.5-plus` | `qwen`, `qwen3.5`, `tongyi` | Qwen3.5 Plus | 阿里云 |
| `qwen3.5-flash` | - | Qwen3.5 Flash | 阿里云 |
| `qwen3.7-max` | `qwen-max`, `qwen3.7` | Qwen3.7 Max | 阿里云 |
| `glm-5.2` | `glm`, `zhipu`, `chatglm` | GLM-5.2 | 智谱 AI（国内） |
| `glm-5.1` | `glm-5` | GLM-5.1 | 智谱 AI（国内） |
| `glm-global-5.2` | `glm-global`, `zai`, `z-ai` | GLM-5.2 | Z.ai（国际） |
| `glm-global-5.1` | - | GLM-5.1 | Z.ai（国际） |
| `step-3.7-flash` | `step`, `step-3.7`, `stepfun` | Step 3.7 Flash | 阶跃星辰(按量付费) |
| `step-plan-3.7-flash` | `step-plan`, `step-plan-3.7`, `stepplan` | Step 3.7 Flash (Step Plan) | 阶跃星辰(订阅) |
| `mimo-v2.5-pro` | `mimo`, `mimo-pro`, `mimo-token-sgp`, `xiaomi` | MiMo V2.5 Pro | MiMo Token Plan SGP |
| `mimo-v2.5` | `mimo-v2` | MiMo V2.5 | MiMo Token Plan SGP |
| `mimo-token-cn-v2.5-pro` | `mimo-token-cn`, `mimo-cn` | MiMo V2.5 Pro | MiMo Token Plan CN |
| `mimo-token-ams-v2.5-pro` | `mimo-token-ams`, `mimo-ams` | MiMo V2.5 Pro | MiMo Token Plan AMS |
| `mimo-payg-v2.5-pro` | `mimo-payg`, `mimo-payg-pro` | MiMo V2.5 Pro | MiMo Pay-as-you-go |
| `seed-2.1-pro` | `seed`, `seed-pro`, `doubao` | Doubao Seed 2.1 Pro | 火山方舟（按量付费） |
| `seed-2.1-turbo` | `seed-turbo` | Doubao Seed 2.1 Turbo | 火山方舟（按量付费） |
| `seed-plan-2.1-pro` | `seed-plan`, `seed-plan-pro`, `doubao-plan` | Doubao Seed 2.1 Pro | 火山方舟（Agent Plan 订阅） |
| `seed-plan-2.1-turbo` | `seed-plan-turbo` | Doubao Seed 2.1 Turbo | 火山方舟（Agent Plan 订阅） |

### 模型参数

| 模型 | Context Window | Max Output Tokens |
|------|----------------|-------------------|
| DeepSeek V4 Pro | 1M | 384K |
| DeepSeek V4 Flash | 1M | 384K |
| Kimi K3 (国际站 / 国内) | 1M | 1M（默认 128K） |
| Kimi K2.6 (国际站 / 国内) | 256K | 32K |
| Kimi K2.7 Code / HighSpeed (国际站 / 国内) | 256K | 32K |
| MiniMax M3 (CN / Global) | 1M | 128K |
| Qwen3.5 Plus | 1M | 64K |
| Qwen3.5 Flash | 1M | 64K |
| Qwen3.7 Max | 1M | 64K |
| GLM-5.2 (国内 / 国际) | 1M | 128K |
| GLM-5.1 (国内 / 国际) | 200K | 128K |
| Step 3.7 Flash (按量付费 / Step Plan) | 256K | 384K |
| MiMo V2.5 Pro | 1M | 128K |
| MiMo V2.5 | 1M | 128K |
| Doubao Seed 2.1 Pro / Turbo (按量付费 / Agent Plan) | 256K | 256K |

### 内置 Web Search 支持

Claude Code 内置的 `Web Search` 是 **Anthropic 服务端工具**（`web_search_20250305`）：搜索不在本地执行，而是由 API 提供方的服务器在生成过程中代跑。走网关后"服务器"是各家的 Anthropic 兼容端点，**是否真的执行搜索取决于供应商是否实现了该服务端工具**——网关对两种情况的转发行为完全相同。实测（2026-07-17，各发一条带 `web_search` 工具的真实请求）：

| 供应商 | 服务端 Web Search | 表现 |
|--------|-------------------|------|
| Moonshot 国内（kimi-cn-k3） | ✅ 支持 | 返回 `server_tool_use` + `web_search_tool_result`，搜到实时结果 |
| DeepSeek | ✅ 支持 | 同上 |
| MiniMax CN（minimax-m3） | ✅ 支持 | 同上 |
| 智谱 GLM（glm-5.2） | ❌ 不支持 | 工具被静默忽略，模型回答"无法联网"，Claude Code 显示 `Did 0 searches` |
| Qwen（qwen3.5-plus） | ❌ 不支持 | 同上 |

其余供应商（Kimi 国际站、GLM Global、Step、MiMo、Doubao Seed、MiniMax Global）未实测，以实际行为为准；供应商随时可能补齐支持。

对不支持的模型，可给 Claude Code 配一个**客户端执行**的 MCP 搜索工具（在本机跑，与所选模型无关），例如：

```bash
claude mcp add tavily -- npx -y tavily-mcp   # 也可用 Exa、Brave Search 等
```

内置的 `WebFetch`（抓取指定 URL）由客户端执行，各家模型均可正常使用，缺的只是"搜索"这一步。

## 配置

### 环境变量 (.env)

```bash
DEEPSEEK_API_KEY=sk-xxx    # https://platform.deepseek.com/
KIMI_API_KEY=sk-xxx        # Kimi 国际站: https://platform.kimi.ai/
KIMI_CN_API_KEY=sk-xxx     # Kimi 国内开放平台（与国际站不互通）: https://platform.kimi.com/
MINIMAX_API_KEY=xxx        # MiniMax CN / Token Plan: https://platform.minimaxi.com/
MINIMAX_GLOBAL_API_KEY=xxx # MiniMax Global: https://platform.minimax.io/
QWEN_API_KEY=sk-xxx        # https://dashscope.console.aliyun.com/
GLM_API_KEY=xxx            # GLM 国内版（智谱）: https://open.bigmodel.cn/
GLM_GLOBAL_API_KEY=xxx     # GLM 国际版（Z.ai）: https://z.ai/model-api
ARK_API_KEY=xxx            # Doubao Seed 火山方舟 按量付费 (/api/compatible): https://console.volcengine.com/ark
ARK_PLAN_API_KEY=xxx       # Doubao Seed 火山方舟 Agent Plan 订阅 (/api/plan) 专属 Key
STEP_API_KEY=xxx           # 阶跃星辰按量付费: https://platform.stepfun.com/
STEP_PLAN_API_KEY=xxx      # 阶跃星辰 Step Plan 订阅: https://platform.stepfun.com/
MIMO_API_KEY=tp-xxx        # MiMo Token Plan，默认 SGP 集群
MIMO_TOKEN_CN_API_KEY=tp-xxx  # MiMo Token Plan CN 集群
MIMO_TOKEN_AMS_API_KEY=tp-xxx # MiMo Token Plan AMS 集群
MIMO_PAYG_API_KEY=sk-xxx   # MiMo Pay-as-you-go: https://platform.xiaomimimo.com/

# 可选网关设置
GATEWAY_PORT=8080
REQUEST_TIMEOUT=300
LOG_LEVEL=INFO             # DEBUG / INFO / WARN / ERROR / SILENT
CCMR_REQUIRED_AUTH_TOKEN=  # 非回环监听时必须设置
```

`ccmr claude` 与 `ccmr stats` 会自动使用 `CCMR_REQUIRED_AUTH_TOKEN`。如客户端与服务端使用不同环境，可在客户端单独设置 `CCMR_AUTH_TOKEN` 覆盖发送令牌。

MiMo Token Plan 的 Base URL 与购买套餐所在集群绑定。默认 `mimo` 使用 SGP 集群；如果订阅页显示 CN 或 AMS 集群，请分别配置 `MIMO_TOKEN_CN_API_KEY` / `MIMO_TOKEN_AMS_API_KEY`，并使用 `mimo-token-cn` 或 `mimo-token-ams`。`tp-*` Token Plan Key 不能用于按量付费接口，`sk-*` 按量付费 Key 也不能用于 Token Plan 接口。

### 配置文件 (models.yaml)

可以自定义供应商、模型变体、别名等。运行 `init` 命令会生成 `providers -> variants` 结构的模板；旧版平铺 `models` 配置仍然兼容。

网关运行中修改 `models.yaml` 或 `.env` 会**自动热重载**（轮询检测，约 1 秒生效），新增、轮换或删除 Key 都会生效；入站鉴权令牌也可热轮换。即使文件启动时不存在，之后创建也会被捕获。注意：`gateway.host` / `gateway.port` 变更仍需重启才能重新绑定。

排查某个网关到底在用哪份配置：

```bash
curl -s :8080/health | jq '{version, config_file, ccmr_home, default_model}'
```

### 配置作用域：项目级 vs 全局

配置发现按当前目录优先：`./models.yaml` > `./config/models.yaml` > `./.claude-router.yaml` > `~/.ccmr/models.yaml`；`.env` 同理，`./.env` 逐变量覆盖 `~/.ccmr/.env`。`ccmr claude` 自动拉起网关时会**继承当前工作目录**，因此网关看到的配置和你在这个目录里看到的一致。

由此产生两种使用形态：

- **项目级**：Key 只放在某个项目目录的 `.env` 里（不配 `~/.ccmr/.env`）。在该目录里直接 `ccmr claude` 即可，无需手动 `ccmr start`——但网关是"项目级"的，**换到其他目录就不可用**：新目录里自动拉起的网关找不到任何 Key 会被启动检查拦下；而复用原网关会因配置来源指纹不一致（跨项目保护，防止 A 项目会话误用 B 项目的 Key 和路由）被 `ccmr claude` 拒绝。
- **全局**：`ccmr init --global` 生成 `~/.ccmr/models.yaml` + `~/.ccmr/.env` 并填入 Key（或直接把项目 `.env` 拷贝为 `~/.ccmr/.env`），之后在任意目录都能 `ccmr claude` 随开随用。

两者可以共存，但合并规则不同：`.env` 按**变量**逐个覆盖（项目值优先，shell 环境变量最优先）；`models.yaml` 则**整体取第一个命中的文件**——项目里存在 `models.yaml` 时全局那份完全不参与（两者都只与内置默认配置合并）。常见组合是"Key 放全局 `~/.ccmr/.env`、需要独立路由的项目放一份自己的 `models.yaml`"。

#### 故障降级（fallback）

任意 variant 可声明降级链，上游返回 5xx/429 或连接失败（含超时）时按序切换到备选模型；4xx 客户端错误不会触发降级，流式响应一旦开始输出也不再切换：

```yaml
providers:
  deepseek:
    # ...
    variants:
      v4-pro:
        model_id: deepseek-v4-pro
        fallback: [kimi-k2.6, glm-5.2]  # 依次降级
```

## 使用场景

### 双模式使用（配置完全隔离）

本工具通过独立的配置目录实现完全隔离，让你可以同时使用官方订阅和第三方模型：

```
┌─────────────────────────────────────────────────────────────────┐
│  模式1: 官方订阅（默认）                                          │
│  命令: claude                                                    │
│  配置: ~/.claude/settings.json                                  │
│  用途: 使用 Claude 官方模型（订阅额度）                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  模式2: 第三方模型（网关）                                        │
│  命令: npx claude-code-model-router claude                      │
│  配置: ~/.claude-gateway/settings.json                          │
│  用途: 使用第三方 AI 模型（DeepSeek, GLM, Qwen 等）              │
└─────────────────────────────────────────────────────────────────┘
```

#### 为什么配置是隔离的？

- **官方模式**使用 `~/.claude/` 配置目录（Claude Code 默认）
- **网关模式**使用 `~/.claude-gateway/` 配置目录（独立隔离）
- 两个配置目录完全独立，互不干扰
- 在网关模式切换模型不会影响官方模式

#### 使用步骤

**第一步：启动网关**
```bash
npx claude-code-model-router start
```

**第二步：选择使用模式**

**使用官方订阅（终端 A）：**
```bash
claude
```
- 使用官方 Claude 模型（Sonnet, Opus, Haiku）
- 消耗订阅额度
- 配置存储在 `~/.claude/`

**使用第三方模型（终端 B）：**
```bash
npx claude-code-model-router claude
```
- 使用第三方 AI 模型（DeepSeek V4, GLM-5.2, Qwen3.7, Kimi K2.6, Doubao Seed 2.1, MiMo V2.5 等）
- 按 API 使用量付费
- 配置存储在 `~/.claude-gateway/`

#### 跨平台支持

所有命令在 Windows、macOS、Linux 上完全相同，无需修改。

### 在 Claude Code 中切换模型

#### 官方模式（直接 `claude` 启动）

```
/model sonnet     # Claude Sonnet 4.5
/model opus       # Claude Opus 4.5
/model haiku      # Claude Haiku 3.5
```

#### 网关模式（`npx ... claude` 启动）

使用短名称或版本别名切换模型：

```bash
# 使用短名称（向后兼容）
/model deepseek   # 切换到 DeepSeek V4 Pro
/model qwen       # 切换到 Qwen3.5 Plus
/model qwen-max   # 切换到 Qwen3.7 Max
/model glm        # 切换到 GLM-5.2（国内 智谱）
/model glm-global # 切换到 GLM-5.2（国际 Z.ai）
/model seed       # 切换到 Doubao Seed 2.1 Pro（火山方舟 按量付费）
/model seed-plan  # 切换到 Doubao Seed 2.1 Pro（火山方舟 Agent Plan 订阅）
/model step       # 切换到 Step 3.7 Flash（按量付费）
/model step-plan  # 切换到 Step 3.7 Flash（Step Plan 订阅）
/model kimi       # 切换到 Kimi K2.6
/model kimi-code  # 切换到 Kimi K2.7 Code（编程专用）
/model kimi-highspeed # 切换到 Kimi K2.7 Code HighSpeed（约 6 倍速）
/model minimax    # 切换到 MiniMax M3（国内 Token Plan）
/model minimax-global # 切换到 MiniMax M3（海外）
/model mimo       # 切换到 MiMo V2.5 Pro（Token Plan SGP）
/model mimo-token-cn  # 切换到 MiMo V2.5 Pro（Token Plan CN）
/model mimo-payg      # 切换到 MiMo V2.5 Pro（按量付费）

# 使用版本别名（明确指定版本）
/model deepseek-v4-pro           # DeepSeek V4 Pro
/model deepseek-v4-flash         # DeepSeek V4 Flash
/model glm-5.2                   # GLM-5.2（国内 智谱）
/model glm-5.1                   # GLM-5.1（国内 智谱）
/model glm-global-5.2            # GLM-5.2（国际 Z.ai）
/model glm-global-5.1            # GLM-5.1（国际 Z.ai）
/model step-3.7-flash            # Step 3.7 Flash（按量付费）
/model step-plan-3.7-flash       # Step 3.7 Flash（Step Plan 订阅）
/model minimax-m3                # MiniMax M3
/model minimax-global-m3         # MiniMax M3 Global
/model kimi-k2.6                 # Kimi K2.6
/model kimi-k2.7-code            # Kimi K2.7 Code
/model kimi-k2.7-code-highspeed  # Kimi K2.7 Code HighSpeed
/model qwen3.5-plus              # Qwen3.5 Plus
/model qwen3.5-flash             # Qwen3.5 Flash
/model qwen3.7-max               # Qwen3.7 Max
/model seed-2.1-pro              # Doubao Seed 2.1 Pro（按量付费）
/model seed-2.1-turbo            # Doubao Seed 2.1 Turbo（按量付费）
/model seed-plan-2.1-pro         # Doubao Seed 2.1 Pro（Agent Plan 订阅）
/model seed-plan-2.1-turbo       # Doubao Seed 2.1 Turbo（Agent Plan 订阅）
/model mimo-v2.5-pro             # MiMo V2.5 Pro
/model mimo-v2.5                 # MiMo V2.5
/model mimo-token-ams-v2.5-pro   # MiMo V2.5 Pro Token Plan AMS
```

**重要：** 两个模式的配置完全独立，在网关模式切换模型不会影响官方模式！

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/v1/messages` | POST | Anthropic Messages API |
| `/v1/messages/count_tokens` | POST | 转发到所选供应商的兼容 token counting 端点 |
| `/v1/models` | GET | 列出可用模型 |
| `/usage` | GET | 按模型的用量统计（请求数 / 错误数 / tokens，网关重启后清零） |
| `/health` | GET | 健康检查；本机或已认证请求额外返回 PID、配置来源和模型状态 |

## 开发

```bash
# 克隆项目
git clone https://github.com/luwill/Claude-Code-Model-Router.git
cd Claude-Code-Model-Router

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 类型检查、测试、冒烟测试与依赖审计
npm run check

# 本地测试
npm link
ccmr start
```

## 故障排除

### 第一步：先跑 doctor

```bash
npx claude-code-model-router doctor
```

对每个已配 Key 的模型发一条微型真实请求，直接给出结论：连通（含延迟）/ 上游报错原文（Key 失效、模型未开通、端点错误）/ 未配 Key。绝大多数"模型用不了"的问题一条命令即可定位。

### 端口被占用

```bash
# 使用其他端口
npx claude-code-model-router start --port 9000
```

### API Key 错误

1. 运行 `npx claude-code-model-router doctor` 查看上游的具体报错
2. 检查 .env 文件中的 Key 是否正确（修改后网关自动热重载，无需重启）
3. 确认账户有余额
4. 运行 `npx claude-code-model-router models` 查看 Key 配置状态

### 换目录后 `ccmr claude` 被拒绝（无 Key / 配置来源不一致）

Key 只配在某个项目目录的 `.env` 里时，网关是项目级的，换目录不可用——见[配置作用域：项目级 vs 全局](#配置作用域项目级-vs-全局)。想在任意目录使用，运行 `ccmr init --global` 并把 Key 填入 `~/.ccmr/.env`。

### 模型不执行 Web Search（`Did 0 searches`）

内置 Web Search 是 Anthropic 服务端工具，是否可用取决于供应商——见[内置 Web Search 支持](#内置-web-search-支持)的实测表和 MCP 替代方案。

### 网关模式提示地区不支持

请确认是用 `npx claude-code-model-router claude` 或 `ccmr claude` 启动第三方模型模式，而不是直接运行 `claude`。网关模式会自动设置本地 `ANTHROPIC_BASE_URL`、`ANTHROPIC_AUTH_TOKEN` 和默认模型，避免 Claude Code 走官方 Anthropic 登录/地区检查路径。

### DeepSeek 报 `Invalid user_id`

DeepSeek Anthropic 兼容接口会忽略 `metadata` 字段，但某些 Claude Code 会话会携带包含特殊字符的 `metadata.user_id`，导致 DeepSeek 在请求校验阶段返回 400。路由器会在转发 DeepSeek 请求前移除该元数据，不影响上下文、工具调用或模型输出。

## 更新日志

### v1.9.1

- `ccmr claude` 启动模型缺少 API Key 时的指引拆分：若网关本身健康且有其他可用模型，直接提示 `ccmr use <可用模型>`（或 `--model` 单次指定、补配该模型的 Key），不再误导用户去 `ccmr stop` + `ccmr init` 重建配置；"stop + init"指引仅保留给网关完全无 Key 或不认识该模型的场景

### v1.9.0

- 新增 Kimi K3（Moonshot 旗舰，1M 上下文，`max_completion_tokens` 最高 1M）：国际站短名称 `kimi-k3`（别名 `k3`，沿用 `KIMI_API_KEY`）
- 新增 Kimi 国内开放平台入口（`api.moonshot.cn/anthropic`，platform.kimi.com，原 platform.moonshot.cn）：需配置 `KIMI_CN_API_KEY`（与国际站 Key 不互通），提供 `kimi-cn-k3`（别名 `kimi-cn` / `k3-cn`）及 K2 系列 `kimi-cn-k2.6` / `kimi-cn-k2.7-code` / `kimi-cn-k2.7-code-highspeed`

### v1.8.4

- **修复 v1.8.3 回归**：网关不再校验单条消息的 role/content——Claude Code v2.1+ 会在 `messages` 中携带 `role: "system"` 的上下文条目，v1.8.3 的白名单校验导致所有真实会话在本地报 `400 messages[1].role must be user or assistant`。网关现在只校验路由自身依赖的结构，消息协议交由上游判定
- `ccmr stop` 遇到无法自报 PID 的旧网关（v1.8.1 及更早）时，按平台给出手动停止命令（Windows 用 `netstat` + `taskkill`，不再显示无效的 `pkill`），并提示可改用其他端口
- `ccmr claude` 拒绝复用旧网关时，同时给出"换端口直接启动新网关"的出路，不再只有先停旧网关一条指引

### v1.8.3

- 阻止 detached 网关跨项目复用错误的配置、端点或 API Key
- 流式转发改用增量 UTF-8 解码，兼容 CRLF SSE；客户端断开会取消上游请求并处理背压，且不再误判为连接错误而触发 failover 或污染用量统计
- `.env` 删除 Key 后会真正撤销，入站鉴权支持热轮换；内置客户端统一使用相同令牌
- 非回环无鉴权监听改为默认拒绝，远程 `/health` 隐藏本机路径、PID 与 Key 状态
- `ccmr stop` 增加本机随机身份记录校验，不再只信任 HTTP 自报 PID（旧版网关没有身份记录，沿用原停止方式，升级后仍可回收）
- 显式配置路径、YAML、端口、超时和 CLI 数值参数改为严格校验；YAML/env/CLI 优先级保持一致
- 实现兼容 `/v1/messages/count_tokens` 转发，并执行 streaming/tools 能力声明
- 修复流式断连继续计费、生产依赖漏洞和缺失 LICENSE；CI/发布前新增依赖审计

### v1.8.2

- **新增 `ccmr status`**：列出本机正在运行的 ccmr 网关及其端口、PID、版本、配置来源、可用模型数。`ccmr claude` 自动拉起的网关是 detached 进程（关掉终端后继续运行），此前只能靠 `lsof` 才能找到它
- **新增 `ccmr stop`**：停止网关，支持 `--port` / `--all` / `--force`。**只会停止通过 `/health` 自证身份的 ccmr 网关**；端口被其他程序占用时明确报错并拒绝操作，不会误杀无关进程
- **`/health` 新增 `pid` 字段**：`status` / `stop` 因此无需解析 `lsof` / `netstat`，跨平台一致，且从原理上保证只能操作 ccmr 自己的进程
- **修复日志目录不一致**：自动拉起的网关日志此前写死在 `~/.ccmr/gateway.log`，不随 `CCMR_HOME` 移动，导致配置和日志分居两地
- README 补充网关生命周期说明（`ccmr start` 前台即退 vs `ccmr claude` 后台常驻）

### v1.8.1

修复一类隐蔽故障：网关在配置文件存在之前被 `ccmr claude` 自动拉起后，会静默地退回内置默认配置（零 API Key），且此后无论你怎么补配置都不会生效，表现为 Claude Code 里持续报 `401 API key not configured`。

- **热重载改为监视「候选路径」而非「启动时已存在的文件」**：先起网关、后跑 `ccmr init --global`（或手工放置 `models.yaml` / `.env`）现在也能被捕获，约 1 秒内自动生效。此前这种情况下监视列表为空，热重载永不触发
- **零可用模型时启动告警**：找不到配置文件、或 0 个模型有 API Key 时，启动横幅会明确警告并给出查找路径与修复命令，不再静默
- **`ccmr claude` 启动前校验模型可用性**：复用已在运行的网关前先检查它能否服务目标模型；不能则直接报错，附上该网关的配置来源与 `pkill` 修复命令，而不是让你在 Claude Code 内部撞上 401
- **`/health` 新增 `config_file` 与 `ccmr_home` 字段**：一条 `curl` 即可确认某个网关到底在用哪份配置

> `ccmr start` 行为不变。自动拉起只在目标端口探测不到网关时触发。

### v1.8.0

**易用性**
- 新增 `ccmr doctor [models...]`：对每个已配 Key 的模型发一条微型真实请求做连通性体检，一次性暴露端点错误、Key 失效、账号未开通模型等问题
- 新增 `ccmr use <model>`：持久化切换默认模型（文本级改写 `default_model`，保留注释），运行中的网关自动生效
- 新增 `ccmr stats` 与 `GET /usage`：按模型统计请求数 / 错误数 / 输入输出 tokens
- `ccmr claude` 检测网关未启动时**自动拉起**（detached，日志在 `~/.ccmr/gateway.log`）；检测到网关与 CLI 版本不一致时给出警告
- 配置热重载：网关运行中修改 `models.yaml` / `.env` 约 1 秒内自动生效，无需重启
- 全局配置目录：`~/.ccmr/models.yaml` 与 `~/.ccmr/.env` 作为兜底（cwd 优先），`ccmr init --global` 一键生成；`CCMR_HOME` 可改写位置
- 新增模型降级链：variant 级 `fallback: [...]`，上游 5xx/429/连接失败时按序切换备选模型

**风险修复**
- `ccmr init` 在 git 仓库内自动把 `.env` 加入 `.gitignore`，防止 API Key 被误提交
- 移除 ESM-only 的 node-fetch（CJS 产物在 Node <22.12 会 `ERR_REQUIRE_ESM` 崩溃），改用 Node 18+ 内置 fetch，`engines: >=18` 恢复真实；同时移除未使用的 chalk 依赖
- 流式转发增加空闲超时看门狗，上游挂死不再永久悬挂连接
- 入站鉴权改为常量时间比较（`crypto.timingSafeEqual`）
- 端口被占用时给出友好错误提示（原为裸堆栈崩溃）
- 配置热重载遇到损坏的 YAML 时保留旧配置继续运行，不再静默退化为默认配置

**工程化**
- 引入 vitest 测试体系：路由解析 / URL 构建 / SSE 转发 / 鉴权 / 热重载 / failover / 用量统计，以及 DEFAULT_CONFIG 与 YAML 模板的一致性测试
- 新增 GitHub Actions CI：Node 18/20/24 矩阵构建 + 测试 + dist 一致性校验

### v1.7.1
- 修正 Doubao Seed 接入点：按量付费应走 `https://ark.cn-beijing.volces.com/api/compatible`（而非旧 Coding Plan 的 `/api/coding`），模型 ID 带版本后缀 `doubao-seed-2-1-pro-260628` / `doubao-seed-2-1-turbo-260628`
- 新增 Agent Plan 订阅入口 `seed-plan`（`https://ark.cn-beijing.volces.com/api/plan`，需 `ARK_PLAN_API_KEY`），与按量付费 `seed` 区分，模式同 `step` / `step-plan`
- Kimi 新增 `kimi-k2.7-code` 与 `kimi-k2.7-code-highspeed`（编程专用，256K 上下文；别名 `kimi-code` / `kimi-highspeed`）
- `ccmr claude` 启动时按所选模型的 `context_window` 自动注入 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`（已自行设置则不覆盖），并在启动横幅显示当前模型与压缩窗口

### v1.7.0
- Qwen 旗舰升级为 Qwen3.7 Max（`qwen3.7-max`，别名 `qwen-max` / `qwen3.7`）
- GLM 升级为 GLM-5.2 并区分国内/国际版：
  - 国内版（智谱 `open.bigmodel.cn`）默认 `glm-5.2`，保留 `glm-5.1`
  - 新增国际版（Z.ai `api.z.ai`），别名 `glm-global` / `zai`，需配置 `GLM_GLOBAL_API_KEY`
- 新增字节豆包 Doubao Seed 2.1 Pro / Turbo（火山方舟 `ark.cn-beijing.volces.com`，Anthropic 协议），别名 `seed` / `seed-turbo` / `doubao`，需配置 `ARK_API_KEY`（目前仅国内版，国际版 BytePlus 暂未上线 Seed 2.1）

### v1.3.3
- CLI 和健康检查版本号改为从 `package.json` 读取，避免发布后显示旧版本

### v1.3.1
- MiniMax 默认端点切换为国内 Token Plan 兼容的 `https://api.minimaxi.com/anthropic`
- 新增 MiniMax Global 入口，海外 API Key 可使用 `MINIMAX_GLOBAL_API_KEY` 和 `minimax-global-*` 模型
- MiMo 默认切换为 Claude Code 文档推荐的 `mimo-v2.5-pro`，并区分 Token Plan 集群与 Pay-as-you-go API
- `ccmr claude` 自动注入本地网关认证 token 和默认模型，避免误走官方 Claude Code 地区检查
- DeepSeek 转发前移除 Claude Code 会话元数据，避免 `metadata.user_id` 格式触发上游 400 校验错误

### v1.3.0
- 新增供应商级 `providers -> variants` 配置结构，并兼容旧版平铺 `models` 配置
- 移除 KAT-Coder-Pro V2
- DeepSeek 更新为 DeepSeek V4 Pro / V4 Flash，并更新 Anthropic API 配置
- Kimi 更新为 Kimi K2.6
- GLM 更新为 GLM-5.1
- MiniMax 新增 MiniMax M2.7 Highspeed
- Qwen 新增 Qwen3.5 Flash 和 Qwen3 Max
- 新增 MiMo V2.5

### v1.2.0
- 更新 GLM 模型至 GLM-5 版本
- 更新 MiniMax 模型至 M2.7 版本
- 更新 Qwen 模型至 Qwen3.5 Plus 版本
- 更新 Kimi 模型至 K2.5 版本
- 更新各模型的 context window 和 max tokens 参数
- 新增版本别名支持（如 `glm-5`、`minimax-m2.7`、`qwen3.5-plus`、`kimi-k2.5`）

### v1.1.0
- 更新 MiniMax 模型至 M2.1 版本
- 更新 GLM 模型至 4.7 版本
- 更新 GLM API 端点至 `https://open.bigmodel.cn/api/anthropic`
- 新增版本别名支持（如 `glm-4.7`、`minimax-m2.1`）
- 优化日志显示，显示具体模型版本
- 更新各模型的 context window 和 max tokens 参数

### v1.0.1
- 添加 Claude Code 原生参数支持

### v1.0.0
- 初始版本发布

## License

[MIT](LICENSE)
