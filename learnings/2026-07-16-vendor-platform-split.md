# Adding a model when the vendor runs two platforms: split, don't overload

## The problem, in one line

"新增 kimi-k3" came with an official config snippet pointing at `api.moonshot.cn`, but
ccmr's existing kimi provider (and the user's live config) point at `api.moonshot.ai` —
and the two platforms' API keys do not interoperate.

## The approach

1. **Source the specs before touching config.** The pasted snippet gave only model_id and
   base_url. Context window and max output came from the vendor's own docs, quoted
   verbatim: `platform.kimi.com/docs/pricing/chat-k3` (1M context) and
   `docs/guide/kimi-k3-quickstart` ("`max_completion_tokens` 默认 131072，最大可设置为
   1048576"). A summarizing fetch had garbled this once — re-fetch asking for the exact
   sentence before trusting a number.
2. **Check what `max_tokens` actually does before choosing its value.** In ccmr it is a
   clamp on outgoing requests (`router.ts`: cap body.max_tokens at the model limit), so
   the right value is the vendor's *hard maximum* (1048576), not its default (131072).
   The same number can be wrong for one semantic and right for another.
3. **Detect the platform fork early and make it the user's decision.** Grepped the repo:
   `.cn` had never been used; the user's live config uses `.ai`; the two platforms'
   keys don't interoperate. That is a public-behavior fork (which endpoint the default
   config ships), so it went to the user as three concrete options instead of a guess.
   They chose the dual-provider route.
4. **Copy the repo's own precedent.** minimax/minimax-global and glm/glm-global already
   encode the CN/international split: separate provider key, separate `*_API_KEY` env,
   display names suffixed, model names `<provider>-<variant>`. `kimi-cn` reused that
   shape wholesale — zero new design.
5. **TDD at the public seam, then walk the Five Copies.** Failing ConfigManager tests
   first (model keys, aliases, base_url, api_key_env), then DEFAULT_CONFIG → YAML
   template → env template/.env.example → README tables/changelog → VSCode extension
   secrets.ts, verified by grepping `KIMI_CN_API_KEY` across both repos.
6. **Doctor with a control.** `doctor kimi-k3` returned `[401] Invalid Authentication`;
   before blaming the new entry, `doctor kimi-k2.6` with the same key returned the
   identical 401 — the credential is dead, the routing is fine. One extra request turned
   an ambiguous failure into a named layer.

## The judgment calls

- **Did NOT change the existing kimi provider's base_url to `.cn`** even though the
  user's snippet used it — that would silently break every existing international-key
  user. New endpoint = new provider, never a mutation of a shipped one.
- **Did NOT trust the third-party K3 coverage** (blogs claiming specs before the vendor
  published) — only numbers quoted from platform.kimi.com pages went into config.
- **Did NOT mark the task done on the 401** — reported the upstream error verbatim with
  the control-test evidence instead of retrying or paraphrasing it away.

## The reusable rule

When a vendor runs separate CN/international platforms, a new model request that names
one endpoint is a fork, not an instruction: check which platform the existing provider
and the user's live config use, and if keys don't interoperate, model the other platform
as a new provider with its own key env (copy the repo's existing split precedent) —
asking the user only the one question the code can't answer: which platform they want.
