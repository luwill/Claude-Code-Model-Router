/**
 * Guided first-run configuration (`ccmr setup`).
 *
 * The audit's H1 finding: after `ccmr init` the user was left alone with a
 * generated .env of 18 empty variables and vendor console URLs buried in
 * comments. setup closes that gap with one command: it shows which
 * providers already have keys, asks for the missing ones (hidden input),
 * optionally verifies each with the same tiny request `ccmr doctor` uses,
 * writes the .env in place, and lands the user on a keyed default model.
 *
 * Every decision-making piece is a pure, tested seam; only the TTY prompt
 * loop lives outside them. `--yes` runs the whole flow non-interactively
 * from whatever keys the environment already provides (CI-friendly).
 */
import type { ConfigManager } from './config.js';
export interface ProviderStatus {
    /** Config-level key, e.g. 'deepseek' or 'kimi-plan'. */
    providerKey: string;
    displayName: string;
    /** Vendor id, e.g. 'moonshot-code'. */
    providerName: string;
    apiKeyEnv: string;
    consoleUrl?: string;
    /** Canonical model key of the provider's default variant. */
    defaultModel: string;
    hasKey: boolean;
}
export interface SetupPlan {
    providers: ProviderStatus[];
    currentDefault: string;
    currentDefaultProviderKey: string | null;
    /** First keyed provider's default model, or null when nothing is keyed. */
    suggestedDefault: string | null;
}
export interface EnvUpdate {
    name: string;
    value: string;
}
export interface EnvUpdateResult {
    written: EnvUpdate[];
    skipped: EnvUpdate[];
}
export interface ValidationOutcome {
    providerKey: string;
    model: string;
    status: 'ok' | 'fail';
    detail?: string;
}
export interface SetupOutcome {
    ok: boolean;
    reason?: string;
    written?: EnvUpdate[];
    skipped?: EnvUpdate[];
    defaultModel?: string | null;
    validation?: ValidationOutcome[];
    /** True when --validate ran and every provider failed: the CLI turns this into exit 1 (CI gate). */
    allValidationsFailed?: boolean;
}
export type ProviderValidator = (provider: ProviderStatus) => Promise<{
    status: 'ok' | 'fail';
    detail?: string;
}>;
export declare function buildSetupPlan(configManager: ConfigManager): SetupPlan;
/**
 * Rewrite .env content for the given updates: empty `NAME=` slots are
 * filled in place, names with an existing value are never touched, and
 * unknown names are appended. Comments and layout survive.
 */
export declare function planEnvFileUpdates(content: string, updates: EnvUpdate[]): {
    content: string;
    skipped: EnvUpdate[];
};
export declare function applyEnvUpdates(envFile: string, updates: EnvUpdate[]): EnvUpdateResult;
/**
 * The default model after setup: keep the current one when its provider is
 * keyed; otherwise move to the first keyed provider (chosen list first).
 */
export declare function pickDefaultModel(plan: SetupPlan, chosenProviders: string[]): string | null;
export interface NonInteractiveOptions {
    configManager: ConfigManager;
    envFile: string;
    validate: boolean;
    validateProvider?: ProviderValidator;
}
/**
 * CI/script path: take whatever keys the environment and .env already
 * provide, persist environment-only keys into .env, optionally validate
 * each provider, and land on a keyed default model. Never prompts.
 */
export declare function runNonInteractiveSetup(options: NonInteractiveOptions): Promise<SetupOutcome>;
/** Validate one provider through the doctor path (one tiny real request). */
export declare function makeDoctorValidator(configManager: ConfigManager): ProviderValidator;
export interface InteractiveOptions {
    configManager: ConfigManager;
    envFile: string;
}
export declare function runInteractiveSetup(options: InteractiveOptions): Promise<SetupOutcome>;
//# sourceMappingURL=setup.d.ts.map