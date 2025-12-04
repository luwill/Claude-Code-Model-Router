/**
 * Configuration management for Claude Code Model Router
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { config as dotenvConfig } from 'dotenv';
import type { RouterConfig, ModelConfig, GatewayConfig } from './types.js';

// Load .env file
dotenvConfig();

const DEFAULT_CONFIG: RouterConfig = {
  default_model: 'deepseek',
  models: {
    deepseek: {
      display_name: 'DeepSeek V3.2',
      provider: 'deepseek',
      model_id: 'deepseek-chat',
      base_url: 'https://api.deepseek.com/anthropic',
      api_key_env: 'DEEPSEEK_API_KEY',
      auth_header: 'x-api-key',
      supports_streaming: true,
      supports_tools: true,
      max_tokens: 8192,
      context_window: 64000,
    },
    kimi: {
      display_name: 'Kimi K2 Thinking',
      provider: 'moonshot',
      model_id: 'kimi-for-coding',
      base_url: 'https://api.kimi.com/coding/',
      api_key_env: 'KIMI_API_KEY',
      auth_header: 'x-api-key',
      supports_streaming: true,
      supports_tools: true,
      max_tokens: 32768,
      context_window: 262144,
    },
    minimax: {
      display_name: 'MiniMax M2',
      provider: 'minimax',
      model_id: 'MiniMax-M2',
      base_url: 'https://api.minimaxi.com/anthropic',
      api_key_env: 'MINIMAX_API_KEY',
      auth_header: 'x-api-key',
      supports_streaming: true,
      supports_tools: true,
      max_tokens: 16384,
      context_window: 128000,
    },
    qwen: {
      display_name: 'Qwen3 Max',
      provider: 'alibaba',
      model_id: 'qwen-plus',
      base_url: 'https://dashscope.aliyuncs.com/apps/anthropic',
      api_key_env: 'QWEN_API_KEY',
      auth_header: 'x-api-key',
      supports_streaming: true,
      supports_tools: true,
      max_tokens: 8192,
      context_window: 131072,
    },
    glm: {
      display_name: 'GLM 4.6',
      provider: 'zhipu',
      model_id: 'GLM-4.6',
      base_url: 'https://api.z.ai/api/anthropic',
      api_key_env: 'GLM_API_KEY',
      auth_header: 'x-api-key',
      supports_streaming: true,
      supports_tools: true,
      max_tokens: 8192,
      context_window: 128000,
    },
  },
  aliases: {
    'deepseek-v3': 'deepseek',
    'deepseek-chat': 'deepseek',
    'ds': 'deepseek',
    'kimi-k2': 'kimi',
    'kimi-k2-thinking': 'kimi',
    'moonshot': 'kimi',
    'minimax-m2': 'minimax',
    'mm': 'minimax',
    'qwen3': 'qwen',
    'qwen3-max': 'qwen',
    'tongyi': 'qwen',
    'glm-4.6': 'glm',
    'zhipu': 'glm',
    'chatglm': 'glm',
  },
  gateway: {
    host: '0.0.0.0',
    port: 8080,
    timeout: 300,
    enable_logging: true,
    log_level: 'INFO',
  },
};

export class ConfigManager {
  private config: RouterConfig;
  private apiKeys: Map<string, string> = new Map();

  constructor(configPath?: string) {
    this.config = this.loadConfig(configPath);
    this.loadApiKeys();
  }

  private loadConfig(configPath?: string): RouterConfig {
    // Try to find config file
    const possiblePaths = [
      configPath,
      path.join(process.cwd(), 'models.yaml'),
      path.join(process.cwd(), 'config', 'models.yaml'),
      path.join(process.cwd(), '.claude-router.yaml'),
    ].filter(Boolean) as string[];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, 'utf-8');
          const parsed = yaml.load(content) as Partial<RouterConfig>;
          return this.mergeConfig(parsed);
        } catch (e) {
          console.warn(`Warning: Failed to parse config file ${p}:`, e);
        }
      }
    }

    // Return default config if no file found
    return DEFAULT_CONFIG;
  }

  private mergeConfig(parsed: Partial<RouterConfig>): RouterConfig {
    return {
      default_model: parsed.default_model ?? DEFAULT_CONFIG.default_model,
      models: { ...DEFAULT_CONFIG.models, ...parsed.models },
      aliases: { ...DEFAULT_CONFIG.aliases, ...parsed.aliases },
      gateway: { ...DEFAULT_CONFIG.gateway, ...parsed.gateway },
    };
  }

  private loadApiKeys(): void {
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
    // Check direct model name
    if (this.config.models[name]) {
      return this.config.models[name];
    }

    // Check aliases
    const aliasTarget = this.config.aliases[name];
    if (aliasTarget && this.config.models[aliasTarget]) {
      return this.config.models[aliasTarget];
    }

    return undefined;
  }

  resolveModelName(name: string): string {
    if (this.config.aliases[name]) {
      return this.config.aliases[name];
    }
    if (this.config.models[name]) {
      return name;
    }
    return name;
  }

  getApiKey(modelName: string): string | undefined {
    const resolved = this.resolveModelName(modelName);
    return this.apiKeys.get(resolved);
  }

  listModels(): Record<string, { displayName: string; provider: string; available: boolean }> {
    const result: Record<string, { displayName: string; provider: string; available: boolean }> = {};

    for (const [name, model] of Object.entries(this.config.models)) {
      result[name] = {
        displayName: model.display_name,
        provider: model.provider,
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

default_model: deepseek

models:
  deepseek:
    display_name: "DeepSeek V3.2"
    provider: deepseek
    model_id: deepseek-chat
    base_url: https://api.deepseek.com/anthropic
    api_key_env: DEEPSEEK_API_KEY
    auth_header: x-api-key
    max_tokens: 8192

  kimi:
    display_name: "Kimi K2 Thinking"
    provider: moonshot
    model_id: kimi-for-coding
    base_url: https://api.kimi.com/coding/
    api_key_env: KIMI_API_KEY
    auth_header: x-api-key
    max_tokens: 32768

  minimax:
    display_name: "MiniMax M2"
    provider: minimax
    model_id: MiniMax-M2
    base_url: https://api.minimaxi.com/anthropic
    api_key_env: MINIMAX_API_KEY
    auth_header: x-api-key
    max_tokens: 16384

  qwen:
    display_name: "Qwen3 Max"
    provider: alibaba
    model_id: qwen-plus
    base_url: https://dashscope.aliyuncs.com/apps/anthropic
    api_key_env: QWEN_API_KEY
    auth_header: x-api-key
    max_tokens: 8192

  glm:
    display_name: "GLM 4.6"
    provider: zhipu
    model_id: GLM-4.6
    base_url: https://api.z.ai/api/anthropic
    api_key_env: GLM_API_KEY
    auth_header: x-api-key
    max_tokens: 8192

aliases:
  ds: deepseek
  mm: minimax

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

# Kimi - https://www.kimi.com/
KIMI_API_KEY=

# MiniMax - https://platform.minimax.io/
MINIMAX_API_KEY=

# Qwen - https://dashscope.console.aliyun.com/
QWEN_API_KEY=

# GLM - https://open.bigmodel.cn/
GLM_API_KEY=
`;
}
