/**
 * Tests for the guided setup (`ccmr setup`): the plan that classifies
 * providers by key presence, the .env writer that fills empty slots in
 * place, default-model selection, and the non-interactive orchestration
 * that CI/scripts use.
 */

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildSetupPlan,
  planEnvFileUpdates,
  applyEnvUpdates,
  pickDefaultModel,
  runNonInteractiveSetup,
} from '../src/setup.js';
import { ConfigManager } from '../src/config.js';

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccmr-setup-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** Blank every provider env var: an explicit empty parent value wins over any .env file. */
function withBlankedProviders<T>(fn: () => T): T {
  const saved: Record<string, string | undefined> = {};
  const allEnvs = [
    ...new Set(
      Object.values(new ConfigManager(null).getConfig().models).map((m) => m.api_key_env)
    ),
  ];
  for (const name of allEnvs) {
    saved[name] = process.env[name];
    process.env[name] = '';
  }
  try {
    return fn();
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

describe('buildSetupPlan', () => {
  it('classifies providers by key presence and suggests a keyed default', () => {
    withBlankedProviders(() => {
      process.env.DEEPSEEK_API_KEY = 'unit-test-fake';
      const plan = buildSetupPlan(new ConfigManager(null));
      const deepseek = plan.providers.find((p) => p.providerKey === 'deepseek');
      const kimi = plan.providers.find((p) => p.providerKey === 'kimi');
      expect(deepseek?.hasKey).toBe(true);
      expect(kimi?.hasKey).toBe(false);
      expect(deepseek?.apiKeyEnv).toBe('DEEPSEEK_API_KEY');
      expect(deepseek?.consoleUrl).toBe('https://platform.deepseek.com/');
      expect(deepseek?.defaultModel).toBe('deepseek-v4-pro');
      expect(plan.suggestedDefault).toBe('deepseek-v4-pro');
    });
  });

  it('suggests nothing when no provider has a key', () => {
    withBlankedProviders(() => {
      const plan = buildSetupPlan(new ConfigManager(null));
      expect(plan.providers.length).toBeGreaterThan(10);
      expect(plan.providers.every((p) => !p.hasKey)).toBe(true);
      expect(plan.suggestedDefault).toBeNull();
    });
  });
});

describe('planEnvFileUpdates', () => {
  const content = '# header\nDEEPSEEK_API_KEY=\n\nKIMI_API_KEY=old-value\n';

  it('fills empty slots in place and keeps notes intact', () => {
    const result = planEnvFileUpdates(content, [
      { name: 'DEEPSEEK_API_KEY', value: 'sk-new' },
    ]);
    expect(result.content).toContain('DEEPSEEK_API_KEY=sk-new');
    expect(result.content).toContain('# header');
    expect(result.content).toContain('KIMI_API_KEY=old-value');
    expect(result.skipped).toEqual([]);
  });

  it('never overwrites a value that is already set', () => {
    const result = planEnvFileUpdates(content, [
      { name: 'KIMI_API_KEY', value: 'sk-other' },
    ]);
    expect(result.content).toContain('KIMI_API_KEY=old-value');
    expect(result.skipped.map((s) => s.name)).toEqual(['KIMI_API_KEY']);
  });

  it('appends names the file does not know', () => {
    const result = planEnvFileUpdates(content, [{ name: 'STEP_API_KEY', value: 'sk-step' }]);
    expect(result.content).toContain('STEP_API_KEY=sk-step');
    expect(result.content.indexOf('DEEPSEEK_API_KEY=')).toBeLessThan(
      result.content.indexOf('STEP_API_KEY=sk-step')
    );
  });

  it('tolerates hand-written spacing instead of growing duplicates (review fix)', () => {
    const spaced = '# notes\nDEEPSEEK_API_KEY = \nKIMI_API_KEY = old\n';
    const filled = planEnvFileUpdates(spaced, [
      { name: 'DEEPSEEK_API_KEY', value: 'sk-new' },
      { name: 'KIMI_API_KEY', value: 'sk-other' },
    ]);
    expect(filled.content).toContain('DEEPSEEK_API_KEY=sk-new');
    expect(filled.content.match(/DEEPSEEK_API_KEY/g)).toHaveLength(1);
    expect(filled.content).toContain('KIMI_API_KEY = old');
    expect(filled.content.match(/KIMI_API_KEY/g)).toHaveLength(1);
    expect(filled.skipped.map((s) => s.name)).toEqual(['KIMI_API_KEY']);
  });
});

describe('applyEnvUpdates', () => {
  it('writes the file once and reports written vs skipped', () => {
    const dir = tempDir();
    const file = path.join(dir, '.env');
    fs.writeFileSync(file, 'DEEPSEEK_API_KEY=\nKIMI_API_KEY=keep\n');
    const result = applyEnvUpdates(file, [
      { name: 'DEEPSEEK_API_KEY', value: 'sk-a' },
      { name: 'KIMI_API_KEY', value: 'sk-b' },
    ]);
    expect(fs.readFileSync(file, 'utf-8')).toBe('DEEPSEEK_API_KEY=sk-a\nKIMI_API_KEY=keep\n');
    expect(result.written.map((w) => w.name)).toEqual(['DEEPSEEK_API_KEY']);
    expect(result.skipped.map((s) => s.name)).toEqual(['KIMI_API_KEY']);
  });
});

describe('pickDefaultModel', () => {
  it('keeps the current default when its provider is keyed', () => {
    const plan = {
      providers: [
        {
          providerKey: 'deepseek',
          displayName: 'DeepSeek',
          providerName: 'deepseek',
          apiKeyEnv: 'DEEPSEEK_API_KEY',
          defaultModel: 'deepseek-v4-pro',
          hasKey: true,
        },
      ],
      currentDefault: 'deepseek-flash',
      currentDefaultProviderKey: 'deepseek',
    };
    expect(pickDefaultModel(plan as never, ['deepseek'])).toBe('deepseek-flash');
  });

  it('switches to the first keyed provider when the default has no key', () => {
    const plan = {
      providers: [
        {
          providerKey: 'deepseek',
          displayName: 'DeepSeek',
          providerName: 'deepseek',
          apiKeyEnv: 'DEEPSEEK_API_KEY',
          defaultModel: 'deepseek-v4-pro',
          hasKey: true,
        },
        {
          providerKey: 'kimi',
          displayName: 'Kimi',
          providerName: 'moonshot',
          apiKeyEnv: 'KIMI_API_KEY',
          defaultModel: 'kimi-k3',
          hasKey: false,
        },
      ],
      currentDefault: 'kimi-k3',
      currentDefaultProviderKey: 'kimi',
    };
    expect(pickDefaultModel(plan as never, [])).toBe('deepseek-v4-pro');
  });
});

describe('runNonInteractiveSetup', () => {
  it('fails with guidance when no key is configured anywhere', async () => {
    await withBlankedProviders(async () => {
      const dir = tempDir();
      const result = await runNonInteractiveSetup({
        configManager: new ConfigManager(null),
        envFile: path.join(dir, '.env'),
        validate: false,
      });
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('setup');
    });
  });

  it('persists env-only keys into .env and sets a keyed default model', async () => {
    await withBlankedProviders(async () => {
      process.env.DEEPSEEK_API_KEY = 'unit-test-fake';
      const dir = tempDir();
      fs.writeFileSync(path.join(dir, 'models.yaml'), 'default_model: kimi-k3\n');
      fs.writeFileSync(path.join(dir, '.env'), 'DEEPSEEK_API_KEY=\n');
      const configManager = new ConfigManager(path.join(dir, 'models.yaml'));
      const result = await runNonInteractiveSetup({
        configManager,
        envFile: path.join(dir, '.env'),
        validate: false,
      });
      expect(result.ok).toBe(true);
      expect(fs.readFileSync(path.join(dir, '.env'), 'utf-8')).toContain(
        'DEEPSEEK_API_KEY=unit-test-fake'
      );
      // kimi-k3 has no key; the default must move to a keyed model.
      expect(fs.readFileSync(path.join(dir, 'models.yaml'), 'utf-8')).toMatch(
        /^default_model: deepseek/m
      );
      expect(result.defaultModel).toMatch(/^deepseek/);
    });
  });

  it('reports validation failures without throwing (validator injected)', async () => {
    await withBlankedProviders(async () => {
      process.env.DEEPSEEK_API_KEY = 'unit-test-fake';
      const dir = tempDir();
      fs.writeFileSync(path.join(dir, 'models.yaml'), 'default_model: deepseek-flash\n');
      fs.writeFileSync(path.join(dir, '.env'), 'DEEPSEEK_API_KEY=\n');
      const configManager = new ConfigManager(path.join(dir, 'models.yaml'));
      const result = await runNonInteractiveSetup({
        configManager,
        envFile: path.join(dir, '.env'),
        validate: true,
        validateProvider: async () => ({ status: 'fail', detail: '401 key rejected' }),
      });
      expect(result.ok).toBe(true); // keys persisted; validation is reported, not fatal
      expect(result.validation?.[0]?.status).toBe('fail');
      expect(result.validation?.[0]?.detail).toContain('401');
    });
  });
});
