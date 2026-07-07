"use strict";
/**
 * In-memory per-model usage accounting, exposed via GET /usage and
 * `ccmr stats`. Counters reset when the gateway restarts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageTracker = void 0;
function emptyUsage() {
    return { requests: 0, errors: 0, input_tokens: 0, output_tokens: 0, last_used: null };
}
class UsageTracker {
    since = new Date().toISOString();
    perModel = new Map();
    entry(model) {
        let entry = this.perModel.get(model);
        if (!entry) {
            entry = emptyUsage();
            this.perModel.set(model, entry);
        }
        return entry;
    }
    record(model, usage) {
        const entry = this.entry(model);
        entry.requests += 1;
        entry.input_tokens += usage.input_tokens ?? 0;
        entry.output_tokens += usage.output_tokens ?? 0;
        entry.last_used = new Date().toISOString();
    }
    recordError(model) {
        const entry = this.entry(model);
        entry.errors += 1;
        entry.last_used = new Date().toISOString();
    }
    snapshot() {
        const models = {};
        const totals = { requests: 0, errors: 0, input_tokens: 0, output_tokens: 0 };
        for (const [model, entry] of this.perModel) {
            models[model] = { ...entry };
            totals.requests += entry.requests;
            totals.errors += entry.errors;
            totals.input_tokens += entry.input_tokens;
            totals.output_tokens += entry.output_tokens;
        }
        return { since: this.since, totals, models };
    }
}
exports.UsageTracker = UsageTracker;
//# sourceMappingURL=usage.js.map