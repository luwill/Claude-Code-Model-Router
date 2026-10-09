# Machine gate — stage4

- commit: 27dd03a
- working tree: clean (the gate refuses to start otherwise)
- recorded by: /Users/louwill/.claude-gateway/skills/autopilot/scripts/run-gate.sh (sha256 f7df72490cb4216d)
- started: 2026-10-09T02:20:02Z
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


 Test Files  13 passed (13)
      Tests  194 passed (194)
   Start at  10:20:03
   Duration  1.23s (transform 1.01s, setup 0ms, import 1.60s, tests 2.10s, environment 1ms)

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

exit 0 · 1 s

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

exit 0 · 0 s

```
```

- finished: 2026-10-09T02:20:05Z
- result: passed
