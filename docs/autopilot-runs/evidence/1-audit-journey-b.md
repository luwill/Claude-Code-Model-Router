# Journey B: single real key (DeepSeek) — 2026-10-09 09:47:32, commit 109a372
(key value NEVER printed; copied from repo .env into scratch .env)

## B1 models counts
Ready: 2 / NoKey: 40
  deepseek-v4-pro                  DeepSeek V4 Pro                          deepseek/v4-pro                      [32m[Ready][0m
  deepseek-flash                   DeepSeek V4.1 Flash                      deepseek/flash                       [32m[Ready][0m

## B2 tiny real request (deepseek-flash) — reply + latency
HTTP 401 in 0.187493s
{"type":"error","error":{"type":"api_error","message":"Upstream API error (deepseek): Authentication Fails, Your api key: ****xxxx is invalid (request_id: 36e1793d-fbb9-43ba-a5be-60d44209f88a)"}}

## B3 POST kimi-k3 (key present for deepseek only) — C2 before-evidence
{"type":"error","error":{"type":"authentication_error","message":"API key not configured for model 'Kimi K3'. Please set the KIMI_API_KEY environment variable."}}
HTTP 401

## B4 /v1/models (what Claude Code /model consumes) — shape + count
count: 42
[{"id":"deepseek-v4-pro[1m]","object":"model","display_name":"DeepSeek V4 Pro","provider":"deepseek","provider_key":"deepseek","variant":"v4-pro","model_id":"deepseek-v4-pro","available":true},{"id":"deepseek-flash[1m]","object":"model","display_name":"DeepSeek V4.1 Flash","provider":"deepseek","provider_key":"deepseek","variant":"flash","model_id":"deepseek-flash","available":true},{"id":"kimi-k3

## B5 stats

Usage since 2026-10-09T00:59:31.532Z:

  Model                     Requests  Errors        Input       Output
  glm-plan-5.3                    21       0            0        10202
  TOTAL                           21       0            0        10202


## B6 doctor — which providers have LIVE keys in repo .env (1 tiny request each)
(run in scratch dir whose .env carries only repo .env candidate keys)

Checking model connectivity (one tiny request per model)...

  kimi-k3                  [31m[FAIL][0m 0.68s    [401] Upstream API error (moonshot): Invalid Authentication
  qwen3.8-max              [31m[FAIL][0m 0.18s    [403] Upstream API error (alibaba): {"message":"invalid api-key","type":"authentication_error","param":null,"code":null}
  step-5-preview           [32m[OK]  [0m 1.44s    
  minimax-m3               [31m[FAIL][0m 0.12s    [401] Upstream API error (minimax-cn): login fail: Please carry the API secret key in the 'X-Api-Key' field of the request header
  mimo-v2.5-pro            [31m[FAIL][0m 1.20s    [401] Upstream API error (xiaomi-token-sgp): Invalid API Key

1 ok, 4 failed, 0 skipped (no API key)


## B7 SUCCESS path with valid key (step-5-preview) — time-to-first-token feel
HTTP 200 total=0.911843s
{"id":"chatcmpl-811ab244f9c97ec92eac2a2d0dffc210-ba663f77","type":"message","role":"assistant","model":"step-5-preview","stop_reason":"max_tokens","usage":{"input_tokens":23,"output_tokens":16,"cache_creation_input_tokens":0,"cache_read_input_tokens":0},"content":[{"type":"thinking","thinking":"The user wants exactly \"CCMR-AUDIT-OK\" with no additional","signature":"d06bcdbabdaa4b09bc31221aa0347b

## B8 stats --help (does it name its target gateway?)
Usage: ccmr stats [options]

Show per-model usage counters from the running gateway

Options:
  --gateway-port <port>  Gateway port (defaults to config)
  -h, --help             display help for command
