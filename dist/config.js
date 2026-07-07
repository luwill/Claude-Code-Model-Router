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
const js_yaml_1 = __importDefault(require("js-yaml"));
const dotenv_1 = require("dotenv");
const paths_js_1 = require("./paths.js");
// Load .env files: ./.env first (wins), then ~/.ccmr/.env as global fallback.
// dotenv never overrides variables that are already set.
(0, dotenv_1.config)();
(0, dotenv_1.config)({ path: node_path_1.default.join((0, paths_js_1.ccmrHome)(), '.env') });
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
            default_variant: '3.5-plus',
            variants: {
                '3.5-plus': {
                    model_key: 'qwen3.5-plus',
                    display_name: 'Qwen3.5 Plus',
                    model_id: 'qwen3.5-plus',
                    max_tokens: 65536,
                    context_window: 1000000,
                },
                '3.5-flash': {
                    model_key: 'qwen3.5-flash',
                    display_name: 'Qwen3.5 Flash',
                    model_id: 'qwen3.5-flash',
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
        'kimi-k2.7-code': 'kimi-k2.7-code',
        'kimi-code': 'kimi-k2.7-code',
        'k2.7-code': 'kimi-k2.7-code',
        'kimi-k2.7-code-highspeed': 'kimi-k2.7-code-highspeed',
        'kimi-code-highspeed': 'kimi-k2.7-code-highspeed',
        'kimi-highspeed': 'kimi-k2.7-code-highspeed',
        'k2.7-highspeed': 'kimi-k2.7-code-highspeed',
        minimax: 'minimax-m3',
        'minimax-cn': 'minimax-m3',
        'minimax-m3': 'minimax-m3',
        minimaxi: 'minimax-m3',
        'minimax-global': 'minimax-global-m3',
        'minimax-io': 'minimax-global-m3',
        'minimax-global-m3': 'minimax-global-m3',
        mm: 'minimax-m3',
        qwen: 'qwen3.5-plus',
        'qwen3.5': 'qwen3.5-plus',
        tongyi: 'qwen3.5-plus',
        'qwen-max': 'qwen3.7-max',
        'qwen3.7-max': 'qwen3.7-max',
        'qwen3.7': 'qwen3.7-max',
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
    constructor(configPath) {
        this.requestedConfigPath = configPath;
        this.config = this.loadConfig(configPath);
        this.loadApiKeys();
    }
    loadConfig(configPath) {
        // Try to find config file: explicit path > cwd > global ~/.ccmr fallback
        const possiblePaths = [
            configPath,
            node_path_1.default.join(process.cwd(), 'models.yaml'),
            node_path_1.default.join(process.cwd(), 'config', 'models.yaml'),
            node_path_1.default.join(process.cwd(), '.claude-router.yaml'),
            node_path_1.default.join((0, paths_js_1.ccmrHome)(), 'models.yaml'),
        ].filter(Boolean);
        for (const p of possiblePaths) {
            if (node_fs_1.default.existsSync(p)) {
                try {
                    const content = node_fs_1.default.readFileSync(p, 'utf-8');
                    const parsed = js_yaml_1.default.load(content);
                    this.configFilePath = p;
                    return this.mergeConfig(parsed ?? {});
                }
                catch (e) {
                    console.warn(`Warning: Failed to parse config file ${p}:`, e);
                }
            }
        }
        // Return default config if no file found
        this.configFilePath = null;
        return this.normalizeConfig(exports.DEFAULT_CONFIG);
    }
    mergeConfig(parsed) {
        return this.normalizeConfig({
            default_model: parsed.default_model ?? exports.DEFAULT_CONFIG.default_model,
            providers: this.mergeProviders(exports.DEFAULT_CONFIG.providers ?? {}, parsed.providers ?? {}),
            models: { ...exports.DEFAULT_CONFIG.models, ...parsed.models },
            aliases: { ...exports.DEFAULT_CONFIG.aliases, ...parsed.aliases },
            gateway: { ...exports.DEFAULT_CONFIG.gateway, ...parsed.gateway },
        });
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
        return {
            ...config,
            default_model: this.resolveAlias(config.default_model, config.aliases ?? {}),
            models,
            aliases: config.aliases ?? {},
            gateway: config.gateway,
        };
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
        return aliases[name] ?? name;
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
     * Hot-reload: re-apply .env files and re-read the loaded config file.
     * A file that no longer parses keeps the previous working config
     * instead of silently degrading to defaults.
     */
    reload() {
        this.applyEnvFiles();
        if (this.configFilePath && node_fs_1.default.existsSync(this.configFilePath)) {
            try {
                const content = node_fs_1.default.readFileSync(this.configFilePath, 'utf-8');
                const parsed = js_yaml_1.default.load(content);
                this.config = this.mergeConfig(parsed ?? {});
            }
            catch (e) {
                console.warn(`Warning: reload failed, keeping previous config (${this.configFilePath}):`, e instanceof Error ? e.message : e);
            }
        }
        else {
            // No file previously loaded (or it vanished) - rediscover
            this.config = this.loadConfig(this.requestedConfigPath);
        }
        this.loadApiKeys();
    }
    /**
     * Re-read .env files so edited keys take effect on reload. Applied
     * global-first so ./.env keeps precedence over ~/.ccmr/.env.
     */
    applyEnvFiles() {
        const candidates = [node_path_1.default.join((0, paths_js_1.ccmrHome)(), '.env'), node_path_1.default.join(process.cwd(), '.env')];
        for (const p of candidates) {
            if (!node_fs_1.default.existsSync(p)) {
                continue;
            }
            try {
                Object.assign(process.env, (0, dotenv_1.parse)(node_fs_1.default.readFileSync(p, 'utf-8')));
            }
            catch (e) {
                console.warn(`Warning: failed to re-read ${p}:`, e instanceof Error ? e.message : e);
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
    default_variant: 3.5-plus
    variants:
      3.5-plus:
        model_key: qwen3.5-plus
        display_name: "Qwen3.5 Plus"
        model_id: qwen3.5-plus
        max_tokens: 65536
        context_window: 1000000
      3.5-flash:
        model_key: qwen3.5-flash
        display_name: "Qwen3.5 Flash"
        model_id: qwen3.5-flash
        max_tokens: 65536
        context_window: 1000000
      3.7-max:
        model_key: qwen3.7-max
        display_name: "Qwen3.7 Max"
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
  kimi-k2.7-code: kimi-k2.7-code
  kimi-code: kimi-k2.7-code
  k2.7-code: kimi-k2.7-code
  kimi-k2.7-code-highspeed: kimi-k2.7-code-highspeed
  kimi-code-highspeed: kimi-k2.7-code-highspeed
  kimi-highspeed: kimi-k2.7-code-highspeed
  k2.7-highspeed: kimi-k2.7-code-highspeed
  minimax: minimax-m3
  minimax-cn: minimax-m3
  minimax-m3: minimax-m3
  minimaxi: minimax-m3
  minimax-global: minimax-global-m3
  minimax-io: minimax-global-m3
  minimax-global-m3: minimax-global-m3
  mm: minimax-m3
  qwen: qwen3.5-plus
  qwen3.5: qwen3.5-plus
  tongyi: qwen3.5-plus
  qwen-max: qwen3.7-max
  qwen3.7-max: qwen3.7-max
  qwen3.7: qwen3.7-max
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

# Kimi / Moonshot - https://platform.kimi.ai/
KIMI_API_KEY=

# MiniMax CN / Token Plan - https://platform.minimaxi.com/
MINIMAX_API_KEY=

# MiniMax Global - https://platform.minimax.io/
MINIMAX_GLOBAL_API_KEY=

# Qwen - https://dashscope.console.aliyun.com/
QWEN_API_KEY=

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
`;
}
//# sourceMappingURL=config.js.map