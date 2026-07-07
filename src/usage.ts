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

function emptyUsage(): ModelUsage {
  return { requests: 0, errors: 0, input_tokens: 0, output_tokens: 0, last_used: null };
}

export class UsageTracker {
  private readonly since = new Date().toISOString();
  private readonly perModel = new Map<string, ModelUsage>();

  private entry(model: string): ModelUsage {
    let entry = this.perModel.get(model);
    if (!entry) {
      entry = emptyUsage();
      this.perModel.set(model, entry);
    }
    return entry;
  }

  record(model: string, usage: TokenUsage): void {
    const entry = this.entry(model);
    entry.requests += 1;
    entry.input_tokens += usage.input_tokens ?? 0;
    entry.output_tokens += usage.output_tokens ?? 0;
    entry.last_used = new Date().toISOString();
  }

  recordError(model: string): void {
    const entry = this.entry(model);
    entry.errors += 1;
    entry.last_used = new Date().toISOString();
  }

  snapshot(): UsageSnapshot {
    const models: Record<string, ModelUsage> = {};
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
