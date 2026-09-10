# Retiring a model key: the compat alias you'd reach for first is the one that bricks upgrades

**Problem (one line):** DeepSeek replaced its whole V4 Flash line with `deepseek-flash`, so three ccmr model keys had to be retired — and the obvious "keep old names working" alias turned every pre-existing user config into an unloadable alias cycle.

## Approach

1. **Read the announcement for blast radius, not just the new model.** The post's headline was one new id, but three sentences down it retired two shipped models and put the router's *default model* (`deepseek-v4-pro`) on a 4-day routing deadline. Enumerate every id the change touches before writing tests.
2. **Ask the API which ids are still real.** One loop over all five ids, reading the `model` field the response echoes back: `deepseek-v4-flash`, `deepseek-v4-flash-vision-exp` and the expired beta id all answered as `deepseek-flash` (already routed), while `deepseek-v4-pro` still answered as itself. That echo is what separates "retired but aliased upstream" from "still a real model" — the docs never say it plainly.
3. **Re-verify the capability on the GA id with a *different* fixture.** The beta had been checked with a red PNG; the GA check used a blue one, so a cached or lucky answer can't pass. Blue → "Blue", input_tokens 227.
4. **Retire the keys, keep the names as aliases** — and then run the CLI against the user's real, *not yet regenerated* config. It failed instantly: `Alias cycle detected at 'deepseek-v4-flash'`. Pre-1.18 configs contain `deepseek-flash -> deepseek-v4-flash`; user configs merge *over* DEFAULT_CONFIG; adding `deepseek-v4-flash -> deepseek-flash` closes the loop. Every command dies, not just DeepSeek ones.
5. **Drop those two reverse aliases** and pin the reasoning with two tests: one asserting they are absent from `DEFAULT_CONFIG.aliases`, one building a synthetic pre-1.18 config and asserting `ConfigManager` still loads it. Without the second test the first looks like an arbitrary omission a future session would "fix".

## Judgment calls

- **`deepseek-v4-pro` and the `deepseek` default stay put.** The id still returns a real V4 Pro today; the vendor's routing starts 09-14. Changing `default_model` alters behavior for every new install and wasn't asked for — flagged in the report instead.
- **Vision aliases (`deepseek-vision`, `ds-vision`) repoint at `deepseek-flash`** rather than being deleted: V4.1 Flash is natively multimodal, so the name still means what it says.
- **`qs` advisory left alone** — its only fix is `npm audit fix --force` into Express 5. `js-yaml` (the high) and `@vitest/mocker` took semver-compatible bumps, lockfile only.
- **Old model keys were removed, not kept as zombie variants pointing at the new id.** Zombies would have shown three near-identical models in `ccmr models` forever.

## Reusable rule

Before removing a model key from a config layer that user files merge over, add the compat alias, then load a *real pre-change user config* through the public entry point — a new alias plus an old alias pointing the other way is a cycle, and the merge semantics mean it fails everything, not just the feature you touched.
