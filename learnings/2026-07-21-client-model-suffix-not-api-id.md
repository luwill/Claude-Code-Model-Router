# A `model[1m]`-style suffix is a client convention, not an API model id

**Problem (one line):** After v1.11.1, `kimi-plan-k3-1m` started returning
`401 ... Your model id does not exist, recognized as other:k3[1m]. Please set
model id as k3.`

## Approach

1. Read the error literally: the upstream is complaining about the *model id*
   `k3[1m]`, and even tells us the fix (`set model id as k3`). Auth clearly
   passed — a 401 status here is the vendor's choice for "unknown model", not a
   key problem.
2. Read the current official doc
   (kimi.com/code/docs/third-party-tools/claude-code). Decisive line: "`k3[1m]`
   写法仅在 Claude Code 环境变量场景需要 … 其它场景（API 请求、其它第三方工具的
   Model ID 字段）只需填 `k3`。"
3. Understood the mechanism: native Claude Code parses `ANTHROPIC_MODEL=k3[1m]`,
   **strips `[1m]`**, sends `model: k3` to the API, and uses the bracket only to
   set its own context window to 1M. ccmr is a passthrough gateway — it forwards
   the Model ID verbatim, so it was sending the literal `k3[1m]`.
4. Proved both directions with a direct curl to api.kimi.com/coding/v1/messages
   using the real key: `k3[1m]` → 401 (repro of the user's error), `k3` → 200.
5. Fixed `model_id: k3[1m] → k3` in all copies (DEFAULT_CONFIG, YAML template,
   and — per the merge-layer rule — both live user yamls). The 1M vs 256K split
   is unaffected: it rides on `context_window` → `CLAUDE_CODE_AUTO_COMPACT_WINDOW`,
   so `kimi-plan-k3-1m` and `kimi-plan-k3` now share upstream model `k3` and
   differ only by context window.

## Judgment calls (deliberately NOT done)

- **Did not treat the 401 as an auth/key problem.** The message named a model
  id, not the key; the fix was a model id, not a rotation.
- **Did not chase the post-fix 429.** After the fix, doctor returned `429 engine
  overloaded` — a *different, transient* layer (capacity). The model-id 401 was
  gone, and curl had already returned 200, so the fix was confirmed; the 429 is
  upstream load, not something to "fix" in code.
- **Did not invent a beta header for 1M.** ccmr sizes context via the env var it
  already injects; the API model is just `k3`.

## Reusable rule

A `model[1m]` / `model[256k]`-style suffix is a **Claude-Code client
convention** (CC strips it and sends the bare id), NOT an API model id. A
passthrough gateway must store the **bare** vendor model id (`k3`) and express
context sizing through `context_window` → `CLAUDE_CODE_AUTO_COMPACT_WINDOW`,
never bake the bracket into `model_id`. When an upstream says "model id does not
exist" for a bracketed/suffixed id, strip the suffix before suspecting anything
else. See also [[remove-model-merge-layer]] (the live-yaml copies had to be
patched too) and CLAUDE.md trap #5.
