# Shipping a vendor's temporary beta model id without a docs page

**Problem (one line):** Add `deepseek-v4.1-flash-expires-on-0910` (announced only via the vendor's WeChat assistant, expiring in 2 days, no docs page) to ccmr, including proving its claimed native multimodality.

## Approach

1. **Treat the announcement as the spec sheet and live calls as the doc page.** The only first-party facts were: keep base_url, the dated model id, "billed like v4-flash", 20 concurrency, expires 09-10. Everything else was established empirically before any edit: text call 200 (0.34s), and a locally generated 8×8 solid-red PNG sent as an Anthropic base64 image block answered "Red" with input_tokens jumping 100→227 — proof the image entered context.
2. **Always run the negative control.** The same image request against shipped `deepseek-v4-flash` succeeded (200) but its thinking said "User says unsupported image" — the endpoint now *silently substitutes a placeholder* for text models. Without the control, "multimodal works" would have been unfalsifiable; with it, the control also exposed that our recorded claim "text models 400 on images" had gone stale, which got fixed in the same change.
3. **Probe limits by API validation error — and accept when the probe fails.** `max_tokens: 2000000` was accepted (no validation upstream), so no observable cap exists. Fallback: inherit the sibling's limits (v4-flash 1M/384K, justified by "billed like v4-flash") and say so verbatim in the config comment and changelog instead of presenting inherited numbers as vendor facts.
4. **Encode the expiry in the artifact, not just the docs:** display name carries `(Beta, expires 09-10)`, config comment and changelog state the removal plan, and the model *key* (`deepseek-v4.1-flash-exp`) omits the date so a future replacement id can reuse the key without breaking users' muscle memory.
5. Then the normal rail: RED tests → Copy 1/2 → README/version → build → doctor `[OK] 0.59s` → full check.

## Judgment calls

- **Model key without the date** (`-exp` suffix like the vision model) while `model_id` keeps the full dated string — users type the stable part, the wire carries the vendor's exact id.
- **Stale-comment fix bundled** with the feature (same files, observed in the same experiment) rather than a separate cleanup commit.
- **No commit/push** — in this repo those are separate explicit requests.

## Reusable rule

For a model that exists only as an announcement: verify every claimed capability with a live call *plus a sibling-model negative control*, probe limits via validation errors, and when a probe comes back non-validating, inherit from the billing-equivalent sibling and label the numbers as inherited — never as vendor-documented.
