# `/model` switches one slot; the gateway's default_model is baked into three others at launch

**Problem (one line):** After `/model deepseek-flash`, WebSearch and WebFetch still failed with `403 (moonshot-code) monthly usage limit` — the user's exhausted Kimi plan — even though the main conversation was demonstrably running on DeepSeek.

## Approach

1. **Read the provider tag in the error before theorising.** `Upstream API error (moonshot-code)` is ccmr's own label, which already proves the request reached the gateway and was routed to the Kimi Code provider. That single token rules out "Claude Code client bug" and points at model resolution, not connectivity.
2. **Let the gateway's own telemetry name the model.** `/usage` split the session cleanly: `deepseek-flash` 17 requests / 0 errors, `kimi-plan-k3-1m` **0 requests / 6 errors**. Two different models were serving one session — so the question was never "did /model work" but "what else picks a model".
3. **Find the second chooser.** `src/cli.ts` sets `ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_OPUS_MODEL` and `ANTHROPIC_DEFAULT_HAIKU_MODEL` all to `defaultModel` at launch. `/model` retargets the conversation slot inside Claude Code; the haiku slot stays whatever the environment said at spawn time. WebFetch and WebSearch run on the small/fast slot, so they kept hitting the launch default.
4. **Reproduce through the gateway, not through the UI.** One curl per model against `127.0.0.1:8080/v1/messages` returned the user's 403 verbatim for `kimi-plan-k3-1m` and a clean 200 for `deepseek-flash` — a two-second deterministic loop that pins the whole claim.
5. **Check the fix actually fixes the feature, not just the error.** Anthropic's `web_search` is a server-side tool, so switching the slot only helps if DeepSeek honours it. A curl with `tools:[{type:"web_search_20250305"}]` came back with a real `server_tool_use` block — it does.
6. Fix was configuration, not code: `ccmr use deepseek-flash` rewrote one line of `~/.ccmr/models.yaml`; the running gateway hot-reloaded it (`config_source_id` changed).

## Judgment calls

- **Didn't touch router code.** The 403 is an exhausted subscription plus a config pointing at it. `isRetryable` deliberately covers only 429 and 5xx, so a quota 403 does not fall back — widening that is a product decision (a dead key also returns 403), not a bug fix to slip into a diagnosis.
- **Polled `/health` again instead of declaring a hot-reload bug.** The first read showed the stale default; it was my own impatience, not a defect. One retry loop before accusing the code.
- **Left the gateway running.** Env vars are injected at spawn, so the user must restart the *Claude Code session*, not the gateway — restarting the gateway would have changed nothing and violated the repo's rule about processes I don't own.

## Reusable rule

When one session shows two different models' errors, stop asking whether the model switch worked and go find the *other* thing that chooses a model — env vars captured at process spawn don't move when an in-session command does, so a per-slot default outlives every `/model`.
