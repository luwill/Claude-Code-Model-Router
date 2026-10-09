# Review round-1 fixes — live verification — 2026-10-09 10:30:01, commit 3990024-dirty
All commands run with env -i HOME=/tmp/ccmr-fresh-home (clean environment).

## R1 zero-key models probe at HEAD (C1 after-archive; auditor-stage2 F2)
$ env -i ... node dist/cli.js models -c /tmp/ccmr-jA/models.yaml | grep -c
Ready: 0 / NoKey: 42 / default marker line: * deepseek-v4-pro is the default model (change with: ccmr use <model>)
Available models:

* deepseek-v4-pro                  DeepSeek V4 Pro                          deepseek/v4-pro                      [33m[No API Key][0m

## R2 shorthand default marker (adversary-stage2 finding, fixed)
$ ccmr use acme -c models.yaml  (persists bare provider key)

$ grep default_model models.yaml:
default_model: acme
$ ccmr models -c models.yaml (marker row):
* acme-pro                         Acme Pro                                 custom/pro                           [33m[No API Key][0m
  acme-lite                        Acme Lite                                custom/lite                          [33m[No API Key][0m
* acme-pro is the default model (change with: ccmr use <model>)

## R3 stage-3 error paths at HEAD (full metadata; key source repo .env DEEPSEEK_API_KEY, dead — 2 tiny requests, pre-authorized)
$ curl -s -X POST :8098/v1/messages  {"model":"kimi-k3",...}  # zero-key, non-stream
{"type":"error","error":{"type":"authentication_error","message":"API key not configured for model 'Kimi K3'. Set KIMI_API_KEY in .env (get a key: https://platform.kimi.ai/), then verify with: ccmr doctor kimi-k3"}}
[HTTP 401]

$ curl -s -N -X POST :8098/v1/messages  {"model":"deepseek-flash","stream":true,...}  # dead key, STREAM — the round-1 blocking path
event: error
data: {"type":"error","error":{"type":"api_error","message":"Upstream API error (deepseek): Authentication Fails, Your api key: ****xxxx is invalid (request_id: 5a0b4ba6-3d59-482d-8daa-bbd407e1c474) — key rejected. Check DEEPSEEK_API_KEY in .env (get a key: https://platform.deepseek.com/), then verify with: ccmr doctor deepseek-flash"}}


$ curl -s -X POST :8098/v1/messages  {"model":"deepseek-flash",...}  # dead key, non-stream (E2 re-verified)
{"type":"error","error":{"type":"api_error","message":"Upstream API error (deepseek): Authentication Fails, Your api key: ****xxxx is invalid (request_id: 5ceb2ff4-3f4d-4ace-a532-41d7e9530b68) — key rejected. Check DEEPSEEK_API_KEY in .env (get a key: https://platform.deepseek.com/), then verify with: ccmr doctor deepseek-flash"}}
[HTTP 401]
