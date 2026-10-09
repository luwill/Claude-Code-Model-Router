# Machine gate — landing

- commit: df71166
- working tree: clean (the gate refuses to start otherwise)
- recorded by: /Users/louwill/.claude-gateway/skills/autopilot/scripts/run-gate.sh (sha256 f7df72490cb4216d)
- started: 2026-10-09T02:44:52Z
- workdir: /Users/louwill/Vibing/Claude-Code-Model-Router

## 1. `npm run typecheck`

exit 0 · 1 s

```

> claude-code-model-router@1.22.0 typecheck
> tsc --noEmit

```

## 2. `npx vitest run`

exit 0 · 1 s

```

 RUN  v4.1.11 /Users/louwill/Vibing/Claude-Code-Model-Router


 Test Files  13 passed (13)
      Tests  202 passed (202)
   Start at  10:44:53
   Duration  1.19s (transform 635ms, setup 0ms, import 1.10s, tests 2.04s, environment 1ms)

```

## 3. `npm run build`

exit 0 · 1 s

```

> claude-code-model-router@1.22.0 build
> tsc

```

## 4. `node dist/cli.js models -c /tmp/ccmr-jA/models.yaml`

exit 0 · 0 s

```
  kimi-cn-k3 -> kimi-cn-k3
  k3-cn -> kimi-cn-k3
  kimi-cn-k2.6 -> kimi-cn-k2.6
  kimi-cn-k2.7-code -> kimi-cn-k2.7-code
  kimi-cn-k2.7-code-highspeed -> kimi-cn-k2.7-code-highspeed
  kimi-plan -> kimi-plan-k3-1m
  kimi-plan-k3-1m -> kimi-plan-k3-1m
  kimi-plan-k3 -> kimi-plan-k3
  kimi-for-coding -> kimi-plan-for-coding
  kimi-plan-for-coding -> kimi-plan-for-coding
  kimi-plan-for-coding-highspeed -> kimi-plan-for-coding-highspeed
  kimi-plan-highspeed -> kimi-plan-for-coding-highspeed
  minimax -> minimax-m3
  minimax-cn -> minimax-m3
  minimax-m3 -> minimax-m3
  minimaxi -> minimax-m3
  minimax-global -> minimax-global-m3
  minimax-io -> minimax-global-m3
  minimax-global-m3 -> minimax-global-m3
  mm -> minimax-m3
  qwen -> qwen3.8-max
  tongyi -> qwen3.8-max
  qwen3.8 -> qwen3.8-max
  qwen3.8-max -> qwen3.8-max
  qwen-max -> qwen3.7-max
  qwen3.7-max -> qwen3.7-max
  qwen3.7 -> qwen3.7-max
  qwen-plan -> qwen-plan-3.8-max
  qwen-plan-3.8 -> qwen-plan-3.8-max
  qwen-plan-3.8-max -> qwen-plan-3.8-max
  qwen-plan-max -> qwen-plan-3.8-max
  qwen-plan-3.7 -> qwen-plan-3.7-max
  qwen-plan-3.7-max -> qwen-plan-3.7-max
  qwen-flash -> qwen3.8-flash
  qwen3.8-flash -> qwen3.8-flash
  qwen-plan-flash -> qwen-plan-3.8-flash
  qwen-plan-3.8-flash -> qwen-plan-3.8-flash
  glm -> glm-plan-5.3
  glm-5.3 -> glm-plan-5.3
  glm-5.2 -> glm-plan-5.2
  zhipu -> glm-plan-5.3
  chatglm -> glm-plan-5.3
  glm-plan -> glm-plan-5.3
  glm-plan-5.3 -> glm-plan-5.3
  glm-plan-5.2 -> glm-plan-5.2
  glm-flash -> glm-plan-5.3-flash
  glm-5.3-flash -> glm-plan-5.3-flash
  glm-plan-flash -> glm-plan-5.3-flash
  glm-plan-5.3-flash -> glm-plan-5.3-flash
  glm-global -> glm-global-5.3
  glm-global-5.3 -> glm-global-5.3
  glm-global-5.2 -> glm-global-5.2
  glm-global-flash -> glm-global-5.3-flash
  glm-global-5.3-flash -> glm-global-5.3-flash
  zai-flash -> glm-global-5.3-flash
  zai -> glm-global-5.3
  z-ai -> glm-global-5.3
  step -> step-5-preview
  step-5 -> step-5-preview
  step5 -> step-5-preview
  step-5-preview -> step-5-preview
  stepfun -> step-5-preview
  step-plan -> step-plan-5-preview
  step-plan-5 -> step-plan-5-preview
  step-plan-5-preview -> step-plan-5-preview
  stepplan -> step-plan-5-preview
  mimo -> mimo-v2.5-pro
  mimo-pro -> mimo-v2.5-pro
  mimo-token -> mimo-v2.5-pro
  mimo-token-sgp -> mimo-v2.5-pro
  mimo-sgp -> mimo-v2.5-pro
  mimo-v2 -> mimo-v2.5
  mimo-v2.5 -> mimo-v2.5
  mimo-v2.5-pro -> mimo-v2.5-pro
  mimo-token-cn -> mimo-token-cn-v2.5-pro
  mimo-cn -> mimo-token-cn-v2.5-pro
  mimo-token-cn-v2.5 -> mimo-token-cn-v2.5
  mimo-token-ams -> mimo-token-ams-v2.5-pro
  mimo-ams -> mimo-token-ams-v2.5-pro
  mimo-token-ams-v2.5 -> mimo-token-ams-v2.5
  mimo-payg -> mimo-payg-v2.5-pro
  mimo-payg-pro -> mimo-payg-v2.5-pro
  mimo-payg-v2.5 -> mimo-payg-v2.5
  xiaomi -> mimo-v2.5-pro
  seed -> seed-2.1-pro
  seed-pro -> seed-2.1-pro
  seed-2.1 -> seed-2.1-pro
  seed-2.1-pro -> seed-2.1-pro
  seed-turbo -> seed-2.1-turbo
  seed-2.1-turbo -> seed-2.1-turbo
  doubao -> seed-2.1-pro
  doubao-seed -> seed-2.1-pro
  seed-plan -> seed-plan-2.1-pro
  seed-plan-pro -> seed-plan-2.1-pro
  seed-plan-2.1 -> seed-plan-2.1-pro
  seed-plan-2.1-pro -> seed-plan-2.1-pro
  seed-plan-turbo -> seed-plan-2.1-turbo
  seed-plan-2.1-turbo -> seed-plan-2.1-turbo
  doubao-plan -> seed-plan-2.1-pro

```

## 5. `npm run smoke`

exit 0 · 0 s

```

> claude-code-model-router@1.22.0 smoke
> node scripts/smoke.mjs

  ok   dist/index.js loads via require()
  ok   ConfigManager is exported
  ok   gateway starts and answers /health
  ok   /health reports the loaded config file
  ok   /health reports the model as available
  ok   non-streaming request forwards and returns content
  ok   SSE stream passes message_start through
  ok   SSE stream passes text deltas through
  ok   SSE stream passes message_delta through
  ok   usage counts both requests

Smoke test passed on Node v24.14.0
```

## 6. `npm audit --audit-level=high`

exit 1 · 2 s

```
# npm audit report

proxy-addr  1.1.0 - 2.0.7
Severity: critical
proxy-addr vulnerable to IP spoofing via IPv4-mapped IPv6 trust subnet - https://github.com/advisories/GHSA-jqcg-44mw-7w3h
fix available via `npm audit fix`
node_modules/proxy-addr

qs  2.2.5 - 6.15.3
Severity: moderate
qs array-limit bypass via bracket-key comma parsing - https://github.com/advisories/GHSA-x5fp-wj9c-mxmx
qs: Denial of Service via Attacker Controlled isBuffer - https://github.com/advisories/GHSA-4mjr-xmp4-gh2g
fix available via `npm audit fix`
node_modules/qs
  express  4.22.2
  Depends on vulnerable versions of qs
  node_modules/express

source-map-js  1.0.0 - 1.2.1
Severity: high
source-map-js allows event-loop denial of service through indexed source-map section offsets - https://github.com/advisories/GHSA-68fv-2mgg-jv7q
fix available via `npm audit fix`
node_modules/source-map-js

4 vulnerabilities (2 moderate, 1 high, 1 critical)

To address all issues, run:
  npm audit fix
```

## 7. `git status --porcelain --untracked-files=no`

exit 0 · 0 s

```
```

- finished: 2026-10-09T02:44:57Z
- result: FAILED
