[![npm version](https://img.shields.io/npm/v/claude-code-model-router.svg)](https://www.npmjs.com/package/claude-code-model-router)
[![npm downloads](https://img.shields.io/npm/dm/claude-code-model-router.svg)](https://www.npmjs.com/package/claude-code-model-router)


# Claude Code Model Router

一个轻量级 API 网关，让你在使用 Claude Code 时可以切换到第三方 AI 模型。

支持 Windows、macOS、Linux 跨平台使用。

## 快速开始

### 方式一：使用 npx（推荐）

```bash
# 1. 初始化配置文件
npx claude-code-model-router init

# 2. 编辑 .env 文件，填入 API Keys

# 3. 启动网关
npx claude-code-model-router start

# 4. 新开终端，启动 Claude Code
# 第三方模型（网关模式）：
npx claude-code-model-router claude

# 官方订阅（默认模式）：
claude
```

### 方式二：全局安装

```bash
npm install -g claude-code-model-router

# 然后使用 ccmr 命令
ccmr init
ccmr start

# 启动 Claude Code
ccmr claude    # 第三方模型（网关模式）
claude         # 官方订阅（默认模式）
```

## 命令说明

```bash
# 初始化配置文件
npx claude-code-model-router init

# 启动网关
npx claude-code-model-router start
npx claude-code-model-router start --port 9000  # 指定端口

# 查看可用模型
npx claude-code-model-router models

# 启动 Claude Code（网关模式，使用第三方模型）
npx claude-code-model-router claude
npx claude-code-model-router claude --gateway-port 9000  # 自定义网关端口

# 启动 Claude Code（官方订阅）
claude
```

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

这些变量只作用于 `ccmr claude` 启动的 Claude Code 子进程，不会修改你的官方 Claude Code 配置，也不会影响直接运行 `claude` 的官方订阅模式。

## 支持的模型

| 短名称 | 版本别名 | 模型 | 提供商 |
|--------|----------|------|--------|
| `deepseek-v4-pro` | `deepseek`, `deepseek-v4`, `deepseek-pro`, `ds` | DeepSeek V4 Pro | DeepSeek |
| `deepseek-v4-flash` | `deepseek-flash`, `deepseek-chat` | DeepSeek V4 Flash | DeepSeek |
| `kimi-k2.6` | `kimi`, `kimi-k2`, `moonshot` | Kimi K2.6 | Moonshot |
| `minimax-m2.7` | `minimax`, `minimax-cn`, `minimax-m2`, `mm` | MiniMax M2.7 | MiniMax CN |
| `minimax-m2.7-highspeed` | `minimax-highspeed`, `minimax-cn-highspeed` | MiniMax M2.7 Highspeed | MiniMax CN |
| `minimax-global-m2.7` | `minimax-global`, `minimax-io` | MiniMax M2.7 | MiniMax Global |
| `minimax-global-m2.7-highspeed` | `minimax-global-highspeed` | MiniMax M2.7 Highspeed | MiniMax Global |
| `qwen3.5-plus` | `qwen`, `qwen3.5`, `tongyi` | Qwen3.5 Plus | 阿里云 |
| `qwen3.5-flash` | - | Qwen3.5 Flash | 阿里云 |
| `qwen3-max` | - | Qwen3 Max | 阿里云 |
| `glm-5.1` | `glm`, `glm-5`, `zhipu`, `chatglm` | GLM-5.1 | 智谱 AI |
| `mimo-v2.5-pro` | `mimo`, `mimo-pro`, `mimo-token-sgp`, `xiaomi` | MiMo V2.5 Pro | MiMo Token Plan SGP |
| `mimo-v2.5` | `mimo-v2` | MiMo V2.5 | MiMo Token Plan SGP |
| `mimo-token-cn-v2.5-pro` | `mimo-token-cn`, `mimo-cn` | MiMo V2.5 Pro | MiMo Token Plan CN |
| `mimo-token-ams-v2.5-pro` | `mimo-token-ams`, `mimo-ams` | MiMo V2.5 Pro | MiMo Token Plan AMS |
| `mimo-payg-v2.5-pro` | `mimo-payg`, `mimo-payg-pro` | MiMo V2.5 Pro | MiMo Pay-as-you-go |

### 模型参数

| 模型 | Context Window | Max Output Tokens |
|------|----------------|-------------------|
| DeepSeek V4 Pro | 1M | 384K |
| DeepSeek V4 Flash | 1M | 384K |
| Kimi K2.6 | 256K | 32K |
| MiniMax M2.7 (CN / Global) | 200K | 192K |
| MiniMax M2.7 Highspeed (CN / Global) | 200K | 192K |
| Qwen3.5 Plus | 1M | 64K |
| Qwen3.5 Flash | 1M | 64K |
| Qwen3 Max | 1M | 64K |
| GLM-5.1 | 200K | 128K |
| MiMo V2.5 Pro | 1M | 128K |
| MiMo V2.5 | 1M | 128K |

## 配置

### 环境变量 (.env)

```bash
DEEPSEEK_API_KEY=sk-xxx    # https://platform.deepseek.com/
KIMI_API_KEY=sk-xxx        # https://platform.kimi.ai/
MINIMAX_API_KEY=xxx        # MiniMax CN / Token Plan: https://platform.minimaxi.com/
MINIMAX_GLOBAL_API_KEY=xxx # MiniMax Global: https://platform.minimax.io/
QWEN_API_KEY=sk-xxx        # https://dashscope.console.aliyun.com/
GLM_API_KEY=xxx            # https://open.bigmodel.cn/
MIMO_API_KEY=tp-xxx        # MiMo Token Plan，默认 SGP 集群
MIMO_TOKEN_CN_API_KEY=tp-xxx  # MiMo Token Plan CN 集群
MIMO_TOKEN_AMS_API_KEY=tp-xxx # MiMo Token Plan AMS 集群
MIMO_PAYG_API_KEY=sk-xxx   # MiMo Pay-as-you-go: https://platform.xiaomimimo.com/
```

MiMo Token Plan 的 Base URL 与购买套餐所在集群绑定。默认 `mimo` 使用 SGP 集群；如果订阅页显示 CN 或 AMS 集群，请分别配置 `MIMO_TOKEN_CN_API_KEY` / `MIMO_TOKEN_AMS_API_KEY`，并使用 `mimo-token-cn` 或 `mimo-token-ams`。`tp-*` Token Plan Key 不能用于按量付费接口，`sk-*` 按量付费 Key 也不能用于 Token Plan 接口。

### 配置文件 (models.yaml)

可以自定义供应商、模型变体、别名等。运行 `init` 命令会生成 `providers -> variants` 结构的模板；旧版平铺 `models` 配置仍然兼容。

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
- 使用第三方 AI 模型（DeepSeek V4, GLM-5.1, Qwen3.5, Kimi K2.6, MiMo V2.5 等）
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
/model glm        # 切换到 GLM-5.1
/model kimi       # 切换到 Kimi K2.6
/model minimax    # 切换到 MiniMax M2.7（国内 Token Plan）
/model minimax-global # 切换到 MiniMax M2.7（海外）
/model mimo       # 切换到 MiMo V2.5 Pro（Token Plan SGP）
/model mimo-token-cn  # 切换到 MiMo V2.5 Pro（Token Plan CN）
/model mimo-payg      # 切换到 MiMo V2.5 Pro（按量付费）

# 使用版本别名（明确指定版本）
/model deepseek-v4-pro           # DeepSeek V4 Pro
/model deepseek-v4-flash         # DeepSeek V4 Flash
/model glm-5.1                   # GLM-5.1
/model minimax-m2.7              # MiniMax M2.7
/model minimax-m2.7-highspeed    # MiniMax M2.7 Highspeed
/model minimax-global-m2.7       # MiniMax M2.7 Global
/model minimax-global-m2.7-highspeed # MiniMax M2.7 Highspeed Global
/model kimi-k2.6                 # Kimi K2.6
/model qwen3.5-plus              # Qwen3.5 Plus
/model qwen3.5-flash             # Qwen3.5 Flash
/model qwen3-max                 # Qwen3 Max
/model mimo-v2.5-pro             # MiMo V2.5 Pro
/model mimo-v2.5                 # MiMo V2.5
/model mimo-token-ams-v2.5-pro   # MiMo V2.5 Pro Token Plan AMS
```

**重要：** 两个模式的配置完全独立，在网关模式切换模型不会影响官方模式！

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/v1/messages` | POST | Anthropic Messages API |
| `/v1/models` | GET | 列出可用模型 |
| `/health` | GET | 健康检查 |

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

# 本地测试
npm link
ccmr start
```

## 故障排除

### 端口被占用

```bash
# 使用其他端口
npx claude-code-model-router start --port 9000
```

### API Key 错误

1. 检查 .env 文件中的 Key 是否正确
2. 确认账户有余额
3. 运行 `npx claude-code-model-router models` 查看状态

### 网关模式提示地区不支持

请确认是用 `npx claude-code-model-router claude` 或 `ccmr claude` 启动第三方模型模式，而不是直接运行 `claude`。网关模式会自动设置本地 `ANTHROPIC_BASE_URL`、`ANTHROPIC_AUTH_TOKEN` 和默认模型，避免 Claude Code 走官方 Anthropic 登录/地区检查路径。

### DeepSeek 报 `Invalid user_id`

DeepSeek Anthropic 兼容接口会忽略 `metadata` 字段，但某些 Claude Code 会话会携带包含特殊字符的 `metadata.user_id`，导致 DeepSeek 在请求校验阶段返回 400。路由器会在转发 DeepSeek 请求前移除该元数据，不影响上下文、工具调用或模型输出。

## 更新日志

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

MIT
