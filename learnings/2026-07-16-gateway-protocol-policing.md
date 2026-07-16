# Gateway 400 on every real session: don't police the upstream's protocol

## The problem, in one line

ccmr 1.8.3 added per-message schema validation (`role` must be user/assistant), and every
real Claude Code v2.1+ session died locally with `400 messages[1].role must be user or
assistant` — Claude Code sends harness context as `role: "system"` entries in `messages`.

## The approach

1. **Recognize whose error text it is before theorizing.** Grep the error string across the
   repo: `messages[1].role must be user or assistant` matched `requestValidationError` in
   `src/server.ts`. That instantly names the failing layer: the gateway's own local
   validation, not the upstream, not Claude Code.
2. **Capture what the client actually sends — don't guess the payload.** Built a 3-piece
   loop in the scratchpad, no real keys, no cost:
   - fake Anthropic upstream (canned JSON + SSE responses) on one scratch port,
   - a ~30-line logging proxy that dumps every request body to `bodies/NNN-req.json` and
     forwards to the gateway,
   - the real gateway (`node dist/cli.js start -p <scratch> -c <scratch yaml>`),
   then ran the real client headless: `ANTHROPIC_BASE_URL=<proxy> claude -p "hi"` with a
   scratch `CLAUDE_CONFIG_DIR`. One run reproduced the user's exact error string.
3. **Read the captured body.** `messages[1]` was `{role: "system", content: "Available
   agent types..."}` on `POST /v1/messages?beta=true`. Root cause proven, not inferred.
4. **Minimize to one curl** (`messages: [{role:"user"...},{role:"system"...}]` → 400) —
   that shape became the regression test at the HTTP seam.
5. **TDD the fix:** failing test first, then deleted the whole per-message validation loop.
   Re-ran the un-minimized loop (real headless `claude -p "hi"`) to confirm green end to end.

## The judgment calls

- **Did NOT whitelist `system` as a third allowed role.** That repeats the same mistake one
  protocol revision later. The gateway now validates only what routing depends on (body is
  an object, `model` string, `messages` is a non-empty array, `stream` boolean) and forwards
  everything else untouched.
- **Did NOT touch the user's live gateway or real keys.** The whole loop ran on scratch
  ports with a fake upstream; the real client was the only real component — and it's the
  one whose behavior was in question.
- **Did NOT trust memory of "what Claude Code sends".** The `role:"system"` entry is
  undocumented client behavior; only a live capture could establish it.

## The reusable rule

A passthrough gateway validates only the fields it routes on; every schema check beyond
that is a bet against the client's future — when a proxy suddenly rejects real traffic,
grep the error text to find whose validation fired, then capture live client traffic
through a logging proxy instead of reasoning about what the client "should" send.
