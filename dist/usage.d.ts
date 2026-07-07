/**
 * In-memory per-model usage accounting, exposed via GET /usage and
 * `ccmr stats`. Counters reset when the gateway restarts.
 */
export interface TokenUsage {
    input_tokens?: number;
    output_tokens?: number;
}
export interface ModelUsage {
    requests: number;
    errors: number;
    input_tokens: number;
    output_tokens: number;
    last_used: string | null;
}
export interface UsageSnapshot {
    since: string;
    totals: Omit<ModelUsage, 'last_used'>;
    models: Record<string, ModelUsage>;
}
export declare class UsageTracker {
    private readonly since;
    private readonly perModel;
    private entry;
    record(model: string, usage: TokenUsage): void;
    recordError(model: string): void;
    snapshot(): UsageSnapshot;
}
//# sourceMappingURL=usage.d.ts.map