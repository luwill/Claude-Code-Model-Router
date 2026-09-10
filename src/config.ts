/**
 * Configuration management for Claude Code Model Router
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import { parse as dotenvParse } from 'dotenv';
import { ccmrHome } from './paths.js';
import { stripContextSuffix } from './model-suffix.js';
import type { ModelConfig, ProviderConfig, RouterConfig } from './types.js';

export const DEFAULT_CONFIG: RouterConfig = {
  default_model: 'deepseek-flash',
  providers: {
    deepseek: {
      display_name: 'DeepSeek',
      provider: 'deepseek',
      base_url: 'https://api.deepseek.com/anthropic',
      api_key_env: 'DEEPSEEK_API_KEY',
      auth_header: 'x-api-key',
      auth_type: 'api_key',
      supports_streaming: true,
      supports_tools: true,
      default_variant: 'v4-pro',
      variants: {
        // Being retired by the vendor: from 2026-09-14 12:00 CST this id is
        // routed to V4.1 Flash and billed at its price, until V4.1 Pro
        // ships. Kept because it still answers as V4 Pro today.
        'v4-pro': {
          display_name: 'DeepSeek V4 Pro',
          model_id: 'deepseek-v4-pro',
          max_tokens: 393216,
          context_window: 1048576,
        },
        // DeepSeek V4.1 Flash (GA 2026-09-10): 552B MoE, natively
        // multimodal, and the vendor's replacement for the whole V4 Flash
        // line -- deepseek-v4-flash and deepseek-v4-flash-vision-exp were
        // taken offline and are now routed here, so they live on as aliases
        // rather than as models of their own.
        flash: {
          display_name: 'DeepSeek V4.1 Flash',
          model_id: 'deepseek-flash',
          max_tokens: 393216,
          context_window: 1048576,
        },
      },
    },
    kimi: {
      display_name: 'Kimi',
      provider: 'moonshot',
      base_url: 'https://api.moonshot.ai/anthropic',
      api_key_env: 'KIMI_API_KEY',
      auth_header: 'Authorization',
      auth_type: 'bearer',
      supports_streaming: true,
      supports_tools: true,
      default_variant: 'k2.6',
      variants: {
        k3: {
          display_name: 'Kimi K3',
          model_id: 'kimi-k3',
          max_tokens: 1048576,
          context_window: 1048576,
        },
        'k2.6': {
          display_name: 'Kimi K2.6',
          model_id: 'kimi-k2.6',
          max_tokens: 32768,
          context_window: 262144,
        },
        'k2.7-code': {
          display_name: 'Kimi K2.7 Code',
          model_id: 'kimi-k2.7-code',
          max_tokens: 32768,
          context_window: 262144,
        },
        'k2.7-code-highspeed': {
          display_name: 'Kimi K2.7 Code HighSpeed',
          model_id: 'kimi-k2.7-code-highspeed',
          max_tokens: 32768,
          context_window: 262144,
        },
      },
    },
    'kimi-cn': {
      display_name: 'Kimi CN',
      provider: 'moonshot-cn',
      base_url: 'https://api.moonshot.cn/anthropic',
      api_key_env: 'KIMI_CN_API_KEY',
      auth_header: 'Authorization',
      auth_type: 'bearer',
      supports_streaming: true,
      supports_tools: true,
      default_variant: 'k3',
      variants: {
        k3: {
          display_name: 'Kimi K3 (CN)',
          model_id: 'kimi-k3',
          max_tokens: 1048576,
          context_window: 1048576,
        },
        'k2.6': {
          display_name: 'Kimi K2.6 (CN)',
          model_id: 'kimi-k2.6',
          max_tokens: 32768,
          context_window: 262144,
        },
        'k2.7-code': {
          display_name: 'Kimi K2.7 Code (CN)',
          model_id: 'kimi-k2.7-code',
          max_tokens: 32768,
          context_window: 262144,
        },
        'k2.7-code-highspeed': {
          display_name: 'Kimi K2.7 Code HighSpeed (CN)',
          model_id: 'kimi-k2.7-code-highspeed',
          max_tokens: 32768,
          context_window: 262144,
        },
      },
    },
    'kimi-plan': {
      display_name: 'Kimi Code',
      provider: 'moonshot-code',
      // Kimi 会员 coding 订阅的 Anthropic 接入点。Key 来自 kimi.com 会员控制台，
      // 与开放平台（moonshot.cn / .ai）互不相通；模型与上下文按会员档位限权。
      base_url: 'https://api.kimi.com/coding',
      api_key_env: 'KIMI_CODE_API_KEY',
      auth_header: 'x-api-key',
      auth_type: 'api_key',
      supports_streaming: true,
      supports_tools: true,
      default_variant: 'k3-1m',
      variants: {
        'k3-1m': {
          display_name: 'Kimi K3 1M (Coding Plan)',
          // Upstream Model ID is plain 'k3'. The 'k3[1m]' string is a
          // Claude-Code-only env-var convention (native CC strips [1m] and
          // sends 'k3'); the API rejects 'k3[1m]' with 401 "model id does not
          // exist". The 1M context comes from context_window ->
          // CLAUDE_CODE_AUTO_COMPACT_WINDOW, not from the model id.
          model_id: 'k3',
          max_tokens: 1048576,
          context_window: 1048576,
        },
        k3: {
          display_name: 'Kimi K3 256K (Coding Plan)',
          model_id: 'k3',
          max_tokens: 131072,
          context_window: 262144,
        },
        'for-coding': {
          display_name: 'Kimi K2.7 Code (Coding Plan)',
          model_id: 'kimi-for-coding',
          max_tokens: 32768,
          context_window: 262144,
        },
        'for-coding-highspeed': {
          display_name: 'Kimi K2.7 Code HighSpeed (Coding Plan)',
          model_id: 'kimi-for-coding-highspeed',
          max_tokens: 32768,
          context_window: 262144,
        },
      },
    },
    minimax: {
      display_name: 'MiniMax CN',
      provider: 'minimax-cn',
      base_url: 'https://api.minimaxi.com/anthropic',
      api_key_env: 'MINIMAX_API_KEY',
      auth_header: 'Authorization',
      auth_type: 'bearer',
      supports_streaming: true,
      supports_tools: true,
      default_variant: 'm3',
      variants: {
        m3: {
          display_name: 'MiniMax M3',
          model_id: 'MiniMax-M3',
          max_tokens: 131072,
          context_window: 1048576,
        },
      },
    },
    'minimax-global': {
      display_name: 'MiniMax Global',
      provider: 'minimax-global',
      base_url: 'https://api.minimax.io/anthropic',
      api_key_env: 'MINIMAX_GLOBAL_API_KEY',
      auth_header: 'Authorization',
      auth_type: 'bearer',
      supports_streaming: true,
      supports_tools: true,
      default_variant: 'm3',
      variants: {
        m3: {
          display_name: 'MiniMax M3 (Global)',
          model_id: 'MiniMax-M3',
          max_tokens: 131072,
          context_window: 1048576,
        },
      },
    },
    qwen: {
      display_name: 'Qwen',
      provider: 'alibaba',
      base_url: 'https://dashscope.aliyuncs.com/apps/anthropic',
      api_key_env: 'QWEN_API_KEY',
      auth_header: 'x-api-key',
      auth_type: 'api_key',
      supports_streaming: true,
      supports_tools: true,
      default_variant: '3.8-max',
      variants: {
        // GA release of Qwen3.8 Max dropped the -preview suffix and opened
        // pay-as-you-go access (the preview was Token-Plan-only and 403'd
        // pay-go keys; verified live that the GA id returns 200 here).
        '3.8-max': {
          model_key: 'qwen3.8-max',
          display_name: 'Qwen3.8 Max',
          model_id: 'qwen3.8-max',
          max_tokens: 65536,
          context_window: 1000000,
        },
        '3.7-max': {
          model_key: 'qwen3.7-max',
          display_name: 'Qwen3.7 Max',
          model_id: 'qwen3.7-max',
          max_tokens: 65536,
          context_window: 1000000,
        },
        // Qwen3.8 Flash: multimodal (image/video/text in) flash tier, 1M
        // context, 131,072 max output (help.aliyun.com/zh/model-studio/
        // qwen3-8-flash); listed in Bailian's Anthropic-compatible model
        // set. qwen3.8-flash-next is the open-weights preview this model is
        // built on and has no hosted API anywhere, so it is not routed.
        '3.8-flash': {
          model_key: 'qwen3.8-flash',
          display_name: 'Qwen3.8 Flash',
          model_id: 'qwen3.8-flash',
          max_tokens: 131072,
          context_window: 1000000,
        },
      },
    },
    'qwen-plan': {
      display_name: 'Qwen Token Plan',
      provider: 'alibaba',
      // 千问 AI 平台 Token Plan 订阅（platform.qianwenai.com）。Key 为 sk-sp- 订阅密钥，
      // 走 Token Plan 专属 Anthropic 接入点（非按量付费的 dashscope.aliyuncs.com——
      // sk-sp- key 打过去会 403 invalid api-key）。Bearer 与 x-api-key 均实测可用。
      base_url: 'https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic',
      api_key_env: 'QWEN_PLAN_API_KEY',
      auth_header: 'x-api-key',
      auth_type: 'api_key',
      supports_streaming: true,
      supports_tools: true,
      default_variant: '3.8-max',
      variants: {
        '3.8-max': {
          display_name: 'Qwen3.8 Max (Token Plan)',
          // GA id; the retired qwen3.8-max-preview id still answers upstream
          // but is deprecated.
          model_id: 'qwen3.8-max',
          max_tokens: 65536,
          context_window: 1000000,
        },
        '3.7-max': {
          display_name: 'Qwen3.7 Max (Token Plan)',
          model_id: 'qwen3.7-max',
          max_tokens: 65536,
          context_window: 1000000,
        },
        // platform.qianwenai.com latest-model doc: Token Plan credits cover
        // Qwen3.8-Flash on the same subscription endpoint. The (stale) tier
        // tables on docs/token-plan/overview do not list it yet; unverified
        // live because the test subscription returns 403
        // AccessDenied.Unpurchased for 3.8-max as well.
        '3.8-flash': {
          display_name: 'Qwen3.8 Flash (Token Plan)',
          model_id: 'qwen3.8-flash',
          max_tokens: 131072,
          context_window: 1000000,
        },
      },
    },
    'glm-plan': {
      display_name: 'GLM Coding Plan',
      provider: 'zhipu-coding',
      // 智谱 GLM Coding Plan 订阅专属通道（bigmodel.cn/claude-code）。
      // open.bigmodel.cn/api/anthropic 是国内唯一的 Anthropic 兼容端点，且被
      // Coding Plan 门控：按量付费 key / tokens 资源包打过去会 429 [1309]，
      // 官方 FAQ 明确资源包在此不可用、套餐耗尽也不转按量。国内按量付费只有
      // OpenAI 协议（/api/paas/v4），无 Anthropic 通道，故没有按量 glm provider。
      base_url: 'https://open.bigmodel.cn/api/anthropic',
      api_key_env: 'GLM_PLAN_API_KEY',
      auth_header: 'x-api-key',
      auth_type: 'api_key',
      supports_streaming: true,
      supports_tools: true,
      default_variant: '5.3',
      variants: {
        // GLM-5.3 always runs with reasoning enabled (low/high/max, default
        // max); upstream rejects thinking.type: "disabled".
        '5.3': {
          display_name: 'GLM-5.3 (Coding Plan)',
          model_id: 'glm-5.3',
          max_tokens: 131072,
          context_window: 1000000,
        },
        // GLM-5.1 removed: Zhipu retired it (coding-plan calls auto-switch
        // to GLM-5.2 upstream).
        '5.2': {
          display_name: 'GLM-5.2 (Coding Plan)',
          model_id: 'glm-5.2',
          max_tokens: 131072,
          context_window: 1000000,
        },
        // GLM-5.3-Flash: first native multimodal GLM-5 model (video/image/
        // text/file in), 1M context, 128K max output, text params identical
        // to GLM-5.3 (thinking cannot be disabled). Coding Plan carries it
        // with 3x the GLM-5.3 quota; same endpoint and key.
        '5.3-flash': {
          display_name: 'GLM-5.3-Flash (Coding Plan)',
          model_id: 'glm-5.3-flash',
          max_tokens: 131072,
          context_window: 1000000,
        },
      },
    },
    'glm-global': {
      display_name: 'GLM Global',
      provider: 'zhipu-global',
      base_url: 'https://api.z.ai/api/anthropic',
      api_key_env: 'GLM_GLOBAL_API_KEY',
      auth_header: 'x-api-key',
      auth_type: 'api_key',
      supports_streaming: true,
      supports_tools: true,
      default_variant: '5.3',
      variants: {
        '5.3': {
          display_name: 'GLM-5.3 (Global)',
          model_id: 'glm-5.3',
          max_tokens: 131072,
          context_window: 1000000,
        },
        '5.2': {
          display_name: 'GLM-5.2 (Global)',
          model_id: 'glm-5.2',
          max_tokens: 131072,
          context_window: 1000000,
        },
        '5.3-flash': {
          display_name: 'GLM-5.3-Flash (Global)',
          model_id: 'glm-5.3-flash',
          max_tokens: 131072,
          context_window: 1000000,
        },
      },
    },
    step: {
      display_name: 'StepFun',
      provider: 'stepfun',
      base_url: 'https://api.stepfun.com',
      api_key_env: 'STEP_API_KEY',
      auth_header: 'Authorization',
      auth_type: 'bearer',
      supports_streaming: true,
      supports_tools: true,
      default_variant: '3.7-flash',
      variants: {
        '3.7-flash': {
          display_name: 'Step 3.7 Flash',
          model_id: 'step-3.7-flash',
          max_tokens: 393216,
          context_window: 262144,
        },
      },
    },
    'step-plan': {
      display_name: 'StepFun Step Plan',
      provider: 'stepfun-plan',
      base_url: 'https://api.stepfun.com/step_plan',
      api_key_env: 'STEP_PLAN_API_KEY',
      auth_header: 'Authorization',
      auth_type: 'bearer',
      supports_streaming: true,
      supports_tools: true,
      default_variant: '3.7-flash',
      variants: {
        '3.7-flash': {
          display_name: 'Step 3.7 Flash (Step Plan)',
          model_id: 'step-3.7-flash',
          max_tokens: 393216,
          context_window: 262144,
        },
      },
    },
    mimo: {
      display_name: 'MiMo Token Plan SGP',
      provider: 'xiaomi-token-sgp',
      base_url: 'https://token-plan-sgp.xiaomimimo.com/anthropic',
      api_key_env: 'MIMO_API_KEY',
      auth_header: 'api-key',
      auth_type: 'api_key',
      supports_streaming: true,
      supports_tools: true,
      default_variant: 'v2.5-pro',
      variants: {
        'v2.5-pro': {
          display_name: 'MiMo V2.5 Pro',
          model_id: 'mimo-v2.5-pro',
          max_tokens: 131072,
          context_window: 1048576,
        },
        'v2.5': {
          display_name: 'MiMo V2.5',
          model_id: 'mimo-v2.5',
          max_tokens: 131072,
          context_window: 1048576,
        },
      },
    },
    'mimo-token-cn': {
      display_name: 'MiMo Token Plan CN',
      provider: 'xiaomi-token-cn',
      base_url: 'https://token-plan-cn.xiaomimimo.com/anthropic',
      api_key_env: 'MIMO_TOKEN_CN_API_KEY',
      auth_header: 'api-key',
      auth_type: 'api_key',
      supports_streaming: true,
      supports_tools: true,
      default_variant: 'v2.5-pro',
      variants: {
        'v2.5-pro': {
          display_name: 'MiMo V2.5 Pro (CN)',
          model_id: 'mimo-v2.5-pro',
          max_tokens: 131072,
          context_window: 1048576,
        },
        'v2.5': {
          display_name: 'MiMo V2.5 (CN)',
          model_id: 'mimo-v2.5',
          max_tokens: 131072,
          context_window: 1048576,
        },
      },
    },
    'mimo-token-ams': {
      display_name: 'MiMo Token Plan AMS',
      provider: 'xiaomi-token-ams',
      base_url: 'https://token-plan-ams.xiaomimimo.com/anthropic',
      api_key_env: 'MIMO_TOKEN_AMS_API_KEY',
      auth_header: 'api-key',
      auth_type: 'api_key',
      supports_streaming: true,
      supports_tools: true,
      default_variant: 'v2.5-pro',
      variants: {
        'v2.5-pro': {
          display_name: 'MiMo V2.5 Pro (AMS)',
          model_id: 'mimo-v2.5-pro',
          max_tokens: 131072,
          context_window: 1048576,
        },
        'v2.5': {
          display_name: 'MiMo V2.5 (AMS)',
          model_id: 'mimo-v2.5',
          max_tokens: 131072,
          context_window: 1048576,
        },
      },
    },
    'mimo-payg': {
      display_name: 'MiMo Pay-as-you-go',
      provider: 'xiaomi-payg',
      base_url: 'https://api.xiaomimimo.com/anthropic',
      api_key_env: 'MIMO_PAYG_API_KEY',
      auth_header: 'api-key',
      auth_type: 'api_key',
      supports_streaming: true,
      supports_tools: true,
      default_variant: 'v2.5-pro',
      variants: {
        'v2.5-pro': {
          display_name: 'MiMo V2.5 Pro (Pay-as-you-go)',
          model_id: 'mimo-v2.5-pro',
          max_tokens: 131072,
          context_window: 1048576,
        },
        'v2.5': {
          display_name: 'MiMo V2.5 (Pay-as-you-go)',
          model_id: 'mimo-v2.5',
          max_tokens: 131072,
          context_window: 1048576,
        },
      },
    },
    seed: {
      display_name: 'Doubao Seed (Volcengine)',
      provider: 'volcengine-ark',
      // 按量付费（方舟 API 调用）的 Anthropic 兼容接入点。订阅版 Agent Plan 用 /api/plan。
      base_url: 'https://ark.cn-beijing.volces.com/api/compatible',
      api_key_env: 'ARK_API_KEY',
      auth_header: 'Authorization',
      auth_type: 'bearer',
      supports_streaming: true,
      supports_tools: true,
      default_variant: '2.1-pro',
      variants: {
        '2.1-pro': {
          display_name: 'Doubao Seed 2.1 Pro',
          model_id: 'doubao-seed-2-1-pro-260628',
          max_tokens: 262144,
          context_window: 262144,
        },
        '2.1-turbo': {
          display_name: 'Doubao Seed 2.1 Turbo',
          model_id: 'doubao-seed-2-1-turbo-260628',
          max_tokens: 262144,
          context_window: 262144,
        },
      },
    },
    'seed-plan': {
      display_name: 'Doubao Seed (Volcengine Agent Plan)',
      provider: 'volcengine-ark-plan',
      // 订阅版 Agent Plan 的 Anthropic 接入点，需专属 API Key（与按量付费 ARK_API_KEY 不同）。
      base_url: 'https://ark.cn-beijing.volces.com/api/plan',
      api_key_env: 'ARK_PLAN_API_KEY',
      auth_header: 'Authorization',
      auth_type: 'bearer',
      supports_streaming: true,
      supports_tools: true,
      default_variant: '2.1-pro',
      variants: {
        '2.1-pro': {
          display_name: 'Doubao Seed 2.1 Pro (Agent Plan)',
          model_id: 'doubao-seed-2-1-pro-260628',
          max_tokens: 262144,
          context_window: 262144,
        },
        '2.1-turbo': {
          display_name: 'Doubao Seed 2.1 Turbo (Agent Plan)',
          model_id: 'doubao-seed-2-1-turbo-260628',
          max_tokens: 262144,
          context_window: 262144,
        },
      },
    },
  },
  models: {},
  aliases: {
    deepseek: 'deepseek-v4-pro',
    'deepseek-v4': 'deepseek-v4-pro',
    'deepseek-pro': 'deepseek-v4-pro',
    'deepseek-flash': 'deepseek-flash',
    'deepseek-chat': 'deepseek-flash',
    'deepseek-4.1-flash': 'deepseek-flash',
    'deepseek-v4.1-flash': 'deepseek-flash',
    'ds-4.1': 'deepseek-flash',
    // Vision aliases now point at V4.1 Flash, which is natively multimodal.
    // NOTE: deepseek-v4-flash / -vision-exp are deliberately NOT aliased back
    // to deepseek-flash. Configs generated before 1.18 alias
    // deepseek-flash -> deepseek-v4-flash, and user configs merge over these
    // defaults, so the reverse alias would form a cycle and make every
    // command fail with "Invalid config file".
    'deepseek-vision': 'deepseek-flash',
    'ds-vision': 'deepseek-flash',
    ds: 'deepseek-v4-pro',
    kimi: 'kimi-k2.6',
    'kimi-k2': 'kimi-k2.6',
    'kimi-k2.6': 'kimi-k2.6',
    moonshot: 'kimi-k2.6',
    'kimi-k3': 'kimi-k3',
    k3: 'kimi-k3',
    'kimi-k2.7-code': 'kimi-k2.7-code',
    'kimi-code': 'kimi-k2.7-code',
    'k2.7-code': 'kimi-k2.7-code',
    'kimi-k2.7-code-highspeed': 'kimi-k2.7-code-highspeed',
    'kimi-code-highspeed': 'kimi-k2.7-code-highspeed',
    'kimi-highspeed': 'kimi-k2.7-code-highspeed',
    'k2.7-highspeed': 'kimi-k2.7-code-highspeed',
    'kimi-cn': 'kimi-cn-k3',
    'moonshot-cn': 'kimi-cn-k3',
    'kimi-cn-k3': 'kimi-cn-k3',
    'k3-cn': 'kimi-cn-k3',
    'kimi-cn-k2.6': 'kimi-cn-k2.6',
    'kimi-cn-k2.7-code': 'kimi-cn-k2.7-code',
    'kimi-cn-k2.7-code-highspeed': 'kimi-cn-k2.7-code-highspeed',
    'kimi-plan': 'kimi-plan-k3-1m',
    'kimi-plan-k3-1m': 'kimi-plan-k3-1m',
    'kimi-plan-k3': 'kimi-plan-k3',
    'kimi-for-coding': 'kimi-plan-for-coding',
    'kimi-plan-for-coding': 'kimi-plan-for-coding',
    'kimi-plan-for-coding-highspeed': 'kimi-plan-for-coding-highspeed',
    'kimi-plan-highspeed': 'kimi-plan-for-coding-highspeed',
    minimax: 'minimax-m3',
    'minimax-cn': 'minimax-m3',
    'minimax-m3': 'minimax-m3',
    minimaxi: 'minimax-m3',
    'minimax-global': 'minimax-global-m3',
    'minimax-io': 'minimax-global-m3',
    'minimax-global-m3': 'minimax-global-m3',
    mm: 'minimax-m3',
    qwen: 'qwen3.8-max',
    tongyi: 'qwen3.8-max',
    'qwen3.8': 'qwen3.8-max',
    'qwen3.8-max': 'qwen3.8-max',
    'qwen-max': 'qwen3.7-max',
    'qwen3.7-max': 'qwen3.7-max',
    'qwen3.7': 'qwen3.7-max',
    'qwen-plan': 'qwen-plan-3.8-max',
    'qwen-plan-3.8': 'qwen-plan-3.8-max',
    'qwen-plan-3.8-max': 'qwen-plan-3.8-max',
    'qwen-plan-max': 'qwen-plan-3.8-max',
    'qwen-plan-3.7': 'qwen-plan-3.7-max',
    'qwen-plan-3.7-max': 'qwen-plan-3.7-max',
    'qwen-flash': 'qwen3.8-flash',
    'qwen3.8-flash': 'qwen3.8-flash',
    'qwen-plan-flash': 'qwen-plan-3.8-flash',
    'qwen-plan-3.8-flash': 'qwen-plan-3.8-flash',
    glm: 'glm-plan-5.3',
    'glm-5.3': 'glm-plan-5.3',
    'glm-5.2': 'glm-plan-5.2',
    zhipu: 'glm-plan-5.3',
    chatglm: 'glm-plan-5.3',
    'glm-plan': 'glm-plan-5.3',
    'glm-plan-5.3': 'glm-plan-5.3',
    'glm-plan-5.2': 'glm-plan-5.2',
    'glm-flash': 'glm-plan-5.3-flash',
    'glm-5.3-flash': 'glm-plan-5.3-flash',
    'glm-plan-flash': 'glm-plan-5.3-flash',
    'glm-plan-5.3-flash': 'glm-plan-5.3-flash',
    'glm-global': 'glm-global-5.3',
    'glm-global-5.3': 'glm-global-5.3',
    'glm-global-5.2': 'glm-global-5.2',
    'glm-global-flash': 'glm-global-5.3-flash',
    'glm-global-5.3-flash': 'glm-global-5.3-flash',
    'zai-flash': 'glm-global-5.3-flash',
    zai: 'glm-global-5.3',
    'z-ai': 'glm-global-5.3',
    step: 'step-3.7-flash',
    'step-3.7': 'step-3.7-flash',
    'step-3.7-flash': 'step-3.7-flash',
    stepfun: 'step-3.7-flash',
    'step-plan': 'step-plan-3.7-flash',
    'step-plan-3.7': 'step-plan-3.7-flash',
    'step-plan-3.7-flash': 'step-plan-3.7-flash',
    stepplan: 'step-plan-3.7-flash',
    mimo: 'mimo-v2.5-pro',
    'mimo-pro': 'mimo-v2.5-pro',
    'mimo-token': 'mimo-v2.5-pro',
    'mimo-token-sgp': 'mimo-v2.5-pro',
    'mimo-sgp': 'mimo-v2.5-pro',
    'mimo-v2': 'mimo-v2.5',
    'mimo-v2.5': 'mimo-v2.5',
    'mimo-v2.5-pro': 'mimo-v2.5-pro',
    'mimo-token-cn': 'mimo-token-cn-v2.5-pro',
    'mimo-cn': 'mimo-token-cn-v2.5-pro',
    'mimo-token-cn-v2.5': 'mimo-token-cn-v2.5',
    'mimo-token-ams': 'mimo-token-ams-v2.5-pro',
    'mimo-ams': 'mimo-token-ams-v2.5-pro',
    'mimo-token-ams-v2.5': 'mimo-token-ams-v2.5',
    'mimo-payg': 'mimo-payg-v2.5-pro',
    'mimo-payg-pro': 'mimo-payg-v2.5-pro',
    'mimo-payg-v2.5': 'mimo-payg-v2.5',
    xiaomi: 'mimo-v2.5-pro',
    seed: 'seed-2.1-pro',
    'seed-pro': 'seed-2.1-pro',
    'seed-2.1': 'seed-2.1-pro',
    'seed-2.1-pro': 'seed-2.1-pro',
    'seed-turbo': 'seed-2.1-turbo',
    'seed-2.1-turbo': 'seed-2.1-turbo',
    doubao: 'seed-2.1-pro',
    'doubao-seed': 'seed-2.1-pro',
    'seed-plan': 'seed-plan-2.1-pro',
    'seed-plan-pro': 'seed-plan-2.1-pro',
    'seed-plan-2.1': 'seed-plan-2.1-pro',
    'seed-plan-2.1-pro': 'seed-plan-2.1-pro',
    'seed-plan-turbo': 'seed-plan-2.1-turbo',
    'seed-plan-2.1-turbo': 'seed-plan-2.1-turbo',
    'doubao-plan': 'seed-plan-2.1-pro',
  },
  gateway: {
    host: '127.0.0.1',
    port: 8080,
    timeout: 300,
    enable_logging: true,
    log_level: 'INFO',
  },
};

export class ConfigManager {
  private config: RouterConfig;
  private apiKeys: Map<string, string> = new Map();
  private requestedConfigPath?: string;
  private configFilePath: string | null = null;
  /** Values this instance injected from .env, used to revoke removed entries. */
  private managedEnvValues = new Map<string, string>();

  constructor(configPath?: string | null) {
    this.requestedConfigPath = configPath ?? undefined;
    this.config = configPath === null ? this.normalizeConfig(DEFAULT_CONFIG) : this.loadConfig(configPath);
    this.applyEnvFiles();
    this.config = this.applyGatewayEnvOverrides(this.config);
    this.loadApiKeys();
  }

  private loadConfig(configPath?: string): RouterConfig {
    // An explicit path is a contract: never silently fall back to another
    // project or the built-in defaults when it is missing or malformed.
    if (configPath) {
      const explicitPath = path.resolve(configPath);
      if (!fs.existsSync(explicitPath)) {
        throw new Error(`Config file not found: ${explicitPath}`);
      }
      const config = this.readConfigFile(explicitPath);
      this.configFilePath = explicitPath;
      return config;
    }

    // Otherwise discover cwd first, then the global ~/.ccmr fallback.
    const possiblePaths = [
      path.join(process.cwd(), 'models.yaml'),
      path.join(process.cwd(), 'config', 'models.yaml'),
      path.join(process.cwd(), '.claude-router.yaml'),
      path.join(ccmrHome(), 'models.yaml'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        const config = this.readConfigFile(p);
        this.configFilePath = p;
        return config;
      }
    }

    // Return default config if no file found
    this.configFilePath = null;
    return this.normalizeConfig(DEFAULT_CONFIG);
  }

  private readConfigFile(filePath: string): RouterConfig {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = yaml.load(content);
      if (parsed !== null && !this.isRecord(parsed)) {
        throw new Error('top-level YAML value must be an object');
      }
      if (this.isRecord(parsed)) {
        for (const section of ['providers', 'models', 'aliases', 'gateway'] as const) {
          if (parsed[section] !== undefined && !this.isRecord(parsed[section])) {
            throw new Error(`${section} must be an object`);
          }
        }
      }
      return this.mergeConfig((parsed ?? {}) as Partial<RouterConfig>);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid config file ${filePath}: ${detail}`);
    }
  }

  private mergeConfig(parsed: Partial<RouterConfig>): RouterConfig {
    const merged = {
      default_model: parsed.default_model ?? DEFAULT_CONFIG.default_model,
      providers: this.mergeProviders(DEFAULT_CONFIG.providers ?? {}, parsed.providers ?? {}),
      models: { ...DEFAULT_CONFIG.models, ...parsed.models },
      aliases: { ...DEFAULT_CONFIG.aliases, ...parsed.aliases },
      gateway: { ...DEFAULT_CONFIG.gateway, ...parsed.gateway },
    } as RouterConfig;
    this.validateConfigShape(merged);
    return this.normalizeConfig(merged);
  }

  private mergeProviders(
    defaults: Record<string, ProviderConfig>,
    overrides: Record<string, ProviderConfig>
  ): Record<string, ProviderConfig> {
    const providers: Record<string, ProviderConfig> = { ...defaults };

    for (const [providerKey, override] of Object.entries(overrides)) {
      const base = providers[providerKey];
      providers[providerKey] = base
        ? {
            ...base,
            ...override,
            variants: { ...base.variants, ...override.variants },
          }
        : override;
    }

    return providers;
  }

  private normalizeConfig(config: RouterConfig): RouterConfig {
    const models: Record<string, ModelConfig> = {};

    for (const [providerKey, provider] of Object.entries(config.providers ?? {})) {
      for (const [variantKey, variant] of Object.entries(provider.variants)) {
        const modelKey = variant.model_key ?? `${providerKey}-${variantKey}`;
        models[modelKey] = this.buildModelConfig(providerKey, variantKey, provider, variant);
      }

      if (provider.default_variant) {
        const defaultVariant = provider.variants[provider.default_variant];
        const defaultKey = defaultVariant?.model_key ?? `${providerKey}-${provider.default_variant}`;
        if (models[defaultKey]) {
          models[providerKey] = models[defaultKey];
        }
      }
    }

    for (const [modelKey, model] of Object.entries(config.models ?? {})) {
      models[modelKey] = model;
    }

    const normalized = {
      ...config,
      default_model: this.resolveAlias(config.default_model, config.aliases ?? {}),
      models,
      aliases: config.aliases ?? {},
      gateway: config.gateway,
    };
    if (!normalized.models[normalized.default_model]) {
      throw new Error(`default_model '${config.default_model}' does not resolve to a configured model`);
    }
    for (const [alias, target] of Object.entries(normalized.aliases)) {
      const resolved = this.resolveAlias(target, normalized.aliases);
      if (!normalized.models[resolved]) {
        throw new Error(`alias '${alias}' resolves to unknown model '${resolved}'`);
      }
    }
    for (const [modelName, model] of Object.entries(normalized.models)) {
      for (const fallback of model.fallback ?? []) {
        const resolved = this.resolveAlias(fallback, normalized.aliases);
        if (!normalized.models[resolved]) {
          throw new Error(`model '${modelName}' has unknown fallback '${fallback}'`);
        }
      }
    }
    return normalized;
  }

  private buildModelConfig(
    providerKey: string,
    variantKey: string,
    provider: ProviderConfig,
    variant: ProviderConfig['variants'][string]
  ): ModelConfig {
    return {
      display_name: variant.display_name,
      provider: provider.provider,
      model_id: variant.model_id,
      base_url: provider.base_url,
      api_key_env: provider.api_key_env,
      auth_header: provider.auth_header,
      auth_type: provider.auth_type,
      supports_streaming: variant.supports_streaming ?? provider.supports_streaming,
      supports_tools: variant.supports_tools ?? provider.supports_tools,
      max_tokens: variant.max_tokens,
      context_window: variant.context_window,
      fallback: variant.fallback ?? provider.fallback,
      provider_key: providerKey,
      variant_key: variantKey,
      provider_display_name: provider.display_name,
    };
  }

  private resolveAlias(name: string, aliases: Record<string, string>): string {
    let current = name;
    const seen = new Set<string>();
    while (aliases[current] !== undefined) {
      if (aliases[current] === current) {
        return current;
      }
      if (seen.has(current)) {
        throw new Error(`Alias cycle detected at '${current}'`);
      }
      seen.add(current);
      current = aliases[current];
    }
    return current;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private requireString(value: unknown, field: string): asserts value is string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${field} must be a non-empty string`);
    }
  }

  private validateFallback(value: unknown, field: string): void {
    if (value === undefined) return;
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
      throw new Error(`${field} must be an array of model names`);
    }
  }

  private validateConfigShape(config: RouterConfig): void {
    this.requireString(config.default_model, 'default_model');
    if (!this.isRecord(config.providers)) throw new Error('providers must be an object');
    if (!this.isRecord(config.models)) throw new Error('models must be an object');
    if (!this.isRecord(config.aliases)) throw new Error('aliases must be an object');
    if (!this.isRecord(config.gateway)) throw new Error('gateway must be an object');

    const gateway = config.gateway;
    this.requireString(gateway.host, 'gateway.host');
    if (!Number.isInteger(gateway.port) || gateway.port < 1 || gateway.port > 65535) {
      throw new Error('gateway.port must be an integer from 1 to 65535');
    }
    if (!Number.isFinite(gateway.timeout) || gateway.timeout <= 0) {
      throw new Error('gateway.timeout must be a positive number');
    }
    if (typeof gateway.enable_logging !== 'boolean') {
      throw new Error('gateway.enable_logging must be a boolean');
    }
    this.requireString(gateway.log_level, 'gateway.log_level');
    if (!new Set(['DEBUG', 'INFO', 'WARN', 'ERROR', 'SILENT']).has(gateway.log_level.toUpperCase())) {
      throw new Error('gateway.log_level must be DEBUG, INFO, WARN, ERROR, or SILENT');
    }

    for (const [alias, target] of Object.entries(config.aliases)) {
      this.requireString(target, `aliases.${alias}`);
    }

    for (const [providerKey, providerValue] of Object.entries(config.providers)) {
      if (!this.isRecord(providerValue)) throw new Error(`providers.${providerKey} must be an object`);
      const provider = providerValue as unknown as ProviderConfig;
      this.requireString(provider.provider, `providers.${providerKey}.provider`);
      this.requireString(provider.base_url, `providers.${providerKey}.base_url`);
      this.requireHttpUrl(provider.base_url, `providers.${providerKey}.base_url`);
      this.requireString(provider.api_key_env, `providers.${providerKey}.api_key_env`);
      if (provider.auth_type !== undefined && !['api_key', 'bearer'].includes(provider.auth_type)) {
        throw new Error(`providers.${providerKey}.auth_type must be api_key or bearer`);
      }
      if (!this.isRecord(provider.variants) || Object.keys(provider.variants).length === 0) {
        throw new Error(`providers.${providerKey}.variants must be a non-empty object`);
      }
      if (provider.default_variant && !provider.variants[provider.default_variant]) {
        throw new Error(
          `providers.${providerKey}.default_variant '${provider.default_variant}' is not defined`
        );
      }
      this.validateFallback(provider.fallback, `providers.${providerKey}.fallback`);
      for (const [variantKey, variantValue] of Object.entries(provider.variants)) {
        if (!this.isRecord(variantValue)) {
          throw new Error(`providers.${providerKey}.variants.${variantKey} must be an object`);
        }
        const variant = variantValue as unknown as ProviderConfig['variants'][string];
        this.requireString(variant.display_name, `providers.${providerKey}.variants.${variantKey}.display_name`);
        this.requireString(variant.model_id, `providers.${providerKey}.variants.${variantKey}.model_id`);
        this.validatePositiveInteger(
          variant.max_tokens,
          `providers.${providerKey}.variants.${variantKey}.max_tokens`
        );
        this.validatePositiveInteger(
          variant.context_window,
          `providers.${providerKey}.variants.${variantKey}.context_window`
        );
        this.validateFallback(
          variant.fallback,
          `providers.${providerKey}.variants.${variantKey}.fallback`
        );
      }
    }

    for (const [modelKey, modelValue] of Object.entries(config.models)) {
      if (!this.isRecord(modelValue)) throw new Error(`models.${modelKey} must be an object`);
      const model = modelValue as unknown as ModelConfig;
      this.requireString(model.display_name, `models.${modelKey}.display_name`);
      this.requireString(model.provider, `models.${modelKey}.provider`);
      this.requireString(model.model_id, `models.${modelKey}.model_id`);
      this.requireString(model.base_url, `models.${modelKey}.base_url`);
      this.requireHttpUrl(model.base_url, `models.${modelKey}.base_url`);
      this.requireString(model.api_key_env, `models.${modelKey}.api_key_env`);
      this.validatePositiveInteger(model.max_tokens, `models.${modelKey}.max_tokens`);
      this.validatePositiveInteger(model.context_window, `models.${modelKey}.context_window`);
      this.validateFallback(model.fallback, `models.${modelKey}.fallback`);
    }
  }

  private validatePositiveInteger(value: unknown, field: string): void {
    if (value !== undefined && (!Number.isInteger(value) || (value as number) <= 0)) {
      throw new Error(`${field} must be a positive integer`);
    }
  }

  private requireHttpUrl(value: string, field: string): void {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`${field} must be a valid URL`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`${field} must use http or https`);
    }
  }

  private applyGatewayEnvOverrides(config: RouterConfig): RouterConfig {
    const gateway = { ...config.gateway };
    if (process.env.GATEWAY_PORT) {
      gateway.port = this.parsePositiveInteger(process.env.GATEWAY_PORT, 'GATEWAY_PORT', 65535);
    }
    if (process.env.REQUEST_TIMEOUT) {
      gateway.timeout = this.parsePositiveNumber(process.env.REQUEST_TIMEOUT, 'REQUEST_TIMEOUT');
    }
    if (process.env.LOG_LEVEL) {
      const level = process.env.LOG_LEVEL.trim().toUpperCase();
      const allowed = new Set(['DEBUG', 'INFO', 'WARN', 'ERROR', 'SILENT']);
      if (!allowed.has(level)) {
        throw new Error('LOG_LEVEL must be DEBUG, INFO, WARN, ERROR, or SILENT');
      }
      gateway.log_level = level;
    }
    const next = { ...config, gateway };
    this.validateConfigShape(next);
    return next;
  }

  private parsePositiveInteger(value: string, field: string, maximum: number): number {
    if (!/^\d+$/.test(value.trim())) throw new Error(`${field} must be a positive integer`);
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
      throw new Error(`${field} must be between 1 and ${maximum}`);
    }
    return parsed;
  }

  private parsePositiveNumber(value: string, field: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${field} must be positive`);
    return parsed;
  }

  private loadApiKeys(): void {
    this.apiKeys.clear();
    for (const [name, model] of Object.entries(this.config.models)) {
      const key = process.env[model.api_key_env];
      if (key) {
        this.apiKeys.set(name, key);
      }
    }
  }

  getConfig(): RouterConfig {
    return this.config;
  }

  getModel(name: string): ModelConfig | undefined {
    const resolved = this.resolveModelName(name);
    return this.config.models[resolved];
  }

  resolveModelName(name: string): string {
    return this.resolveAlias(stripContextSuffix(name), this.config.aliases);
  }

  getApiKey(modelName: string): string | undefined {
    const resolved = this.resolveModelName(modelName);
    return this.apiKeys.get(resolved);
  }

  /**
   * Re-read API keys from process.env. Call after process.env mutations
   * (e.g. when a host process loads keys from a secret store at runtime).
   */
  reloadApiKeys(): void {
    this.loadApiKeys();
  }

  /** Path of the config file that was actually loaded (null = built-in defaults). */
  getConfigFilePath(): string | null {
    return this.configFilePath;
  }

  /**
   * Stable, secret-free identity for the config and .env sources used by this
   * process. Detached gateways are shared only when this identity matches the
   * launching CLI, preventing one project from silently using another
   * project's endpoints or credentials.
   */
  getSourceId(): string {
    const routingConfig = {
      defaultModel: this.config.default_model,
      aliases: this.config.aliases,
      models: this.config.models,
    };
    const credentialDigests = [...new Set(
      Object.values(this.config.models).map((model) => model.api_key_env)
    )]
      .sort()
      .map((name) => {
        const value = process.env[name];
        return [
          name,
          value ? crypto.createHash('sha256').update(value).digest('hex') : null,
        ];
      });
    const descriptor = JSON.stringify({
      configFile: this.configFilePath ? path.resolve(this.configFilePath) : null,
      envFiles: this.getEnvFilePaths().map((file) => path.resolve(file)),
      routingConfig,
      credentialDigests,
    });
    return crypto.createHash('sha256').update(descriptor).digest('hex').slice(0, 24);
  }

  /** Existing .env sources, ordered from lower to higher precedence. */
  getEnvFilePaths(): string[] {
    return this.getEnvCandidatePaths().filter((file) => fs.existsSync(file));
  }

  /** All possible .env sources, including paths that do not exist yet. */
  getEnvCandidatePaths(): string[] {
    const configEnv = this.configFilePath
      ? path.join(path.dirname(this.configFilePath), '.env')
      : undefined;
    const candidates = [
      path.join(ccmrHome(), '.env'),
      path.join(process.cwd(), '.env'),
      configEnv,
    ].filter((file): file is string => !!file);
    return [...new Set(candidates)];
  }

  /**
   * Hot-reload: re-apply .env files and re-read the loaded config file.
   * A file that no longer parses keeps the previous working config
   * instead of silently degrading to defaults.
   */
  reload(): void {
    this.applyEnvFiles();

    try {
      const nextConfig =
        this.configFilePath && fs.existsSync(this.configFilePath)
          ? this.readConfigFile(this.configFilePath)
          : this.loadConfig(this.requestedConfigPath);
      this.config = this.applyGatewayEnvOverrides(nextConfig);
    } catch (e) {
      console.warn(
        `Warning: reload failed, keeping previous config (${this.configFilePath ?? 'discovery'}):`,
        e instanceof Error ? e.message : e
      );
    }

    this.loadApiKeys();
  }

  /**
   * Re-read .env files so edited keys take effect on reload. Applied
   * global-first so ./.env keeps precedence over ~/.ccmr/.env.
   */
  private applyEnvFiles(): void {
    const candidates = this.getEnvFilePaths();
    for (const [key, value] of this.managedEnvValues) {
      // Do not erase a value that another runtime component deliberately
      // replaced after we loaded it.
      if (process.env[key] === value) {
        delete process.env[key];
      }
    }
    this.managedEnvValues.clear();

    const fileValues: Record<string, string> = {};
    for (const p of candidates) {
      try {
        Object.assign(fileValues, dotenvParse(fs.readFileSync(p, 'utf-8')));
      } catch (e) {
        console.warn(`Warning: failed to re-read ${p}:`, e instanceof Error ? e.message : e);
      }
    }

    // Shell/parent-process variables always win over .env files.
    for (const [key, value] of Object.entries(fileValues)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
        this.managedEnvValues.set(key, value);
      }
    }
  }

  listModels(): Record<
    string,
    { displayName: string; provider: string; variant?: string; available: boolean }
  > {
    const result: Record<
      string,
      { displayName: string; provider: string; variant?: string; available: boolean }
    > = {};

    for (const [name, model] of Object.entries(this.config.models)) {
      if (model.provider_key && name === model.provider_key) {
        continue;
      }

      result[name] = {
        displayName: model.display_name,
        provider: model.provider,
        variant: model.variant_key,
        available: this.apiKeys.has(name),
      };
    }

    return result;
  }
}

// Generate default config file content
export function generateConfigFile(): string {
  return `# Claude Code Model Router Configuration
# Place this file as models.yaml or .claude-router.yaml in your project root
# (or in ~/.ccmr/models.yaml to share one config across directories).
#
# Any variant may declare a fallback chain, used when its upstream returns
# 5xx/429 or is unreachable:
#   variants:
#     v4-pro:
#       model_id: deepseek-v4-pro
#       fallback: [kimi-k2.6, glm-5.2]

default_model: deepseek-flash

providers:
  deepseek:
    display_name: DeepSeek
    provider: deepseek
    base_url: https://api.deepseek.com/anthropic
    api_key_env: DEEPSEEK_API_KEY
    auth_header: x-api-key
    auth_type: api_key
    default_variant: v4-pro
    variants:
      # 官方计划下线：2026-09-14 12:00 起该 id 的请求全部路由到 V4.1 Flash 并按其
      # 单价计费，直到 V4.1 Pro 上线；目前仍返回真实 V4 Pro，故保留
      v4-pro:
        display_name: "DeepSeek V4 Pro"
        model_id: deepseek-v4-pro
        max_tokens: 393216
        context_window: 1048576
      # DeepSeek V4.1 Flash（2026-09-10 正式发布）：552B MoE，原生多模态，
      # 官方用它替代整条 V4 Flash 线——deepseek-v4-flash 与
      # deepseek-v4-flash-vision-exp 已下线并被路由到这里，因此二者在下方
      # 保留为别名，不再是独立模型
      flash:
        display_name: "DeepSeek V4.1 Flash"
        model_id: deepseek-flash
        max_tokens: 393216
        context_window: 1048576

  kimi:
    display_name: Kimi
    provider: moonshot
    base_url: https://api.moonshot.ai/anthropic
    api_key_env: KIMI_API_KEY
    auth_header: Authorization
    auth_type: bearer
    default_variant: k2.6
    variants:
      k3:
        display_name: "Kimi K3"
        model_id: kimi-k3
        max_tokens: 1048576
        context_window: 1048576
      k2.6:
        display_name: "Kimi K2.6"
        model_id: kimi-k2.6
        max_tokens: 32768
        context_window: 262144
      k2.7-code:
        display_name: "Kimi K2.7 Code"
        model_id: kimi-k2.7-code
        max_tokens: 32768
        context_window: 262144
      k2.7-code-highspeed:
        display_name: "Kimi K2.7 Code HighSpeed"
        model_id: kimi-k2.7-code-highspeed
        max_tokens: 32768
        context_window: 262144

  kimi-cn:
    display_name: Kimi CN
    provider: moonshot-cn
    base_url: https://api.moonshot.cn/anthropic
    api_key_env: KIMI_CN_API_KEY
    auth_header: Authorization
    auth_type: bearer
    default_variant: k3
    variants:
      k3:
        display_name: "Kimi K3 (CN)"
        model_id: kimi-k3
        max_tokens: 1048576
        context_window: 1048576
      k2.6:
        display_name: "Kimi K2.6 (CN)"
        model_id: kimi-k2.6
        max_tokens: 32768
        context_window: 262144
      k2.7-code:
        display_name: "Kimi K2.7 Code (CN)"
        model_id: kimi-k2.7-code
        max_tokens: 32768
        context_window: 262144
      k2.7-code-highspeed:
        display_name: "Kimi K2.7 Code HighSpeed (CN)"
        model_id: kimi-k2.7-code-highspeed
        max_tokens: 32768
        context_window: 262144

  # Kimi 会员 coding 订阅（kimi.com 会员控制台发 Key，与开放平台不互通；按档位限权）
  kimi-plan:
    display_name: Kimi Code
    provider: moonshot-code
    base_url: https://api.kimi.com/coding
    api_key_env: KIMI_CODE_API_KEY
    auth_header: x-api-key
    auth_type: api_key
    default_variant: k3-1m
    variants:
      k3-1m:
        display_name: "Kimi K3 1M (Coding Plan)"
        # 上游 Model ID 是纯 'k3'；'k3[1m]' 仅是 Claude Code 环境变量写法，API 会 401。
        # 1M 上下文由 context_window -> CLAUDE_CODE_AUTO_COMPACT_WINDOW 提供。
        model_id: k3
        max_tokens: 1048576
        context_window: 1048576
      k3:
        display_name: "Kimi K3 256K (Coding Plan)"
        model_id: k3
        max_tokens: 131072
        context_window: 262144
      for-coding:
        display_name: "Kimi K2.7 Code (Coding Plan)"
        model_id: kimi-for-coding
        max_tokens: 32768
        context_window: 262144
      for-coding-highspeed:
        display_name: "Kimi K2.7 Code HighSpeed (Coding Plan)"
        model_id: kimi-for-coding-highspeed
        max_tokens: 32768
        context_window: 262144

  minimax:
    display_name: MiniMax CN
    provider: minimax-cn
    base_url: https://api.minimaxi.com/anthropic
    api_key_env: MINIMAX_API_KEY
    auth_header: Authorization
    auth_type: bearer
    default_variant: m3
    variants:
      m3:
        display_name: "MiniMax M3"
        model_id: MiniMax-M3
        max_tokens: 131072
        context_window: 1048576

  minimax-global:
    display_name: MiniMax Global
    provider: minimax-global
    base_url: https://api.minimax.io/anthropic
    api_key_env: MINIMAX_GLOBAL_API_KEY
    auth_header: Authorization
    auth_type: bearer
    default_variant: m3
    variants:
      m3:
        display_name: "MiniMax M3 (Global)"
        model_id: MiniMax-M3
        max_tokens: 131072
        context_window: 1048576

  qwen:
    display_name: Qwen
    provider: alibaba
    base_url: https://dashscope.aliyuncs.com/apps/anthropic
    api_key_env: QWEN_API_KEY
    auth_header: x-api-key
    auth_type: api_key
    default_variant: 3.8-max
    variants:
      # Qwen3.8 Max 正式版（GA 去掉 -preview 后缀）已开放按量付费，实测 200
      3.8-max:
        model_key: qwen3.8-max
        display_name: "Qwen3.8 Max"
        model_id: qwen3.8-max
        max_tokens: 65536
        context_window: 1000000
      3.7-max:
        model_key: qwen3.7-max
        display_name: "Qwen3.7 Max"
        model_id: qwen3.7-max
        max_tokens: 65536
        context_window: 1000000
      # Qwen3.8 Flash：多模态（图/视频/文本输入）flash 档，1M 上下文、最大输出 128K。
      # qwen3.8-flash-next 是其开源预览版权重，无任何托管 API，故不提供路由
      3.8-flash:
        model_key: qwen3.8-flash
        display_name: "Qwen3.8 Flash"
        model_id: qwen3.8-flash
        max_tokens: 131072
        context_window: 1000000

  # 千问 AI 平台 Token Plan 订阅（platform.qianwenai.com，sk-sp- 订阅 Key）
  # 专属接入点，非按量付费的 dashscope 端点（sk-sp- key 打过去会 403）
  qwen-plan:
    display_name: Qwen Token Plan
    provider: alibaba
    base_url: https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic
    api_key_env: QWEN_PLAN_API_KEY
    auth_header: x-api-key
    auth_type: api_key
    default_variant: 3.8-max
    variants:
      3.8-max:
        display_name: "Qwen3.8 Max (Token Plan)"
        # GA id；旧 qwen3.8-max-preview 上游暂可用但已弃用
        model_id: qwen3.8-max
        max_tokens: 65536
        context_window: 1000000
      3.7-max:
        display_name: "Qwen3.7 Max (Token Plan)"
        model_id: qwen3.7-max
        max_tokens: 65536
        context_window: 1000000
      # latest-model 文档称 Token Plan 积分覆盖 Qwen3.8-Flash（同一订阅接入点）；
      # overview 页的档位模型表尚未列出（该表仍含已下线的 glm-5.1，判断为过期）。
      # 若订阅档位不含该模型，上游会返回 403 AccessDenied.Unpurchased
      3.8-flash:
        display_name: "Qwen3.8 Flash (Token Plan)"
        model_id: qwen3.8-flash
        max_tokens: 131072
        context_window: 1000000

  # 智谱 GLM Coding Plan 订阅专属通道（bigmodel.cn/claude-code）。
  # open.bigmodel.cn/api/anthropic 被 Coding Plan 门控：按量付费 key /
  # tokens 资源包会 429 [1309]。国内按量付费只有 OpenAI 协议（/api/paas/v4），
  # 无 Anthropic 通道，故没有按量 glm provider。
  glm-plan:
    display_name: GLM Coding Plan
    provider: zhipu-coding
    base_url: https://open.bigmodel.cn/api/anthropic
    api_key_env: GLM_PLAN_API_KEY
    auth_header: x-api-key
    auth_type: api_key
    default_variant: "5.3"
    variants:
      # GLM-5.3 强制开启思考（low/high/max，默认 max），不支持关闭
      5.3:
        display_name: "GLM-5.3 (Coding Plan)"
        model_id: glm-5.3
        max_tokens: 131072
        context_window: 1000000
      # GLM-5.1 removed: Zhipu retired it (coding-plan calls auto-switch to 5.2)
      5.2:
        display_name: "GLM-5.2 (Coding Plan)"
        model_id: glm-5.2
        max_tokens: 131072
        context_window: 1000000
      # GLM-5.3-Flash：GLM-5 系列首个原生多模态模型（视频/图片/文本/文件输入），
      # 1M 上下文、最大输出 128K，文本参数与 GLM-5.3 一致（同样不可关闭思考）；
      # Coding Plan 额度为 GLM-5.3 的 3 倍，同端点同 Key
      5.3-flash:
        display_name: "GLM-5.3-Flash (Coding Plan)"
        model_id: glm-5.3-flash
        max_tokens: 131072
        context_window: 1000000

  glm-global:
    display_name: GLM Global
    provider: zhipu-global
    base_url: https://api.z.ai/api/anthropic
    api_key_env: GLM_GLOBAL_API_KEY
    auth_header: x-api-key
    auth_type: api_key
    default_variant: "5.3"
    variants:
      5.3:
        display_name: "GLM-5.3 (Global)"
        model_id: glm-5.3
        max_tokens: 131072
        context_window: 1000000
      5.2:
        display_name: "GLM-5.2 (Global)"
        model_id: glm-5.2
        max_tokens: 131072
        context_window: 1000000
      5.3-flash:
        display_name: "GLM-5.3-Flash (Global)"
        model_id: glm-5.3-flash
        max_tokens: 131072
        context_window: 1000000

  step:
    display_name: StepFun
    provider: stepfun
    base_url: https://api.stepfun.com
    api_key_env: STEP_API_KEY
    auth_header: Authorization
    auth_type: bearer
    default_variant: 3.7-flash
    variants:
      3.7-flash:
        display_name: "Step 3.7 Flash"
        model_id: step-3.7-flash
        max_tokens: 393216
        context_window: 262144

  step-plan:
    display_name: StepFun Step Plan
    provider: stepfun-plan
    base_url: https://api.stepfun.com/step_plan
    api_key_env: STEP_PLAN_API_KEY
    auth_header: Authorization
    auth_type: bearer
    default_variant: 3.7-flash
    variants:
      3.7-flash:
        display_name: "Step 3.7 Flash (Step Plan)"
        model_id: step-3.7-flash
        max_tokens: 393216
        context_window: 262144

  mimo:
    display_name: MiMo Token Plan SGP
    provider: xiaomi-token-sgp
    base_url: https://token-plan-sgp.xiaomimimo.com/anthropic
    api_key_env: MIMO_API_KEY
    auth_header: api-key
    auth_type: api_key
    default_variant: v2.5-pro
    variants:
      v2.5-pro:
        display_name: "MiMo V2.5 Pro"
        model_id: mimo-v2.5-pro
        max_tokens: 131072
        context_window: 1048576
      v2.5:
        display_name: "MiMo V2.5"
        model_id: mimo-v2.5
        max_tokens: 131072
        context_window: 1048576

  mimo-token-cn:
    display_name: MiMo Token Plan CN
    provider: xiaomi-token-cn
    base_url: https://token-plan-cn.xiaomimimo.com/anthropic
    api_key_env: MIMO_TOKEN_CN_API_KEY
    auth_header: api-key
    auth_type: api_key
    default_variant: v2.5-pro
    variants:
      v2.5-pro:
        display_name: "MiMo V2.5 Pro (CN)"
        model_id: mimo-v2.5-pro
        max_tokens: 131072
        context_window: 1048576
      v2.5:
        display_name: "MiMo V2.5 (CN)"
        model_id: mimo-v2.5
        max_tokens: 131072
        context_window: 1048576

  mimo-token-ams:
    display_name: MiMo Token Plan AMS
    provider: xiaomi-token-ams
    base_url: https://token-plan-ams.xiaomimimo.com/anthropic
    api_key_env: MIMO_TOKEN_AMS_API_KEY
    auth_header: api-key
    auth_type: api_key
    default_variant: v2.5-pro
    variants:
      v2.5-pro:
        display_name: "MiMo V2.5 Pro (AMS)"
        model_id: mimo-v2.5-pro
        max_tokens: 131072
        context_window: 1048576
      v2.5:
        display_name: "MiMo V2.5 (AMS)"
        model_id: mimo-v2.5
        max_tokens: 131072
        context_window: 1048576

  mimo-payg:
    display_name: MiMo Pay-as-you-go
    provider: xiaomi-payg
    base_url: https://api.xiaomimimo.com/anthropic
    api_key_env: MIMO_PAYG_API_KEY
    auth_header: api-key
    auth_type: api_key
    default_variant: v2.5-pro
    variants:
      v2.5-pro:
        display_name: "MiMo V2.5 Pro (Pay-as-you-go)"
        model_id: mimo-v2.5-pro
        max_tokens: 131072
        context_window: 1048576
      v2.5:
        display_name: "MiMo V2.5 (Pay-as-you-go)"
        model_id: mimo-v2.5
        max_tokens: 131072
        context_window: 1048576

  seed:
    display_name: Doubao Seed (Volcengine)
    provider: volcengine-ark
    # 按量付费（方舟 API 调用）的 Anthropic 兼容接入点；订阅版 Agent Plan 用 /api/plan
    base_url: https://ark.cn-beijing.volces.com/api/compatible
    api_key_env: ARK_API_KEY
    auth_header: Authorization
    auth_type: bearer
    default_variant: 2.1-pro
    variants:
      2.1-pro:
        display_name: "Doubao Seed 2.1 Pro"
        model_id: doubao-seed-2-1-pro-260628
        max_tokens: 262144
        context_window: 262144
      2.1-turbo:
        display_name: "Doubao Seed 2.1 Turbo"
        model_id: doubao-seed-2-1-turbo-260628
        max_tokens: 262144
        context_window: 262144

  seed-plan:
    display_name: Doubao Seed (Volcengine Agent Plan)
    provider: volcengine-ark-plan
    # 订阅版 Agent Plan 接入点，需专属 API Key（与按量付费 ARK_API_KEY 不同）
    base_url: https://ark.cn-beijing.volces.com/api/plan
    api_key_env: ARK_PLAN_API_KEY
    auth_header: Authorization
    auth_type: bearer
    default_variant: 2.1-pro
    variants:
      2.1-pro:
        display_name: "Doubao Seed 2.1 Pro (Agent Plan)"
        model_id: doubao-seed-2-1-pro-260628
        max_tokens: 262144
        context_window: 262144
      2.1-turbo:
        display_name: "Doubao Seed 2.1 Turbo (Agent Plan)"
        model_id: doubao-seed-2-1-turbo-260628
        max_tokens: 262144
        context_window: 262144

aliases:
  deepseek: deepseek-v4-pro
  deepseek-v4: deepseek-v4-pro
  deepseek-pro: deepseek-v4-pro
  deepseek-flash: deepseek-flash
  deepseek-chat: deepseek-flash
  deepseek-4.1-flash: deepseek-flash
  deepseek-v4.1-flash: deepseek-flash
  ds-4.1: deepseek-flash
  # 视觉别名改指 V4.1 Flash（原生多模态）。注意：不要把 deepseek-v4-flash /
  # deepseek-v4-flash-vision-exp 反向别名到 deepseek-flash——1.18 之前生成的
  # 配置里有 deepseek-flash -> deepseek-v4-flash，用户配置合并在默认之上会
  # 形成别名环，导致所有命令报 "Invalid config file"
  deepseek-vision: deepseek-flash
  ds-vision: deepseek-flash
  ds: deepseek-v4-pro
  kimi: kimi-k2.6
  kimi-k2: kimi-k2.6
  kimi-k2.6: kimi-k2.6
  moonshot: kimi-k2.6
  kimi-k3: kimi-k3
  k3: kimi-k3
  kimi-k2.7-code: kimi-k2.7-code
  kimi-code: kimi-k2.7-code
  k2.7-code: kimi-k2.7-code
  kimi-k2.7-code-highspeed: kimi-k2.7-code-highspeed
  kimi-code-highspeed: kimi-k2.7-code-highspeed
  kimi-highspeed: kimi-k2.7-code-highspeed
  k2.7-highspeed: kimi-k2.7-code-highspeed
  kimi-cn: kimi-cn-k3
  moonshot-cn: kimi-cn-k3
  kimi-cn-k3: kimi-cn-k3
  k3-cn: kimi-cn-k3
  kimi-cn-k2.6: kimi-cn-k2.6
  kimi-cn-k2.7-code: kimi-cn-k2.7-code
  kimi-cn-k2.7-code-highspeed: kimi-cn-k2.7-code-highspeed
  kimi-plan: kimi-plan-k3-1m
  kimi-plan-k3-1m: kimi-plan-k3-1m
  kimi-plan-k3: kimi-plan-k3
  kimi-for-coding: kimi-plan-for-coding
  kimi-plan-for-coding: kimi-plan-for-coding
  kimi-plan-for-coding-highspeed: kimi-plan-for-coding-highspeed
  kimi-plan-highspeed: kimi-plan-for-coding-highspeed
  minimax: minimax-m3
  minimax-cn: minimax-m3
  minimax-m3: minimax-m3
  minimaxi: minimax-m3
  minimax-global: minimax-global-m3
  minimax-io: minimax-global-m3
  minimax-global-m3: minimax-global-m3
  mm: minimax-m3
  qwen: qwen3.8-max
  tongyi: qwen3.8-max
  qwen3.8: qwen3.8-max
  qwen3.8-max: qwen3.8-max
  qwen-max: qwen3.7-max
  qwen3.7-max: qwen3.7-max
  qwen3.7: qwen3.7-max
  qwen-plan: qwen-plan-3.8-max
  qwen-plan-3.8: qwen-plan-3.8-max
  qwen-plan-3.8-max: qwen-plan-3.8-max
  qwen-plan-max: qwen-plan-3.8-max
  qwen-plan-3.7: qwen-plan-3.7-max
  qwen-plan-3.7-max: qwen-plan-3.7-max
  qwen-flash: qwen3.8-flash
  qwen3.8-flash: qwen3.8-flash
  qwen-plan-flash: qwen-plan-3.8-flash
  qwen-plan-3.8-flash: qwen-plan-3.8-flash
  glm: glm-plan-5.3
  glm-5.3: glm-plan-5.3
  glm-5.2: glm-plan-5.2
  zhipu: glm-plan-5.3
  chatglm: glm-plan-5.3
  glm-plan: glm-plan-5.3
  glm-plan-5.3: glm-plan-5.3
  glm-plan-5.2: glm-plan-5.2
  glm-flash: glm-plan-5.3-flash
  glm-5.3-flash: glm-plan-5.3-flash
  glm-plan-flash: glm-plan-5.3-flash
  glm-plan-5.3-flash: glm-plan-5.3-flash
  glm-global: glm-global-5.3
  glm-global-5.3: glm-global-5.3
  glm-global-5.2: glm-global-5.2
  glm-global-flash: glm-global-5.3-flash
  glm-global-5.3-flash: glm-global-5.3-flash
  zai-flash: glm-global-5.3-flash
  zai: glm-global-5.3
  z-ai: glm-global-5.3
  step: step-3.7-flash
  step-3.7: step-3.7-flash
  step-3.7-flash: step-3.7-flash
  stepfun: step-3.7-flash
  step-plan: step-plan-3.7-flash
  step-plan-3.7: step-plan-3.7-flash
  step-plan-3.7-flash: step-plan-3.7-flash
  stepplan: step-plan-3.7-flash
  mimo: mimo-v2.5-pro
  mimo-pro: mimo-v2.5-pro
  mimo-token: mimo-v2.5-pro
  mimo-token-sgp: mimo-v2.5-pro
  mimo-sgp: mimo-v2.5-pro
  mimo-v2: mimo-v2.5
  mimo-v2.5: mimo-v2.5
  mimo-v2.5-pro: mimo-v2.5-pro
  mimo-token-cn: mimo-token-cn-v2.5-pro
  mimo-cn: mimo-token-cn-v2.5-pro
  mimo-token-cn-v2.5: mimo-token-cn-v2.5
  mimo-token-ams: mimo-token-ams-v2.5-pro
  mimo-ams: mimo-token-ams-v2.5-pro
  mimo-token-ams-v2.5: mimo-token-ams-v2.5
  mimo-payg: mimo-payg-v2.5-pro
  mimo-payg-pro: mimo-payg-v2.5-pro
  mimo-payg-v2.5: mimo-payg-v2.5
  xiaomi: mimo-v2.5-pro
  seed: seed-2.1-pro
  seed-pro: seed-2.1-pro
  seed-2.1: seed-2.1-pro
  seed-2.1-pro: seed-2.1-pro
  seed-turbo: seed-2.1-turbo
  seed-2.1-turbo: seed-2.1-turbo
  doubao: seed-2.1-pro
  doubao-seed: seed-2.1-pro
  seed-plan: seed-plan-2.1-pro
  seed-plan-pro: seed-plan-2.1-pro
  seed-plan-2.1: seed-plan-2.1-pro
  seed-plan-2.1-pro: seed-plan-2.1-pro
  seed-plan-turbo: seed-plan-2.1-turbo
  seed-plan-2.1-turbo: seed-plan-2.1-turbo
  doubao-plan: seed-plan-2.1-pro

gateway:
  port: 8080
  timeout: 300
`;
}

export function generateEnvFile(): string {
  return `# Claude Code Model Router - API Keys
# Fill in your API keys below

# DeepSeek - https://platform.deepseek.com/
DEEPSEEK_API_KEY=

# Kimi / Moonshot 国际站 - https://platform.kimi.ai/
KIMI_API_KEY=

# Kimi / Moonshot 国内开放平台 - https://platform.kimi.com/ (原 platform.moonshot.cn)
KIMI_CN_API_KEY=

# Kimi Code 会员 coding 订阅 - https://www.kimi.com/code/console (与开放平台 Key 不互通)
KIMI_CODE_API_KEY=

# MiniMax CN / Token Plan - https://platform.minimaxi.com/
MINIMAX_API_KEY=

# MiniMax Global - https://platform.minimax.io/
MINIMAX_GLOBAL_API_KEY=

# Qwen 按量付费 - https://dashscope.console.aliyun.com/
QWEN_API_KEY=

# Qwen Token Plan 订阅 - https://platform.qianwenai.com/ (sk-sp- 订阅 Key，专属接入点 token-plan.cn-beijing.maas.aliyuncs.com)
QWEN_PLAN_API_KEY=

# GLM Coding Plan (智谱订阅) - https://bigmodel.cn/claude-code
# 仅限 Coding Plan 订阅 key；按量付费 key / tokens 资源包会 429 [1309]。
# 国内按量付费只有 OpenAI 协议，无 Anthropic 通道，ccmr 暂无法接入。
GLM_PLAN_API_KEY=

# GLM Global (Z.ai) - https://z.ai/model-api
GLM_GLOBAL_API_KEY=

# Doubao Seed (Volcengine 火山方舟, CN only) - https://console.volcengine.com/ark
# 按量付费 Anthropic 接入点 https://ark.cn-beijing.volces.com/api/compatible，
# 模型 doubao-seed-2-1-pro-260628 / doubao-seed-2-1-turbo-260628。
ARK_API_KEY=

# Doubao Seed - Agent Plan 订阅专属 Key（接入点 https://ark.cn-beijing.volces.com/api/plan）
# 用 seed-plan / seed-plan-turbo 别名。
ARK_PLAN_API_KEY=

# StepFun (pay-as-you-go) - https://platform.stepfun.com/
STEP_API_KEY=

# StepFun Step Plan (subscription) - https://platform.stepfun.com/
STEP_PLAN_API_KEY=

# MiMo Token Plan (tp-*) - default SGP cluster
MIMO_API_KEY=

# MiMo Token Plan CN / AMS clusters (tp-*)
MIMO_TOKEN_CN_API_KEY=
MIMO_TOKEN_AMS_API_KEY=

# MiMo Pay-as-you-go (sk-*) - https://platform.xiaomimimo.com/
MIMO_PAYG_API_KEY=

# Inbound auth (optional but REQUIRED if you bind to a non-loopback host).
# When set, callers must send this token as "x-api-key" or "Authorization: Bearer <token>".
# Leave empty only when the gateway stays bound to 127.0.0.1.
CCMR_REQUIRED_AUTH_TOKEN=

# Optional client-side override. ccmr claude/stats otherwise reuse the required token above.
CCMR_AUTH_TOKEN=

# Optional gateway overrides (CLI flags still have highest precedence).
# GATEWAY_PORT=8080
# REQUEST_TIMEOUT=300
# LOG_LEVEL=INFO
`;
}
