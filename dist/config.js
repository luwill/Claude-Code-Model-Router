"use strict";
/**
 * Configuration management for Claude Code Model Router
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = exports.DEFAULT_CONFIG = void 0;
exports.generateConfigFile = generateConfigFile;
exports.generateEnvFile = generateEnvFile;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const dotenv_1 = require("dotenv");
const paths_js_1 = require("./paths.js");
exports.DEFAULT_CONFIG = {
    default_model: 'deepseek-v4-pro',
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
                'v4-pro': {
                    display_name: 'DeepSeek V4 Pro',
                    model_id: 'deepseek-v4-pro',
                    max_tokens: 393216,
                    context_window: 1048576,
                },
                'v4-flash': {
                    display_name: 'DeepSeek V4 Flash',
                    model_id: 'deepseek-v4-flash',
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
                    model_id: 'k3[1m]',
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
            default_variant: '3.7-max',
            variants: {
                // qwen3.8-max-preview is Token-Plan-only today; a pay-as-you-go key
                // gets 403 Model.AccessDenied. It lives on the qwen-plan provider
                // (sk-sp- subscription key) below, not here. Re-add a pay-go variant
                // only once Alibaba opens the preview to pay-as-you-go.
                '3.7-max': {
                    model_key: 'qwen3.7-max',
                    display_name: 'Qwen3.7 Max',
                    model_id: 'qwen3.7-max',
                    max_tokens: 65536,
                    context_window: 1000000,
                },
            },
        },
        'qwen-plan': {
            display_name: 'Qwen Token Plan',
            provider: 'alibaba',
            // 千问 AI 平台 Token Plan 订阅接入点（platform.qianwenai.com）。Key 为 sk-sp- 订阅密钥，
            // 走 DashScope 的 Anthropic 兼容端点，与按量付费同一 base_url，但按订阅额度计费。
            base_url: 'https://dashscope.aliyuncs.com/apps/anthropic',
            api_key_env: 'QWEN_PLAN_API_KEY',
            auth_header: 'x-api-key',
            auth_type: 'api_key',
            supports_streaming: true,
            supports_tools: true,
            default_variant: '3.8-max',
            variants: {
                '3.8-max': {
                    display_name: 'Qwen3.8 Max (Token Plan)',
                    model_id: 'qwen3.8-max-preview',
                    max_tokens: 65536,
                    context_window: 1000000,
                },
                '3.7-max': {
                    display_name: 'Qwen3.7 Max (Token Plan)',
                    model_id: 'qwen3.7-max',
                    max_tokens: 65536,
                    context_window: 1000000,
                },
            },
        },
        glm: {
            display_name: 'GLM CN',
            provider: 'zhipu',
            base_url: 'https://open.bigmodel.cn/api/anthropic',
            api_key_env: 'GLM_API_KEY',
            auth_header: 'x-api-key',
            auth_type: 'api_key',
            supports_streaming: true,
            supports_tools: true,
            default_variant: '5.2',
            variants: {
                '5.2': {
                    display_name: 'GLM-5.2',
                    model_id: 'glm-5.2',
                    max_tokens: 131072,
                    context_window: 1000000,
                },
                '5.1': {
                    display_name: 'GLM-5.1',
                    model_id: 'glm-5.1',
                    max_tokens: 131072,
                    context_window: 204800,
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
            default_variant: '5.2',
            variants: {
                '5.2': {
                    display_name: 'GLM-5.2 (Global)',
                    model_id: 'glm-5.2',
                    max_tokens: 131072,
                    context_window: 1000000,
                },
                '5.1': {
                    display_name: 'GLM-5.1 (Global)',
                    model_id: 'glm-5.1',
                    max_tokens: 131072,
                    context_window: 204800,
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
        'deepseek-flash': 'deepseek-v4-flash',
        'deepseek-chat': 'deepseek-v4-flash',
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
        qwen: 'qwen3.7-max',
        tongyi: 'qwen3.7-max',
        'qwen-max': 'qwen3.7-max',
        'qwen3.7-max': 'qwen3.7-max',
        'qwen3.7': 'qwen3.7-max',
        // qwen3.8-max-preview is reachable only via the Token Plan provider below.
        'qwen3.8': 'qwen-plan-3.8-max',
        'qwen3.8-max': 'qwen-plan-3.8-max',
        'qwen-plan': 'qwen-plan-3.8-max',
        'qwen-plan-3.8': 'qwen-plan-3.8-max',
        'qwen-plan-3.8-max': 'qwen-plan-3.8-max',
        'qwen-plan-max': 'qwen-plan-3.8-max',
        'qwen-plan-3.7': 'qwen-plan-3.7-max',
        'qwen-plan-3.7-max': 'qwen-plan-3.7-max',
        glm: 'glm-5.2',
        'glm-5': 'glm-5.1',
        'glm-5.1': 'glm-5.1',
        'glm-5.2': 'glm-5.2',
        zhipu: 'glm-5.2',
        chatglm: 'glm-5.2',
        'glm-global': 'glm-global-5.2',
        'glm-global-5.2': 'glm-global-5.2',
        'glm-global-5.1': 'glm-global-5.1',
        zai: 'glm-global-5.2',
        'z-ai': 'glm-global-5.2',
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
class ConfigManager {
    config;
    apiKeys = new Map();
    requestedConfigPath;
    configFilePath = null;
    /** Values this instance injected from .env, used to revoke removed entries. */
    managedEnvValues = new Map();
    constructor(configPath) {
        this.requestedConfigPath = configPath ?? undefined;
        this.config = configPath === null ? this.normalizeConfig(exports.DEFAULT_CONFIG) : this.loadConfig(configPath);
        this.applyEnvFiles();
        this.config = this.applyGatewayEnvOverrides(this.config);
        this.loadApiKeys();
    }
    loadConfig(configPath) {
        // An explicit path is a contract: never silently fall back to another
        // project or the built-in defaults when it is missing or malformed.
        if (configPath) {
            const explicitPath = node_path_1.default.resolve(configPath);
            if (!node_fs_1.default.existsSync(explicitPath)) {
                throw new Error(`Config file not found: ${explicitPath}`);
            }
            const config = this.readConfigFile(explicitPath);
            this.configFilePath = explicitPath;
            return config;
        }
        // Otherwise discover cwd first, then the global ~/.ccmr fallback.
        const possiblePaths = [
            node_path_1.default.join(process.cwd(), 'models.yaml'),
            node_path_1.default.join(process.cwd(), 'config', 'models.yaml'),
            node_path_1.default.join(process.cwd(), '.claude-router.yaml'),
            node_path_1.default.join((0, paths_js_1.ccmrHome)(), 'models.yaml'),
        ];
        for (const p of possiblePaths) {
            if (node_fs_1.default.existsSync(p)) {
                const config = this.readConfigFile(p);
                this.configFilePath = p;
                return config;
            }
        }
        // Return default config if no file found
        this.configFilePath = null;
        return this.normalizeConfig(exports.DEFAULT_CONFIG);
    }
    readConfigFile(filePath) {
        try {
            const content = node_fs_1.default.readFileSync(filePath, 'utf-8');
            const parsed = js_yaml_1.default.load(content);
            if (parsed !== null && !this.isRecord(parsed)) {
                throw new Error('top-level YAML value must be an object');
            }
            if (this.isRecord(parsed)) {
                for (const section of ['providers', 'models', 'aliases', 'gateway']) {
                    if (parsed[section] !== undefined && !this.isRecord(parsed[section])) {
                        throw new Error(`${section} must be an object`);
                    }
                }
            }
            return this.mergeConfig((parsed ?? {}));
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            throw new Error(`Invalid config file ${filePath}: ${detail}`);
        }
    }
    mergeConfig(parsed) {
        const merged = {
            default_model: parsed.default_model ?? exports.DEFAULT_CONFIG.default_model,
            providers: this.mergeProviders(exports.DEFAULT_CONFIG.providers ?? {}, parsed.providers ?? {}),
            models: { ...exports.DEFAULT_CONFIG.models, ...parsed.models },
            aliases: { ...exports.DEFAULT_CONFIG.aliases, ...parsed.aliases },
            gateway: { ...exports.DEFAULT_CONFIG.gateway, ...parsed.gateway },
        };
        this.validateConfigShape(merged);
        return this.normalizeConfig(merged);
    }
    mergeProviders(defaults, overrides) {
        const providers = { ...defaults };
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
    normalizeConfig(config) {
        const models = {};
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
    buildModelConfig(providerKey, variantKey, provider, variant) {
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
    resolveAlias(name, aliases) {
        let current = name;
        const seen = new Set();
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
    isRecord(value) {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
    requireString(value, field) {
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw new Error(`${field} must be a non-empty string`);
        }
    }
    validateFallback(value, field) {
        if (value === undefined)
            return;
        if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
            throw new Error(`${field} must be an array of model names`);
        }
    }
    validateConfigShape(config) {
        this.requireString(config.default_model, 'default_model');
        if (!this.isRecord(config.providers))
            throw new Error('providers must be an object');
        if (!this.isRecord(config.models))
            throw new Error('models must be an object');
        if (!this.isRecord(config.aliases))
            throw new Error('aliases must be an object');
        if (!this.isRecord(config.gateway))
            throw new Error('gateway must be an object');
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
            if (!this.isRecord(providerValue))
                throw new Error(`providers.${providerKey} must be an object`);
            const provider = providerValue;
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
                throw new Error(`providers.${providerKey}.default_variant '${provider.default_variant}' is not defined`);
            }
            this.validateFallback(provider.fallback, `providers.${providerKey}.fallback`);
            for (const [variantKey, variantValue] of Object.entries(provider.variants)) {
                if (!this.isRecord(variantValue)) {
                    throw new Error(`providers.${providerKey}.variants.${variantKey} must be an object`);
                }
                const variant = variantValue;
                this.requireString(variant.display_name, `providers.${providerKey}.variants.${variantKey}.display_name`);
                this.requireString(variant.model_id, `providers.${providerKey}.variants.${variantKey}.model_id`);
                this.validatePositiveInteger(variant.max_tokens, `providers.${providerKey}.variants.${variantKey}.max_tokens`);
                this.validatePositiveInteger(variant.context_window, `providers.${providerKey}.variants.${variantKey}.context_window`);
                this.validateFallback(variant.fallback, `providers.${providerKey}.variants.${variantKey}.fallback`);
            }
        }
        for (const [modelKey, modelValue] of Object.entries(config.models)) {
            if (!this.isRecord(modelValue))
                throw new Error(`models.${modelKey} must be an object`);
            const model = modelValue;
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
    validatePositiveInteger(value, field) {
        if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
            throw new Error(`${field} must be a positive integer`);
        }
    }
    requireHttpUrl(value, field) {
        let url;
        try {
            url = new URL(value);
        }
        catch {
            throw new Error(`${field} must be a valid URL`);
        }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw new Error(`${field} must use http or https`);
        }
    }
    applyGatewayEnvOverrides(config) {
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
    parsePositiveInteger(value, field, maximum) {
        if (!/^\d+$/.test(value.trim()))
            throw new Error(`${field} must be a positive integer`);
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
            throw new Error(`${field} must be between 1 and ${maximum}`);
        }
        return parsed;
    }
    parsePositiveNumber(value, field) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0)
            throw new Error(`${field} must be positive`);
        return parsed;
    }
    loadApiKeys() {
        this.apiKeys.clear();
        for (const [name, model] of Object.entries(this.config.models)) {
            const key = process.env[model.api_key_env];
            if (key) {
                this.apiKeys.set(name, key);
            }
        }
    }
    getConfig() {
        return this.config;
    }
    getModel(name) {
        const resolved = this.resolveModelName(name);
        return this.config.models[resolved];
    }
    resolveModelName(name) {
        return this.resolveAlias(name, this.config.aliases);
    }
    getApiKey(modelName) {
        const resolved = this.resolveModelName(modelName);
        return this.apiKeys.get(resolved);
    }
    /**
     * Re-read API keys from process.env. Call after process.env mutations
     * (e.g. when a host process loads keys from a secret store at runtime).
     */
    reloadApiKeys() {
        this.loadApiKeys();
    }
    /** Path of the config file that was actually loaded (null = built-in defaults). */
    getConfigFilePath() {
        return this.configFilePath;
    }
    /**
     * Stable, secret-free identity for the config and .env sources used by this
     * process. Detached gateways are shared only when this identity matches the
     * launching CLI, preventing one project from silently using another
     * project's endpoints or credentials.
     */
    getSourceId() {
        const routingConfig = {
            defaultModel: this.config.default_model,
            aliases: this.config.aliases,
            models: this.config.models,
        };
        const credentialDigests = [...new Set(Object.values(this.config.models).map((model) => model.api_key_env))]
            .sort()
            .map((name) => {
            const value = process.env[name];
            return [
                name,
                value ? node_crypto_1.default.createHash('sha256').update(value).digest('hex') : null,
            ];
        });
        const descriptor = JSON.stringify({
            configFile: this.configFilePath ? node_path_1.default.resolve(this.configFilePath) : null,
            envFiles: this.getEnvFilePaths().map((file) => node_path_1.default.resolve(file)),
            routingConfig,
            credentialDigests,
        });
        return node_crypto_1.default.createHash('sha256').update(descriptor).digest('hex').slice(0, 24);
    }
    /** Existing .env sources, ordered from lower to higher precedence. */
    getEnvFilePaths() {
        return this.getEnvCandidatePaths().filter((file) => node_fs_1.default.existsSync(file));
    }
    /** All possible .env sources, including paths that do not exist yet. */
    getEnvCandidatePaths() {
        const configEnv = this.configFilePath
            ? node_path_1.default.join(node_path_1.default.dirname(this.configFilePath), '.env')
            : undefined;
        const candidates = [
            node_path_1.default.join((0, paths_js_1.ccmrHome)(), '.env'),
            node_path_1.default.join(process.cwd(), '.env'),
            configEnv,
        ].filter((file) => !!file);
        return [...new Set(candidates)];
    }
    /**
     * Hot-reload: re-apply .env files and re-read the loaded config file.
     * A file that no longer parses keeps the previous working config
     * instead of silently degrading to defaults.
     */
    reload() {
        this.applyEnvFiles();
        try {
            const nextConfig = this.configFilePath && node_fs_1.default.existsSync(this.configFilePath)
                ? this.readConfigFile(this.configFilePath)
                : this.loadConfig(this.requestedConfigPath);
            this.config = this.applyGatewayEnvOverrides(nextConfig);
        }
        catch (e) {
            console.warn(`Warning: reload failed, keeping previous config (${this.configFilePath ?? 'discovery'}):`, e instanceof Error ? e.message : e);
        }
        this.loadApiKeys();
    }
    /**
     * Re-read .env files so edited keys take effect on reload. Applied
     * global-first so ./.env keeps precedence over ~/.ccmr/.env.
     */
    applyEnvFiles() {
        const candidates = this.getEnvFilePaths();
        for (const [key, value] of this.managedEnvValues) {
            // Do not erase a value that another runtime component deliberately
            // replaced after we loaded it.
            if (process.env[key] === value) {
                delete process.env[key];
            }
        }
        this.managedEnvValues.clear();
        const fileValues = {};
        for (const p of candidates) {
            try {
                Object.assign(fileValues, (0, dotenv_1.parse)(node_fs_1.default.readFileSync(p, 'utf-8')));
            }
            catch (e) {
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
    listModels() {
        const result = {};
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
exports.ConfigManager = ConfigManager;
// Generate default config file content
function generateConfigFile() {
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

default_model: deepseek-v4-pro

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
      v4-pro:
        display_name: "DeepSeek V4 Pro"
        model_id: deepseek-v4-pro
        max_tokens: 393216
        context_window: 1048576
      v4-flash:
        display_name: "DeepSeek V4 Flash"
        model_id: deepseek-v4-flash
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
        model_id: "k3[1m]"
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
    default_variant: 3.7-max
    variants:
      # qwen3.8-max-preview 目前仅 Token Plan 发放，按量付费调用 403，见下方 qwen-plan
      3.7-max:
        model_key: qwen3.7-max
        display_name: "Qwen3.7 Max"
        model_id: qwen3.7-max
        max_tokens: 65536
        context_window: 1000000

  # 千问 AI 平台 Token Plan 订阅（platform.qianwenai.com，sk-sp- 订阅 Key，与按量付费同一端点）
  qwen-plan:
    display_name: Qwen Token Plan
    provider: alibaba
    base_url: https://dashscope.aliyuncs.com/apps/anthropic
    api_key_env: QWEN_PLAN_API_KEY
    auth_header: x-api-key
    auth_type: api_key
    default_variant: 3.8-max
    variants:
      3.8-max:
        display_name: "Qwen3.8 Max (Token Plan)"
        model_id: qwen3.8-max-preview
        max_tokens: 65536
        context_window: 1000000
      3.7-max:
        display_name: "Qwen3.7 Max (Token Plan)"
        model_id: qwen3.7-max
        max_tokens: 65536
        context_window: 1000000

  glm:
    display_name: GLM CN
    provider: zhipu
    base_url: https://open.bigmodel.cn/api/anthropic
    api_key_env: GLM_API_KEY
    auth_header: x-api-key
    auth_type: api_key
    default_variant: "5.2"
    variants:
      5.2:
        display_name: "GLM-5.2"
        model_id: glm-5.2
        max_tokens: 131072
        context_window: 1000000
      5.1:
        display_name: "GLM-5.1"
        model_id: glm-5.1
        max_tokens: 131072
        context_window: 204800

  glm-global:
    display_name: GLM Global
    provider: zhipu-global
    base_url: https://api.z.ai/api/anthropic
    api_key_env: GLM_GLOBAL_API_KEY
    auth_header: x-api-key
    auth_type: api_key
    default_variant: "5.2"
    variants:
      5.2:
        display_name: "GLM-5.2 (Global)"
        model_id: glm-5.2
        max_tokens: 131072
        context_window: 1000000
      5.1:
        display_name: "GLM-5.1 (Global)"
        model_id: glm-5.1
        max_tokens: 131072
        context_window: 204800

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
  deepseek-flash: deepseek-v4-flash
  deepseek-chat: deepseek-v4-flash
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
  qwen: qwen3.7-max
  tongyi: qwen3.7-max
  qwen-max: qwen3.7-max
  qwen3.7-max: qwen3.7-max
  qwen3.7: qwen3.7-max
  qwen3.8: qwen-plan-3.8-max
  qwen3.8-max: qwen-plan-3.8-max
  qwen-plan: qwen-plan-3.8-max
  qwen-plan-3.8: qwen-plan-3.8-max
  qwen-plan-3.8-max: qwen-plan-3.8-max
  qwen-plan-max: qwen-plan-3.8-max
  qwen-plan-3.7: qwen-plan-3.7-max
  qwen-plan-3.7-max: qwen-plan-3.7-max
  glm: glm-5.2
  glm-5: glm-5.1
  glm-5.1: glm-5.1
  glm-5.2: glm-5.2
  zhipu: glm-5.2
  chatglm: glm-5.2
  glm-global: glm-global-5.2
  glm-global-5.2: glm-global-5.2
  glm-global-5.1: glm-global-5.1
  zai: glm-global-5.2
  z-ai: glm-global-5.2
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
function generateEnvFile() {
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

# Qwen Token Plan 订阅 - https://platform.qianwenai.com/ (sk-sp- 订阅 Key，与按量付费端点相同)
QWEN_PLAN_API_KEY=

# GLM CN (智谱) - https://open.bigmodel.cn/
GLM_API_KEY=

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
//# sourceMappingURL=config.js.map