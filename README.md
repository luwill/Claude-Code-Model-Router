[![npm version](https://img.shields.io/npm/v/claude-code-model-router.svg)](https://www.npmjs.com/package/claude-code-model-router)
[![npm downloads](https://img.shields.io/npm/dm/claude-code-model-router.svg)](https://www.npmjs.com/package/claude-code-model-router)
[![CI](https://github.com/luwill/Claude-Code-Model-Router/actions/workflows/ci.yml/badge.svg)](https://github.com/luwill/Claude-Code-Model-Router/actions/workflows/ci.yml)
[![node](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://www.npmjs.com/package/claude-code-model-router)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

# 🔀 ccmr — Claude Code Model Router

**Switch between 40+ third-party models mid-conversation — no restarts, no config editing.**

ccmr is a lightweight gateway that runs on your machine: Claude Code talks to it, and it forwards every request verbatim to whichever model you pick — DeepSeek, Kimi, Qwen, GLM, MiniMax, Step, MiMo or Doubao Seed, 42 models across 8 vendors, all prewired. Type `/model kimi` in a session and the very next message runs on Kimi. When a key dies, the error tells you exactly which env var to fix, where to get a new key, and the command that verifies it. Config edits hot-reload in about a second. Loopback-only by default; everything stays local.

**English** · [简体中文](README.zh-CN.md)

```text
$ npx claude-code-model-router@latest setup

Providers (key status from environment and .env):
   1. DeepSeek        DEEPSEEK_API_KEY        [no key]
   2. Kimi            KIMI_API_KEY            [no key]
   ... (18 entries, console URLs included)
Configure which providers? 1
Paste DEEPSEEK_API_KEY for DeepSeek (get one: https://platform.deepseek.com/): ********
Verify keys now with one tiny request per provider? [y/N] y
  [OK] deepseek-v4-pro
Default model [deepseek-flash] (Enter = accept):

$ ccmr claude        # into Claude Code — switch freely, in-session:
> /model kimi        # last message was DeepSeek, this one is Kimi
> /model glm         # and now GLM-5.3
```

## Why ccmr

For most setups, switching models means editing env vars or config files and restarting Claude Code. ccmr is a **live gateway**: switching happens inside the session (`/model`, effective on the next message, context preserved), because Claude Code always faces one stable local address — the change happens behind it.

| | Manual env editing | Config switchers | **ccmr** |
|---|---|---|---|
| Switching models | Edit file + restart | Edit file + restart | **`/model` in-session, instant** |
| Conversation context | Lost on restart | Lost on restart | **Preserved** |
| Built-in models | Fill in per-vendor endpoints/IDs | Enter per vendor | **42 models / 8 vendors prewired, alias to pick** |
| Key health | You find out on failure | — | **`ccmr doctor`: one tiny real request per model** |
| On a 401 | One raw passthrough line | — | **Vendor text kept + which var, which console, which command** |
| Usage stats | — | — | **Per-model requests / errors / tokens** |
| Failover | — | — | **5xx/429 falls through your fallback chain** |
| Hot reload | — | — | **models.yaml/.env edits live in ~1s** |
| Alongside your subscription | — | Often collide | **Isolated config dir; `claude` and `ccmr claude` never touch each other** |

> Honest scope: ccmr is an Anthropic-protocol **passthrough** gateway — it does no protocol conversion and only talks to vendors' official Anthropic-compatible endpoints (that's why Zhipu CN is supported via its Coding Plan only: its pay-as-you-go side offers no Anthropic endpoint). Streaming, tool calls and thinking blocks are forwarded as-is; your context is never parsed or rewritten.

## Quick start

```bash
# One command: pick providers → paste keys (hidden input) → optional live
# verification → set the default model
npx claude-code-model-router@latest setup   # the gateway auto-starts when needed

# Start Claude Code (third-party models, gateway mode)
npx claude-code-model-router claude

# Or install globally and use ccmr directly
npm install -g claude-code-model-router
ccmr setup
ccmr claude
```

```bash
# CI / scripts (no prompts): takes keys from the environment, verifies each
# provider, exits 1 if every validation fails
DEEPSEEK_API_KEY=sk-... npx claude-code-model-router setup --yes --validate
```

> You can also run the gateway in the foreground with `ccmr start` (logs in your terminal); gateways auto-started by `ccmr claude` log to `~/.ccmr/gateway.log`.
> Plain `claude` still uses your official subscription — the two modes have fully isolated configs.

## Commands

```bash
ccmr init      # Generate config files (.env is gitignored automatically inside a git repo)
ccmr init --global  # Write to ~/.ccmr so every directory shares one config

ccmr setup     # Guided key setup: hidden input, optional per-provider verification
ccmr setup --yes --validate  # Non-interactive (CI): env keys + verification

ccmr start     # Run the gateway in the foreground (config hot-reloads, no restarts)
ccmr start --port 9000 --host 0.0.0.0  # custom port / LAN (auth token required)

ccmr status    # List running gateways (port / PID / version / config source / key status)
ccmr stop [--port N | --all]  # Stop gateways (identity-verified, not by port alone)

ccmr models    # List models; * marks the default, per-model key status included
ccmr use kimi  # Set the default model (persisted; a running gateway picks it up live)

ccmr doctor    # Connectivity check: one tiny real request per keyed model,
               # surfacing dead keys / unactivated models / wrong endpoints verbatim
ccmr stats     # Per-model usage from the running gateway (names the port it read)

ccmr claude    # Launch Claude Code through the gateway (auto-starts it if needed)
ccmr update    # Update ccmr itself from npm (--check to only look)
```

> **Config discovery**: `-c path` > `./models.yaml` > `./config/models.yaml` > `./.claude-router.yaml` > `~/.ccmr/models.yaml`. An explicit `-c` that is missing or invalid errors out — it never silently falls back to another file. `.env` loads as `~/.ccmr/.env` < `./.env` < the config-adjacent `.env`, with parent-process env vars winning over all files (`CCMR_HOME` relocates the global dir).

### Gateway lifecycle

| Started by | After you close the terminal | Logs |
|---|---|---|
| `ccmr start` | **Exits** (foreground process) | Your terminal |
| Auto-started by `ccmr claude` | **Keeps running** (detached, own process group) | `~/.ccmr/gateway.log` |

The auto-started gateway intentionally survives its terminal so several Claude Code sessions can share it; it also can't be confused with another project's gateway — `ccmr claude` compares config paths, routing contents and irreversible key digests before reusing one, and refuses when they don't match. `ccmr stop` verifies both the `/health` identity and a local random identity file before signalling anything.

> **Security**: the gateway binds to `127.0.0.1` by default and proxies with your local vendor keys — anyone who can reach the port can spend your quota. Exposing it (`--host 0.0.0.0`) requires `CCMR_REQUIRED_AUTH_TOKEN` (callers send it as `x-api-key` or `Authorization: Bearer`); without the token the gateway refuses to start rather than listen in the clear. Unauthenticated remote `/health` returns only bare liveness.

### Native Claude Code arguments

`ccmr claude` passes through every native flag:

```bash
ccmr claude --dangerously-skip-permissions     # YOLO mode
ccmr claude --continue                         # resume the latest session
ccmr claude --resume <session-id>              # resume a specific session
ccmr claude -p "question" --output-format json # headless / scripting
ccmr claude --model glm-flash                  # one-off model override
ccmr claude --permission-mode acceptEdits --ide
```

`ccmr claude` injects isolated env vars for gateway mode only — `CLAUDE_CONFIG_DIR=~/.claude-gateway`, `ANTHROPIC_BASE_URL=127.0.0.1:<port>`, plus the default model. Models with a ≥1M context window get the `[1m]` suffix automatically (the only marker Claude Code honors to actually open 1M context; the gateway strips it before upstream), and `CLAUDE_CODE_AUTO_COMPACT_WINDOW` is sized from the launch model so Claude Code doesn't clip third-party models to ~200k. Nothing touches your official `~/.claude` config.

## Supported models

42 models across 8 vendors; short names and version aliases both work everywhere (`/model`, `ccmr use`, `--model`).

| Model | Aliases | Provider |
|--------|----------|--------|
| `deepseek-v4-pro` | `deepseek`, `deepseek-v4`, `deepseek-pro`, `ds` | DeepSeek (vendor is retiring it; routes to V4.1 Flash from 09-14) |
| `deepseek-flash` | `deepseek-chat`, `ds-4.1`, `deepseek-vision`, … | DeepSeek V4.1 Flash (natively multimodal) |
| `kimi-k3` / `kimi-k2.6` / `kimi-k2.7-code` / `kimi-k2.7-code-highspeed` | `kimi`, `k3`, `moonshot`, `kimi-code`, … | Moonshot (global) |
| `kimi-cn-*` (same four) | `kimi-cn`, `moonshot-cn`, … | Moonshot (CN open platform) |
| `kimi-plan-k3-1m` / `kimi-plan-k3` / `kimi-plan-for-coding` / `kimi-plan-for-coding-highspeed` | `kimi-plan`, `kimi-for-coding` | Kimi Code membership (coding plans) |
| `minimax-m3` | `minimax`, `mm` | MiniMax CN |
| `minimax-global-m3` | `minimax-global`, `minimax-io` | MiniMax Global |
| `qwen3.8-max` / `qwen3.7-max` / `qwen3.8-flash` | `qwen`, `tongyi`, `qwen-max`, `qwen-flash` | Alibaba Cloud (pay-as-you-go) |
| `qwen-plan-3.8-max` / `qwen-plan-3.7-max` / `qwen-plan-3.8-flash` | `qwen-plan`, `qwen-plan-max`, … | Qwen Token Plan (subscription) |
| `glm-plan-5.3` / `glm-plan-5.2` / `glm-plan-5.3-flash` | `glm`, `zhipu`, `chatglm`, `glm-flash` | Zhipu GLM Coding Plan (subscription) |
| `glm-global-5.3` / `glm-global-5.2` / `glm-global-5.3-flash` | `glm-global`, `zai`, `zai-flash` | Z.ai (international) |
| `step-5-preview` | `step`, `step-5`, `stepfun` | StepFun (pay-as-you-go) |
| `step-plan-5-preview` | `step-plan`, `stepplan` | StepFun Step Plan (subscription) |
| `mimo-v2.5-pro` / `mimo-v2.5` | `mimo`, `mimo-pro`, `xiaomi` | MiMo Token Plan (SGP) |
| `mimo-token-cn-v2.5-pro` / `mimo-token-ams-v2.5-pro` | `mimo-cn`, `mimo-ams` | MiMo Token Plan (CN / AMS clusters) |
| `mimo-payg-v2.5-pro` | `mimo-payg` | MiMo pay-as-you-go |
| `seed-2.1-pro` / `seed-2.1-turbo` | `seed`, `doubao`, `seed-turbo` | Volcengine Ark (pay-as-you-go) |
| `seed-plan-2.1-pro` / `seed-plan-2.1-turbo` | `seed-plan`, `doubao-plan` | Volcengine Ark (Agent Plan) |

Run `ccmr models` for the authoritative list with per-model key status, or see the [Chinese README](README.zh-CN.md) for the full alias table and the context-window/max-output matrix.

### Built-in Web Search

Claude Code's built-in Web Search is a **server-side tool** — whether it actually executes depends on the vendor implementing it. Measured (2026-07-17, one real `web_search` request each): supported by Moonshot CN, DeepSeek and MiniMax CN; silently ignored by Zhipu GLM and Qwen pay-as-you-go (`Did 0 searches`). Unmeasured vendors vary — check with `ccmr doctor`-style realism, and for models without it, add a client-side MCP search tool (`claude mcp add tavily -- npx -y tavily-mcp`), which runs locally regardless of model. `WebFetch` is client-side and works everywhere.

## Configuration

### Keys (.env)

`ccmr setup` is the guided path; editing `.env` by hand works too:

```bash
DEEPSEEK_API_KEY=sk-xxx    # https://platform.deepseek.com/
KIMI_API_KEY=sk-xxx        # Kimi global: https://platform.kimi.ai/
KIMI_CN_API_KEY=sk-xxx     # Kimi CN platform: https://platform.kimi.com/
KIMI_CODE_API_KEY=sk-xxx   # Kimi Code membership: https://www.kimi.com/code/console
MINIMAX_API_KEY=xxx        # https://platform.minimaxi.com/
MINIMAX_GLOBAL_API_KEY=xxx # https://platform.minimax.io/
QWEN_API_KEY=sk-xxx        # https://dashscope.console.aliyun.com/
QWEN_PLAN_API_KEY=sk-sp-xx # Qwen Token Plan: https://platform.qianwenai.com/
GLM_PLAN_API_KEY=xxx       # GLM Coding Plan: https://bigmodel.cn/claude-code
GLM_GLOBAL_API_KEY=xxx     # Z.ai: https://z.ai/model-api
ARK_API_KEY=xxx            # Volcengine Ark: https://console.volcengine.com/ark
ARK_PLAN_API_KEY=xxx       # Volcengine Agent Plan key
STEP_API_KEY=xxx           # https://platform.stepfun.com/
STEP_PLAN_API_KEY=xxx      # StepFun Step Plan
MIMO_API_KEY=tp-xxx        # MiMo Token Plan (SGP)
MIMO_TOKEN_CN_API_KEY=tp-xxx   # MiMo Token Plan (CN cluster)
MIMO_TOKEN_AMS_API_KEY=tp-xxx  # MiMo Token Plan (AMS cluster)
MIMO_PAYG_API_KEY=sk-xxx   # https://platform.xiaomimimo.com/

GATEWAY_PORT=8080          # optional overrides
REQUEST_TIMEOUT=300
LOG_LEVEL=INFO             # DEBUG / INFO / WARN / ERROR / SILENT
CCMR_REQUIRED_AUTH_TOKEN=  # required when binding non-loopback
```

MiMo Token Plan keys (`tp-*`) are cluster-bound — use the CN/AMS vars if your subscription page shows those clusters. Zhipu CN supports **Coding Plan subscriptions only** on its Anthropic endpoint (pay-as-you-go keys get `429 [1309]`; no conversion is done — see the honesty note above).

### models.yaml

`ccmr init` generates a full `providers → variants` template you can customize: your own vendors, model IDs, aliases, per-variant fallback chains. Edits hot-reload in ~1s (keys, routes, even the inbound auth token); only `gateway.host`/`gateway.port` need a restart. Diagnosing which config a gateway actually uses:

```bash
curl -s :8080/health | jq '{version, config_file, ccmr_home, default_model}'
```

### Project vs global scope

Config discovery is cwd-first: a `./models.yaml` wins over `~/.ccmr/models.yaml` (each merges over built-in defaults); `.env` merges per-variable with project > global, shell env above both. Keys in a project `.env` make that gateway project-scoped — `ccmr claude` from other directories refuses to reuse it (cross-project protection). `ccmr init --global` + keys in `~/.ccmr/.env` gives you `ccmr claude` from anywhere. Common combo: global keys, per-project `models.yaml` where routing differs.

### Failover

Any variant can declare a fallback chain; upstream 5xx/429/connection failures walk it in order. Client errors (4xx) never trigger failover, and switching stops once a stream has produced output:

```yaml
providers:
  deepseek:
    variants:
      v4-pro:
        model_id: deepseek-v4-pro
        fallback: [kimi-k2.6, glm-plan-5.2]
```

## Two modes, zero interference

```
┌──────────────────────────────────────────────┐  ┌──────────────────────────────────────────────┐
│ Official subscription                        │  │ Third-party models (gateway)                  │
│ command: claude                              │  │ command: ccmr claude                          │
│ config:   ~/.claude                          │  │ config:   ~/.claude-gateway (isolated)        │
│ uses:     Claude official models             │  │ uses:     DeepSeek / GLM / Qwen / Kimi / …    │
└──────────────────────────────────────────────┘  └──────────────────────────────────────────────┘
```

Switching models in gateway mode never touches your official setup. In-session switching:

```text
> /model deepseek       # DeepSeek
> /model qwen-plan      # Qwen3.8 Max via Token Plan
> /model glm            # GLM-5.3 via Coding Plan
> /model step           # Step 5 Preview
> /model kimi-highspeed # Kimi K2.7 Code HighSpeed
```

## API endpoints

| Endpoint | Method | Purpose |
|------|------|------|
| `/v1/messages` | POST | Anthropic Messages API (passthrough) |
| `/v1/messages/count_tokens` | POST | Forwarded to the vendor's compatible endpoint |
| `/v1/models` | GET | Model list (what `/model` consumes) |
| `/usage` | GET | Per-model usage counters (reset on gateway restart) |
| `/health` | GET | Liveness; loopback/authenticated callers also get PID, config source, key status |

## Troubleshooting

**Step zero, always: `ccmr doctor`.** One tiny real request per keyed model answers most "model X doesn't work" cases: dead key, unactivated model, wrong endpoint — with the vendor's verbatim error.

- **Port busy** → `ccmr start --port 9000`
- **API key errors** → `ccmr doctor` shows the upstream text; fix `.env` (hot-reloads, no restart); `ccmr models` shows key status
- **`ccmr claude` refused after changing directories** → your keys are project-scoped; run `ccmr init --global` and put keys in `~/.ccmr/.env`
- **`Did 0 searches`** → the vendor doesn't implement server-side Web Search; see the table above and the MCP alternative
- **"Region not supported"** → you ran plain `claude`; gateway mode is `ccmr claude` (it sets `ANTHROPIC_BASE_URL`/auth locally, skipping the official login/region path)
- **DeepSeek `Invalid user_id`** → handled by the gateway (it strips the metadata field that some sessions carry)

## Development

```bash
git clone https://github.com/luwill/Claude-Code-Model-Router.git && cd Claude-Code-Model-Router
npm install
npm run check   # typecheck + tests + build + smoke + audit
npm test        # vitest, fast and offline
```

## Changelog

### v1.22.0 — usability deep-dive

- **`ccmr setup`**: one guided command — provider table with key status, hidden key input, optional per-provider live verification (the same tiny request `doctor` sends), `.env` written in place (gitignored automatically), default model set. `--yes` runs non-interactively from env keys; `--validate` exits 1 when every provider fails (a CI gate that can actually fail).
- **Self-healing key errors**: a 401 now names the env var, the vendor console URL, and the `ccmr doctor` command — on the streaming path too, with the vendor's original text preserved.
- **`ccmr models` marks the default model** (`*` + legend); **`ccmr stats` names the gateway port it read**.
- Honesty regression-locks across `listModels` / `/v1/models` / `/health`; `console_url` pinned by consistency tests across DEFAULT_CONFIG, the YAML template and the `.env` comments.

Full history (v1.8.0 → v1.21.0, in Chinese) lives in [README.zh-CN.md](README.zh-CN.md#更新日志).

## License

[MIT](LICENSE)
