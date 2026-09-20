# A preview model goes GA: changing a built-in default does not change existing installs

**Problem (one line):** StepFun's embargoed preview shipped as `step-5-preview`, so it had to become the flagship on both Step endpoints — and the bare aliases `step` / `step-plan` had to follow it, on a machine whose `~/.ccmr/models.yaml` already pins its own alias table.

## Approach

1. **Probe both endpoints before writing any code.** `curl` `/v1/messages` with the new id against the pay-as-you-go host and the subscription host: both 200 and echo `step-5-preview`, while the old codename is 404 on the subscription host and still alive on pay-go. That decides the shape of the change — two variants, not one — and it costs two requests.
2. **Write the test from the probe, watch it fail, then implement.** One `describe` per endpoint asserting `model_id`, `base_url`, `api_key_env`, context window and the alias resolutions, plus one that Flash is still reachable by its own names. Red first (3 failures), then the config edit.
3. **Edit all three copies of the model table.** `DEFAULT_CONFIG`, the embedded YAML template `generateConfigFile()` emits, and the alias map — the repo has a parity test that fails if the first two drift, and the alias map lives in both.
4. **Then check what the user's machine actually resolves.** `ccmr models` after `npm install -g .`: the new model keys appeared (provider `variants` merge, defaults ∪ user file) but `step` still resolved to Flash. `~/.ccmr/models.yaml` carries a full snapshot from `ccmr init --global`, and for maps that the user's file defines, **the user's entries win**. Shipping the new default in code is therefore only half the job; the local file needed the same `default_variant` and alias edits, with a timestamped backup first.
5. **Verify through the product, not through the unit tests.** `ccmr doctor` for both new model keys, run from a directory with no `.env`, with the key injected for that one command: both `[OK]`.

## Judgment calls

- **Asked before flipping the bare aliases.** `step` moving from Flash to the flagship is a 5x price change per token on pay-as-you-go. The repo precedent (GLM-5.3) says flagship-becomes-default, but precedent is not permission when the user pays the bill.
- **Did not copy the API key into `~/.ccmr/.env`.** The live key sits in another `.env` the user maintains; injecting it into one command's environment proves the integration without creating a second copy of a credential. Left that to the user.
- **Did not retire Step 3.7 Flash.** The vendor still serves it; only the bare aliases moved, and `step-3.7*` names stayed as they were, so old configs and scripts keep working.
- **Did not commit, publish, or restart the running 8080 gateway.** Publishing is outward-facing; restarting would kill whatever session is on that port.

## Reusable rule

When a default changes in a tool that generates a user-side config snapshot, fix the code **and** the generated copy on the machine — then prove it with the tool's own resolution output (`ccmr models`), because merge rules usually let the user's file win.
