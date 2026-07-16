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
    /** Values this instance injected from .env, used to revoke removed entries. */
    private managedEnvValues;
    constructor(configPath?: string | null);
    private loadConfig;
    private readConfigFile;
    private mergeConfig;
    private mergeProviders;
    private normalizeConfig;
    private buildModelConfig;
    private resolveAlias;
    private isRecord;
    private requireString;
    private validateFallback;
    private validateConfigShape;
    private validatePositiveInteger;
    private requireHttpUrl;
    private applyGatewayEnvOverrides;
    private parsePositiveInteger;
    private parsePositiveNumber;
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
     * Stable, secret-free identity for the config and .env sources used by this
     * process. Detached gateways are shared only when this identity matches the
     * launching CLI, preventing one project from silently using another
     * project's endpoints or credentials.
     */
    getSourceId(): string;
    /** Existing .env sources, ordered from lower to higher precedence. */
    getEnvFilePaths(): string[];
    /** All possible .env sources, including paths that do not exist yet. */
    getEnvCandidatePaths(): string[];
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