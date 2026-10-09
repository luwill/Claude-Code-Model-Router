# Stage 4 live E2E: guided setup — 2026-10-09 10:19:52, commit 9259d23-dirty
(key values redacted; source: repo .env STEP_API_KEY — the one key B6 proved live)

## F1 bare ccmr, fresh machine (first-run detection, audit M5)

Claude Code Model Router v1.21.0

No configuration found and no provider keys detected. Start here:

  ccmr setup    # guided: choose providers, paste keys, verify, set default
  ccmr init     # or just generate the config files to edit by hand


Commands:
  init      Create configuration files (--global for ~/.ccmr)
  setup     Guided key setup (or --yes for non-interactive)

## F2 setup --yes with ZERO keys (guidance + exit 1)
[31m[ERROR][0m No API keys configured. Run `ccmr setup` to add them interactively, or export at least one provider key (see `ccmr models`) and retry.
exit=1

## F3 setup --yes --validate with a live key in env (1 tiny real request)

[32m[OK][0m 1 key(s) persisted to /private/tmp/ccmr-jF/.env
  [32m[OK][0m step-5-preview
Default model: step-5-preview

exit=0
resulting .env: 1 filled value(s); resulting default: default_model: step-5-preview

## F4 interactive setup, answers piped (select 11=StepFun, paste key, N=no validation, Enter=accept default)

Providers (key status from environment and .env):

   1. DeepSeek                 DEEPSEEK_API_KEY       [33m[no key][0m
   2. Kimi                     KIMI_API_KEY           [33m[no key][0m
   3. Kimi CN                  KIMI_CN_API_KEY        [33m[no key][0m
   4. Kimi Code                KIMI_CODE_API_KEY      [33m[no key][0m
   5. MiniMax CN               MINIMAX_API_KEY        [33m[no key][0m
   6. MiniMax Global           MINIMAX_GLOBAL_API_KEY [33m[no key][0m
   7. Qwen                     QWEN_API_KEY           [33m[no key][0m
   8. Qwen Token Plan          QWEN_PLAN_API_KEY      [33m[no key][0m
   9. GLM Coding Plan          GLM_PLAN_API_KEY       [33m[no key][0m
  10. GLM Global               GLM_GLOBAL_API_KEY     [33m[no key][0m
  11. StepFun                  STEP_API_KEY           [33m[no key][0m
  12. StepFun Step Plan        STEP_PLAN_API_KEY      [33m[no key][0m
  13. MiMo Token Plan SGP      MIMO_API_KEY           [33m[no key][0m
  14. MiMo Token Plan CN       MIMO_TOKEN_CN_API_KEY  [33m[no key][0m
  15. MiMo Token Plan AMS      MIMO_TOKEN_AMS_API_KEY [33m[no key][0m
  16. MiMo Pay-as-you-go       MIMO_PAYG_API_KEY      [33m[no key][0m
  17. Doubao Seed (Volcengine) ARK_API_KEY            [33m[no key][0m
  18. Doubao Seed (Volcengine Agent Plan) ARK_PLAN_API_KEY       [33m[no key][0m

Keys will be written to: /private/tmp/ccmr-jG/.env
Configure which providers? (e.g. 1,3 or all — Enter to skip) 
Paste STEP_API_KEY for StepFun (get one: https://platform.stepfun.com/): More providers? (numbers, or Enter to continue) [32m[OK][0m Wrote 1 key(s) to /private/tmp/ccmr-jG/.env
Verify keys now with one tiny request per provider? [y/N] Default model [step-5-preview] (Enter = accept, k = keep deepseek-flash, n = skip): [32m[OK][0m Default model: step-5-preview

Next steps:
  ccmr claude    # start Claude Code through the gateway
  ccmr doctor    # full connectivity report
  ccmr models    # list models and switch defaults

exit=0
resulting .env: STEP_API_KEY=<redacted>
resulting default: default_model: step-5-preview
