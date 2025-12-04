/**
 * Configuration management for Claude Code Model Router
 */
import type { RouterConfig, ModelConfig } from './types.js';
export declare class ConfigManager {
    private config;
    private apiKeys;
    constructor(configPath?: string);
    private loadConfig;
    private mergeConfig;
    private loadApiKeys;
    getConfig(): RouterConfig;
    getModel(name: string): ModelConfig | undefined;
    resolveModelName(name: string): string;
    getApiKey(modelName: string): string | undefined;
    listModels(): Record<string, {
        displayName: string;
        provider: string;
        available: boolean;
    }>;
}
export declare function generateConfigFile(): string;
export declare function generateEnvFile(): string;
//# sourceMappingURL=config.d.ts.map