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

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

/**
 * Rows for the `ccmr models` table. The default model (if given) is marked
 * with a leading `*` and a legend line, so `ccmr use` has a visible effect
 * in the listing itself.
 */
export function renderModelsTable(
  models: Record<string, ModelListEntry>,
  defaultModel?: string
): string[] {
  const entries = Object.entries(models);
  const nameWidth = Math.max(28, ...entries.map(([name]) => name.length + 2));
  const displayWidth = Math.max(
    26,
    ...entries.map(([, info]) => info.displayName.length + 2)
  );
  const providerWidth = Math.max(
    24,
    ...entries.map(([, info]) => {
      const provider = info.variant ? `${info.provider}/${info.variant}` : info.provider;
      return provider.length + 2;
    })
  );

  const lines: string[] = [];
  for (const [name, info] of entries) {
    const marker = name === defaultModel ? '*' : ' ';
    const status = info.available
      ? `${GREEN}[Ready]${RESET}`
      : `${YELLOW}[No API Key]${RESET}`;
    const provider = info.variant ? `${info.provider}/${info.variant}` : info.provider;
    lines.push(
      `${marker} ${name.padEnd(nameWidth)} ${info.displayName.padEnd(displayWidth)} ${provider.padEnd(providerWidth)} ${status}`
    );
  }
  if (defaultModel) {
    lines.push('');
    lines.push(`* ${defaultModel} is the default model (change with: ccmr use <model>)`);
  }
  return lines;
}

/**
 * Rows for the `ccmr stats` table. The header names the gateway port the
 * numbers were read from — with several gateways running, an unlabelled
 * table silently answers for the wrong one.
 */
export function renderUsageTable(usage: UsageReport, gatewayPort: number | string): string[] {
  const lines: string[] = [`Usage since ${usage.since} — gateway on port ${gatewayPort}:`, ''];
  const entries = Object.entries(usage.models);
  if (entries.length === 0) {
    lines.push('  (no requests yet)');
    return lines;
  }

  const nameWidth = Math.max(24, ...entries.map(([name]) => name.length + 2));
  const row = (name: string, m: UsageModelRow): string =>
    `  ${name.padEnd(nameWidth)} ${String(m.requests).padStart(9)} ${String(m.errors).padStart(7)} ${String(m.input_tokens).padStart(12)} ${String(m.output_tokens).padStart(12)}`;

  lines.push(
    `  ${'Model'.padEnd(nameWidth)} ${'Requests'.padStart(9)} ${'Errors'.padStart(7)} ${'Input'.padStart(12)} ${'Output'.padStart(12)}`
  );
  for (const [name, m] of entries) {
    lines.push(row(name, m));
  }
  lines.push(row('TOTAL', usage.totals));
  return lines;
}
