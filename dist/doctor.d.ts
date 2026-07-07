/**
 * Connectivity self-check for configured models (`ccmr doctor`).
 *
 * Sends a minimal real request through the exact same routing path the
 * gateway uses, so endpoint mistakes, auth problems, and account-side
 * blockers (e.g. Volcengine ModelNotOpen) surface at configuration time
 * instead of mid-session.
 */
import type { ConfigManager } from './config.js';
export interface DoctorOptions {
    /** Specific model names/aliases to check; defaults to every configured model. */
    models?: string[];
    /** Per-check timeout in seconds (default 30). */
    timeout?: number;
}
export interface DoctorResult {
    model: string;
    displayName: string;
    provider: string;
    status: 'ok' | 'fail' | 'skipped';
    latencyMs?: number;
    detail?: string;
}
export declare function checkModels(configManager: ConfigManager, options?: DoctorOptions): Promise<DoctorResult[]>;
//# sourceMappingURL=doctor.d.ts.map