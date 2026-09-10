# A client-side marker has to be added at every exit and stripped at the entrance

**Problem (one line):** Claude Code silently clamps third-party models to ~200k behind a custom base URL and only opens the full window when the model name ends in `[1m]`, so the user had to retype `deepseek-flash[1m]` after every launch and every `/model`.

## Approach

1. **Establish which side owns the marker before designing anything.** A repo comment on the Kimi plan variant already recorded the load-bearing fact: `[1m]` is a Claude-Code-only convention, native CC strips it before calling the API, and Kimi answers `k3[1m]` with 401. So the suffix must never reach upstream — it is presentation, not identity.
2. **Confirm the gateway's current stance empirically.** `curl` with `model: "deepseek-flash[1m]"` returned `Model 'deepseek-flash[1m]' not found`, while the user reported that typing the suffix in Claude Code *works*. Those two facts together prove Claude Code strips it, and that ccmr would 404 the moment anything else didn't.
3. **Map the symptom to exits.** Two complaints — "on launch" and "after /model" — are two different code paths: the env vars injected at spawn (`ANTHROPIC_MODEL` and the three slot variables) and the ids served by `GET /v1/models`. Fixing one leaves half the bug.
4. **Strip at the entrance first (slice 1), then decorate the exits (slices 2–3).** Doing it in that order means the exits can never produce a name the router rejects. `resolveModelName` strips before alias resolution, so `ds-4.1[1m]` resolves like `ds-4.1`.
5. **Pick the threshold from real data, not intuition.** Vendors report 1M as both `1000000` and `1048576`; a `>= 1_000_000` rule covers 27 of 42 variants and leaves 256k models (Seed, Kimi K2.x, Step) bare — a false `[1m]` there would make Claude Code overrun the real window, which is worse than the original bug.

## Judgment calls

- **Did not rename model keys.** The suffix is derived at the boundary from `context_window`, so aliases, `ccmr use`, `ccmr models` and every user config stay untouched, and a vendor changing a context window automatically changes the advertised name.
- **Did not touch `CLAUDE_CODE_AUTO_COMPACT_WINDOW`.** It solves a different problem (compaction threshold) and remains session-global; `[1m]` gates the window, the env var gates compaction. Both are needed and the README now says which is which.
- **Threshold tests were written after the module existed** (slice 1 created it), so they never went red — they are specification tests pinning the boundary, not TDD drivers. Worth being honest about rather than presenting as red-green.
- **VSCode extension left alone.** It injects the same four variables and has the identical bug, but it consumes ccmr as a published library, so it cannot call `withContextSuffix` until 1.19.0 is on npm.

## Reusable rule

When a downstream client encodes a capability in the *name* it was handed, that name is presentation: generate it at every exit from the underlying property, and strip it at the entrance before any lookup — never let it become part of the identity you store, alias, or forward.
