"use strict";
/**
 * Pure renderers for `ccmr models` and `ccmr stats` output, extracted from
 * cli.ts so the presentation rules — honest availability, the default-model
 * marker, and naming the gateway stats were read from — are testable
 * without spawning the CLI process.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderModelsTable = renderModelsTable;
exports.resolveListedDefaultName = resolveListedDefaultName;
exports.renderUsageTable = renderUsageTable;
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
/**
 * Rows for the `ccmr models` table. The default model (if given) is marked
 * with a leading `*` and a legend line, so `ccmr use` has a visible effect
 * in the listing itself.
 */
function renderModelsTable(models, defaultModel) {
    const entries = Object.entries(models);
    const nameWidth = Math.max(28, ...entries.map(([name]) => name.length + 2));
    const displayWidth = Math.max(26, ...entries.map(([, info]) => info.displayName.length + 2));
    const providerWidth = Math.max(24, ...entries.map(([, info]) => {
        const provider = info.variant ? `${info.provider}/${info.variant}` : info.provider;
        return provider.length + 2;
    }));
    const lines = [];
    for (const [name, info] of entries) {
        const marker = name === defaultModel ? '*' : ' ';
        const status = info.available
            ? `${GREEN}[Ready]${RESET}`
            : `${YELLOW}[No API Key]${RESET}`;
        const provider = info.variant ? `${info.provider}/${info.variant}` : info.provider;
        lines.push(`${marker} ${name.padEnd(nameWidth)} ${info.displayName.padEnd(displayWidth)} ${provider.padEnd(providerWidth)} ${status}`);
    }
    if (defaultModel) {
        lines.push('');
        lines.push(`* ${defaultModel} is the default model (change with: ccmr use <model>)`);
    }
    return lines;
}
/**
 * Map a configured default_model onto a name the table actually lists.
 * `ccmr use <provider-key>` persists the provider's bare key (e.g. 'acme'),
 * but listModels() skips those shorthand rows — without this resolution the
 * legend prints while no row gets the marker.
 *
 * The shorthand entry and its default variant share one ModelConfig object
 * (normalizeConfig assigns the same reference), so identity comparison is
 * exact; model_id strings are only a fallback because they are NOT unique
 * across providers (step and step-plan both route to 'step-5-preview').
 */
function resolveListedDefaultName(listed, defaultModel, configOf, modelIdOf) {
    if (listed[defaultModel])
        return defaultModel;
    const target = configOf[defaultModel];
    if (target !== undefined) {
        for (const name of Object.keys(listed)) {
            if (configOf[name] === target)
                return name;
        }
    }
    const targetId = modelIdOf[defaultModel];
    if (!targetId)
        return undefined;
    for (const name of Object.keys(listed)) {
        if (modelIdOf[name] === targetId)
            return name;
    }
    return undefined;
}
/**
 * Rows for the `ccmr stats` table. The header names the gateway port the
 * numbers were read from — with several gateways running, an unlabelled
 * table silently answers for the wrong one.
 */
function renderUsageTable(usage, gatewayPort) {
    const lines = [`Usage since ${usage.since} — gateway on port ${gatewayPort}:`, ''];
    const entries = Object.entries(usage.models);
    if (entries.length === 0) {
        lines.push('  (no requests yet)');
        return lines;
    }
    const nameWidth = Math.max(24, ...entries.map(([name]) => name.length + 2));
    const row = (name, m) => `  ${name.padEnd(nameWidth)} ${String(m.requests).padStart(9)} ${String(m.errors).padStart(7)} ${String(m.input_tokens).padStart(12)} ${String(m.output_tokens).padStart(12)}`;
    lines.push(`  ${'Model'.padEnd(nameWidth)} ${'Requests'.padStart(9)} ${'Errors'.padStart(7)} ${'Input'.padStart(12)} ${'Output'.padStart(12)}`);
    for (const [name, m] of entries) {
        lines.push(row(name, m));
    }
    lines.push(row('TOTAL', usage.totals));
    return lines;
}
//# sourceMappingURL=cli-views.js.map