/**
 * Configuration management for Claude Code Model Router
 */
import type { ModelConfig, RouterConfig } from './types.js';
export declare const DEFAULT_CONFIG: RouterConfig;
export declare class ConfigManager {
    private config;
    private apiKeys;
    private requestedConfigPath?;
    private configFilePath;
    constructor(configPath?: string);
    private loadConfig;
    private mergeConfig;
    private mergeProviders;
    private normalizeConfig;
    private buildModelConfig;
    private resolveAlias;
    private loadApiKeys;
    getConfig(): RouterConfig;
    getModel(name: string): ModelConfig | undefined;
    resolveModelName(name: string): string;
    getApiKey(modelName: string): string | undefined;
    /**
     * Re-read API keys from process.env. Call after process.env mutations
     * (e.g. when a host process loads keys from a secret store at runtime).
     */
    reloadApiKeys(): void;
    /** Path of the config file that was actually loaded (null = built-in defaults). */
    getConfigFilePath(): string | null;
    /**
     * Hot-reload: re-apply .env files and re-read the loaded config file.
     * A file that no longer parses keeps the previous working config
     * instead of silently degrading to defaults.
     */
    reload(): void;
    /**
     * Re-read .env files so edited keys take effect on reload. Applied
     * global-first so ./.env keeps precedence over ~/.ccmr/.env.
     */
    private applyEnvFiles;
    listModels(): Record<string, {
        displayName: string;
        provider: string;
        variant?: string;
        available: boolean;
    }>;
}
export declare function generateConfigFile(): string;
export declare function generateEnvFile(): string;
//# sourceMappingURL=config.d.ts.map