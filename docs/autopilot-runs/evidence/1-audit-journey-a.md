# Journey A: fresh machine, zero keys — 2026-10-09 09:46:06, commit 109a372

## A1 bare ccmr (no args)
Usage: ccmr [options] [command]

Claude Code Model Router - A lightweight API gateway for multi-model switching

Options:
  -V, --version                 output the version number

## A2 init (already run; rerun shows idempotency)

Initializing Claude Code Model Router in /private/tmp/ccmr-jA...

[SKIP] /private/tmp/ccmr-jA/models.yaml already exists (use --force to overwrite)
[SKIP] /private/tmp/ccmr-jA/.env already exists (use --force to overwrite)
[WARN] Not a git repository - keep .env out of any version control

Next steps:
  1. Edit .env and add your API keys
  2. (Optional) Verify connectivity: npx claude-code-model-router doctor
  3. Start Claude Code (the gateway auto-starts if needed):

     # For third-party models (gateway mode):
     npx claude-code-model-router claude

     # For official subscription (default mode):
     claude

exit=0

## A3 models — availability counts
Ready: 0 / NoKey: 42 / total lines:      173

Available models:

  deepseek-v4-pro                  DeepSeek V4 Pro                          deepseek/v4-pro                      [33m[No API Key][0m
  deepseek-flash                   DeepSeek V4.1 Flash                      deepseek/flash                       [33m[No API Key][0m
  kimi-k3                          Kimi K3                                  moonshot/k3                          [33m[No API Key][0m

## A4 gateway startup log (zero keys, port 8091)

============================================================
  Claude Code Model Router
============================================================

Gateway running at: http://localhost:8091
Default model: deepseek-flash

Available models:
  - deepseek-v4-pro: DeepSeek V4 Pro (deepseek) [33m[No API Key][0m
  - deepseek-flash: DeepSeek V4.1 Flash (deepseek) [33m[No API Key][0m
  - kimi-k3: Kimi K3 (moonshot) [33m[No API Key][0m
  - kimi-k2.6: Kimi K2.6 (moonshot) [33m[No API Key][0m
  - kimi-k2.7-code: Kimi K2.7 Code (moonshot) [33m[No API Key][0m
  - kimi-k2.7-code-highspeed: Kimi K2.7 Code HighSpeed (moonshot) [33m[No API Key][0m
  - kimi-cn-k3: Kimi K3 (CN) (moonshot-cn) [33m[No API Key][0m
  - kimi-cn-k2.6: Kimi K2.6 (CN) (moonshot-cn) [33m[No API Key][0m
  - kimi-cn-k2.7-code: Kimi K2.7 Code (CN) (moonshot-cn) [33m[No API Key][0m
  - kimi-cn-k2.7-code-highspeed: Kimi K2.7 Code HighSpeed (CN) (moonshot-cn) [33m[No API Key][0m
  - kimi-plan-k3-1m: Kimi K3 1M (Coding Plan) (moonshot-code) [33m[No API Key][0m
  - kimi-plan-k3: Kimi K3 256K (Coding Plan) (moonshot-code) [33m[No API Key][0m
  - kimi-plan-for-coding: Kimi K2.7 Code (Coding Plan) (moonshot-code) [33m[No API Key][0m
  - kimi-plan-for-coding-highspeed: Kimi K2.7 Code HighSpeed (Coding Plan) (moonshot-code) [33m[No API Key][0m
  - minimax-m3: MiniMax M3 (minimax-cn) [33m[No API Key][0m
  - minimax-global-m3: MiniMax M3 (Global) (minimax-global) [33m[No API Key][0m
  - qwen3.8-max: Qwen3.8 Max (alibaba) [33m[No API Key][0m
  - qwen3.7-max: Qwen3.7 Max (alibaba) [33m[No API Key][0m
  - qwen3.8-flash: Qwen3.8 Flash (alibaba) [33m[No API Key][0m
  - qwen-plan-3.8-max: Qwen3.8 Max (Token Plan) (alibaba) [33m[No API Key][0m
  - qwen-plan-3.7-max: Qwen3.7 Max (Token Plan) (alibaba) [33m[No API Key][0m
  - qwen-plan-3.8-flash: Qwen3.8 Flash (Token Plan) (alibaba) [33m[No API Key][0m
  - glm-plan-5.3: GLM-5.3 (Coding Plan) (zhipu-coding) [33m[No API Key][0m
  - glm-plan-5.2: GLM-5.2 (Coding Plan) (zhipu-coding) [33m[No API Key][0m
  - glm-plan-5.3-flash: GLM-5.3-Flash (Coding Plan) (zhipu-coding) [33m[No API Key][0m
  - glm-global-5.3: GLM-5.3 (Global) (zhipu-global) [33m[No API Key][0m
  - glm-global-5.2: GLM-5.2 (Global) (zhipu-global) [33m[No API Key][0m
  - glm-global-5.3-flash: GLM-5.3-Flash (Global) (zhipu-global) [33m[No API Key][0m
  - step-5-preview: Step 5 Preview (stepfun) [33m[No API Key][0m
  - step-plan-5-preview: Step 5 Preview (Step Plan) (stepfun-plan) [33m[No API Key][0m
  - mimo-v2.5-pro: MiMo V2.5 Pro (xiaomi-token-sgp) [33m[No API Key][0m
  - mimo-v2.5: MiMo V2.5 (xiaomi-token-sgp) [33m[No API Key][0m
  - mimo-token-cn-v2.5-pro: MiMo V2.5 Pro (CN) (xiaomi-token-cn) [33m[No API Key][0m
  - mimo-token-cn-v2.5: MiMo V2.5 (CN) (xiaomi-token-cn) [33m[No API Key][0m
  - mimo-token-ams-v2.5-pro: MiMo V2.5 Pro (AMS) (xiaomi-token-ams) [33m[No API Key][0m
  - mimo-token-ams-v2.5: MiMo V2.5 (AMS) (xiaomi-token-ams) [33m[No API Key][0m
  - mimo-payg-v2.5-pro: MiMo V2.5 Pro (Pay-as-you-go) (xiaomi-payg) [33m[No API Key][0m
  - mimo-payg-v2.5: MiMo V2.5 (Pay-as-you-go) (xiaomi-payg) [33m[No API Key][0m
  - seed-2.1-pro: Doubao Seed 2.1 Pro (volcengine-ark) [33m[No API Key][0m
  - seed-2.1-turbo: Doubao Seed 2.1 Turbo (volcengine-ark) [33m[No API Key][0m
  - seed-plan-2.1-pro: Doubao Seed 2.1 Pro (Agent Plan) (volcengine-ark-plan) [33m[No API Key][0m
  - seed-plan-2.1-turbo: Doubao Seed 2.1 Turbo (Agent Plan) (volcengine-ark-plan) [33m[No API Key][0m

Hot reload: watching /private/tmp/ccmr-jA/models.yaml
  plus config/.env candidates under /private/tmp/ccmr-jA and /tmp/ccmr-fresh-home/.ccmr

[33m[WARNING][0m 0/42 models have an API key.
  Every request will fail with 401 until a key is configured.
  Add keys to /tmp/ccmr-fresh-home/.ccmr/.env (or ./.env), then check: ccmr doctor

Press Ctrl+C to stop the gateway.
============================================================


## A5 /health


## A6 POST /v1/messages deepseek-v4-pro (NO key)
HTTP 000
cat: /tmp/jA-post1.json: No such file or directory


## A7 POST /v1/messages glm-plan-5.3 (NO key)
HTTP 000
cat: /tmp/jA-post2.json: No such file or directory


## A8 doctor zero keys
exit=0 lines=      48

Checking model connectivity (one tiny request per model)...

  deepseek-v4-pro                  [33m[SKIP][0m -        DEEPSEEK_API_KEY not set
  deepseek-flash                   [33m[SKIP][0m -        DEEPSEEK_API_KEY not set
  kimi-k3                          [33m[SKIP][0m -        KIMI_API_KEY not set
  kimi-k2.6                        [33m[SKIP][0m -        KIMI_API_KEY not set
  kimi-k2.7-code                   [33m[SKIP][0m -        KIMI_API_KEY not set
  kimi-k2.7-code-highspeed         [33m[SKIP][0m -        KIMI_API_KEY not set
  kimi-cn-k3                       [33m[SKIP][0m -        KIMI_CN_API_KEY not set
...
  seed-2.1-turbo                   [33m[SKIP][0m -        ARK_API_KEY not set
  seed-plan-2.1-pro                [33m[SKIP][0m -        ARK_PLAN_API_KEY not set
  seed-plan-2.1-turbo              [33m[SKIP][0m -        ARK_PLAN_API_KEY not set

0 ok, 0 failed, 42 skipped (no API key)


## A9 use deepseek-v4-pro, then models (default marker?)

Default model set to: deepseek-v4-pro (DeepSeek V4 Pro)
Updated: /private/tmp/ccmr-jA/models.yaml
A running gateway using this config picks the change up automatically.


Available models:

  deepseek-v4-pro                  DeepSeek V4 Pro                          deepseek/v4-pro                      [33m[No API Key][0m
  deepseek-flash                   DeepSeek V4.1 Flash                      deepseek/flash                       [33m[No API Key][0m
4:  deepseek-v4-pro                  DeepSeek V4 Pro                          deepseek/v4-pro                      [33m[No API Key][0m
48:  deepseek -> deepseek-v4-pro
49:  deepseek-v4 -> deepseek-v4-pro
50:  deepseek-pro -> deepseek-v4-pro
58:  ds -> deepseek-v4-pro

## A10 status

Gateway on port 8080
  PID:           92031
  Version:       1.21.0
  Default model: glm-plan-5.3
  Config file:   /Users/louwill/.ccmr/models.yaml
  API keys:      26/42 models ready

Gateway on port 8081
  PID:           95108
  Version:       1.21.0
  Default model: glm-plan-5.3
  Config file:   /Users/louwill/.ccmr/models.yaml
  API keys:      37/42 models ready

Gateway on port 8091
  PID:           25963
  Version:       1.21.0
  Default model: deepseek-flash
  Config file:   /private/tmp/ccmr-jA/models.yaml
  API keys:      [33m0/42 models ready[0m

Stop one with: ccmr stop --port <port>

