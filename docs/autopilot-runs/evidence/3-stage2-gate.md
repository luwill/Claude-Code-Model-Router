# Machine gate — stage2

- commit: 82f64bd
- working tree: clean (the gate refuses to start otherwise)
- recorded by: /Users/louwill/.claude-gateway/skills/autopilot/scripts/run-gate.sh (sha256 f7df72490cb4216d)
- started: 2026-10-09T01:59:17Z
- workdir: /Users/louwill/Vibing/Claude-Code-Model-Router

## 1. `npm run typecheck`

exit 0 · 0 s

```

> claude-code-model-router@1.21.0 typecheck
> tsc --noEmit

```

## 2. `npx vitest run`

exit 0 · 2 s

```

 RUN  v4.1.11 /Users/louwill/Vibing/Claude-Code-Model-Router


 Test Files  12 passed (12)
      Tests  176 passed (176)
   Start at  09:59:17
   Duration  1.18s (transform 577ms, setup 0ms, import 966ms, tests 1.99s, environment 0ms)

```

## 3. `npm run build`

exit 0 · 0 s

```

> claude-code-model-router@1.21.0 build
> tsc

```

## 4. `node dist/cli.js models -c /tmp/ccmr-jA/models.yaml`

exit 0 · 0 s

```
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
> claude-code-model-router@1.21.0 smoke
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

## 6. `git status --porcelain --untracked-files=no`

exit 0 · 1 s

```
```

- finished: 2026-10-09T01:59:20Z
- result: passed
