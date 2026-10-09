/**
 * Pure renderers for `ccmr models` and `ccmr stats` output, extracted from
 * cli.ts so the presentation rules — honest availability, the default-model
 * marker, and naming the gateway stats were read from — are testable
 * without spawning the CLI process.
 */
export interface ModelListEntry {
    displayName: string;
    provider: string;
    variant?: string;
    available: boolean;
}
export interface UsageModelRow {
    requests: number;
    errors: number;
    input_tokens: number;
    output_tokens: number;
}
export interface UsageReport {
    since: string;
    totals: UsageModelRow;
    models: Record<string, UsageModelRow>;
}
/**
 * Rows for the `ccmr models` table. The default model (if given) is marked
 * with a leading `*` and a legend line, so `ccmr use` has a visible effect
 * in the listing itself.
 */
export declare function renderModelsTable(models: Record<string, ModelListEntry>, defaultModel?: string): string[];
/**
 * Map a configured default_model onto a name the table actually lists.
 * `ccmr use <provider-key>` persists the provider's bare key (e.g. 'acme'),
 * but listModels() skips those shorthand rows — without this resolution the
 * legend prints while no row gets the marker.
 */
export declare function resolveListedDefaultName(listed: Record<string, ModelListEntry>, defaultModel: string, modelIdOf: Record<string, string>): string | undefined;
/**
 * Rows for the `ccmr stats` table. The header names the gateway port the
 * numbers were read from — with several gateways running, an unlabelled
 * table silently answers for the wrong one.
 */
export declare function renderUsageTable(usage: UsageReport, gatewayPort: number | string): string[];
//# sourceMappingURL=cli-views.d.ts.map