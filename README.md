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
# Linux/macOS:
export ANTHROPIC_BASE_URL=http://localhost:8080 && claude

# Windows CMD:
set ANTHROPIC_BASE_URL=http://localhost:8080 && claude

# Windows PowerShell:
$env:ANTHROPIC_BASE_URL="http://localhost:8080"; claude
```

### 方式二：全局安装

```bash
npm install -g claude-code-model-router

# 然后使用 ccmr 命令
ccmr init
ccmr start
ccmr claude  # 自动配置环境变量并启动 Claude Code
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

# 启动连接网关的 Claude Code
npx claude-code-model-router claude
```

## 支持的模型

| 别名 | 模型 | 提供商 |
|------|------|--------|
| `deepseek` | DeepSeek V3.2 | DeepSeek |
| `kimi` | Kimi K2 Thinking | Moonshot |
| `minimax` | MiniMax M2 | MiniMax |
| `qwen` | Qwen3 Max | 阿里云 |
| `glm` | GLM 4.6 | 智谱 AI |

## 配置

### 环境变量 (.env)

```bash
DEEPSEEK_API_KEY=sk-xxx    # https://platform.deepseek.com/
KIMI_API_KEY=sk-xxx        # https://www.kimi.com/
MINIMAX_API_KEY=xxx        # https://platform.minimax.io/
QWEN_API_KEY=sk-xxx        # https://dashscope.console.aliyun.com/
GLM_API_KEY=xxx            # https://open.bigmodel.cn/
```

### 配置文件 (models.yaml)

可以自定义模型配置、添加别名等。运行 `init` 命令会生成模板。

## 使用场景

### 双终端模式

```
┌─────────────────────────────────────────────────────────────────┐
│  终端 A: Claude 官方模型（订阅额度）                              │
│  > claude                                                       │
│  > /model opus                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  终端 B: 第三方模型（API 付费）                                   │
│  > export ANTHROPIC_BASE_URL=http://localhost:8080              │
│  > claude                                                       │
│  > /model deepseek                                              │
└─────────────────────────────────────────────────────────────────┘
```

- **终端 A**：直接运行 `claude`，使用订阅额度
- **终端 B**：设置环境变量后运行，使用第三方模型

### 在 Claude Code 中切换模型

```
/model deepseek   # 切换到 DeepSeek
/model qwen       # 切换到 Qwen
/model kimi       # 切换到 Kimi
```

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/v1/messages` | POST | Anthropic Messages API |
| `/v1/models` | GET | 列出可用模型 |
| `/health` | GET | 健康检查 |

## 开发

```bash
# 克隆项目
git clone <repo>
cd claude-code-model-router

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

## License

MIT
