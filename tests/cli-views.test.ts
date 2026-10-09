/**
 * Presentation tests for the CLI views extracted from cli.ts: the
 * `ccmr models` table (default-model marker, honest status text) and the
 * `ccmr stats` usage table (names the gateway it read).
 */

import { describe, it, expect } from 'vitest';
import { renderModelsTable, renderUsageTable, resolveListedDefaultName } from '../src/cli-views.js';
import type { UsageReport } from '../src/cli-views.js';

const stripAnsi = (line: string): string => line.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

describe('renderModelsTable', () => {
  const models = {
    'deepseek-flash': {
      displayName: 'DeepSeek V4.1 Flash',
      provider: 'deepseek',
      variant: 'flash',
      available: true,
    },
    'kimi-k3': {
      displayName: 'Kimi K3',
      provider: 'moonshot',
      variant: 'k3',
      available: false,
    },
  };

  it('marks the default model with a leading * and explains the marker', () => {
    const lines = renderModelsTable(models, 'kimi-k3').map(stripAnsi);
    const kimi = lines.find((l) => l.includes('kimi-k3'));
    const deepseek = lines.find((l) => l.includes('deepseek-flash'));
    expect(kimi).toBeDefined();
    expect(deepseek).toBeDefined();
    expect(kimi!.trimStart().startsWith('*')).toBe(true);
    expect(deepseek!.trimStart().startsWith('*')).toBe(false);
    expect(lines.some((l) => l.includes('default'))).toBe(true);
  });

  it('keeps the status column honest per entry', () => {
    const lines = renderModelsTable(models, undefined).map(stripAnsi);
    expect(lines.find((l) => l.includes('deepseek-flash'))!.includes('[Ready]')).toBe(true);
    expect(lines.find((l) => l.includes('kimi-k3'))!.includes('[No API Key]')).toBe(true);
  });

  it('renders no marker or legend when no default model is given', () => {
    const lines = renderModelsTable(models, undefined).map(stripAnsi);
    expect(lines.some((l) => l.trimStart().startsWith('*'))).toBe(false);
    expect(lines.some((l) => l.includes('default'))).toBe(false);
  });

  it('keeps column alignment between marked and unmarked rows', () => {
    const lines = renderModelsTable(models, 'kimi-k3').map(stripAnsi);
    const kimi = lines.find((l) => l.includes('Kimi K3'))!;
    const deepseek = lines.find((l) => l.includes('DeepSeek V4.1 Flash'))!;
    expect(kimi.indexOf('Kimi K3') - kimi.indexOf('kimi-k3')).toBe(
      deepseek.indexOf('DeepSeek V4.1 Flash') - deepseek.indexOf('deepseek-flash')
    );
  });
});

describe('renderUsageTable', () => {
  const usage: UsageReport = {
    since: '2026-10-09T00:59:31.532Z',
    totals: { requests: 21, errors: 1, input_tokens: 0, output_tokens: 10202 },
    models: {
      'glm-plan-5.3': { requests: 21, errors: 1, input_tokens: 0, output_tokens: 10202 },
    },
  };

  it('names the gateway port it read', () => {
    const lines = renderUsageTable(usage, 8080).map(stripAnsi);
    expect(lines[0]).toContain('port 8080');
    expect(lines[0]).toContain('2026-10-09T00:59:31.532Z');
  });

  it('renders per-model rows and a totals row', () => {
    const lines = renderUsageTable(usage, 9000).map(stripAnsi);
    expect(lines.some((l) => l.includes('glm-plan-5.3') && l.includes('21'))).toBe(true);
    expect(lines.some((l) => l.trim().startsWith('TOTAL') && l.includes('10202'))).toBe(true);
  });

  it('says no requests yet when the report is empty', () => {
    const empty: UsageReport = {
      since: '2026-10-09T00:00:00.000Z',
      totals: { requests: 0, errors: 0, input_tokens: 0, output_tokens: 0 },
      models: {},
    };
    const lines = renderUsageTable(empty, 8081).map(stripAnsi);
    expect(lines.some((l) => l.includes('no requests yet'))).toBe(true);
  });
});

describe('resolveListedDefaultName (review round-1 fix)', () => {
  // Custom provider 'acme': `ccmr use acme` persists the bare provider key,
  // which listModels() skips — the marker must land on the default variant.
  const listed = {
    'acme-pro': {
      displayName: 'Acme Pro',
      provider: 'acme',
      variant: 'pro',
      available: true,
    },
    'acme-lite': {
      displayName: 'Acme Lite',
      provider: 'acme',
      variant: 'lite',
      available: false,
    },
  };
  const modelIdOf = {
    acme: 'acme-pro-model', // shorthand entry config carries
    'acme-pro': 'acme-pro-model',
    'acme-lite': 'acme-lite-model',
  };

  it('maps a bare provider-key default onto the default variant row', () => {
    expect(resolveListedDefaultName(listed, 'acme', modelIdOf)).toBe('acme-pro');
  });

  it('keeps a default that is already listed', () => {
    expect(resolveListedDefaultName(listed, 'acme-lite', modelIdOf)).toBe('acme-lite');
  });

  it('renders a starred row for the shorthand default end-to-end', () => {
    const resolved = resolveListedDefaultName(listed, 'acme', modelIdOf);
    const lines = renderModelsTable(listed, resolved).map(stripAnsi);
    expect(lines.find((l) => l.includes('acme-pro'))!.trimStart().startsWith('*')).toBe(true);
    expect(lines.find((l) => l.includes('default'))!.includes('acme-pro')).toBe(true);
  });
});
