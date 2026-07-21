/**
 * Baseline tests for ConfigManager: provider expansion, aliases, merging,
 * API key discovery, and DEFAULT_CONFIG <-> YAML template consistency.
 */

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { ConfigManager, DEFAULT_CONFIG, generateConfigFile } from '../src/config.js';
import type { ProviderConfig } from '../src/types.js';

const tempFiles: string[] = [];

function writeTempConfig(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccmr-test-'));
  const file = path.join(dir, 'models.yaml');
  fs.writeFileSync(file, content);
  tempFiles.push(dir);
  return file;
}

afterEach(() => {
  for (const dir of tempFiles.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('ConfigManager: provider -> model expansion', () => {
  const manager = new ConfigManager(null);
  const config = manager.getConfig();

  it('expands provider variants into <provider>-<variant> model keys', () => {
    expect(config.models['kimi-k2.6']).toBeDefined();
    expect(config.models['kimi-k2.6'].model_id).toBe('kimi-k2.6');
    expect(config.models['seed-2.1-pro']).toBeDefined();
    expect(config.models['seed-2.1-pro'].model_id).toBe('doubao-seed-2-1-pro-260628');
  });

  it('respects explicit model_key overrides', () => {
    // qwen 3.7-max declares model_key: qwen3.7-max instead of qwen-3.7-max
    expect(config.models['qwen3.7-max']).toBeDefined();
    expect(config.models['qwen-3.7-max']).toBeUndefined();
  });

  it('creates a provider-key entry pointing at the default variant', () => {
    expect(config.models['kimi']).toBeDefined();
    expect(config.models['kimi'].model_id).toBe(config.models['kimi-k2.6'].model_id);
    expect(config.models['seed'].model_id).toBe('doubao-seed-2-1-pro-260628');
  });

  it('inherits provider-level connection settings into each model', () => {
    const model = config.models['seed-2.1-pro'];
    expect(model.base_url).toBe('https://ark.cn-beijing.volces.com/api/compatible');
    expect(model.api_key_env).toBe('ARK_API_KEY');
    expect(model.auth_type).toBe('bearer');
  });
});

describe('ConfigManager: alias resolution', () => {
  const manager = new ConfigManager(null);

  it('resolves aliases to model keys', () => {
    expect(manager.resolveModelName('seed')).toBe('seed-2.1-pro');
    expect(manager.resolveModelName('doubao')).toBe('seed-2.1-pro');
    expect(manager.resolveModelName('kimi-code')).toBe('kimi-k2.7-code');
  });

  it('passes through unknown names unchanged', () => {
    expect(manager.resolveModelName('no-such-model')).toBe('no-such-model');
  });

  it('getModel works through aliases', () => {
    expect(manager.getModel('doubao')?.model_id).toBe('doubao-seed-2-1-pro-260628');
  });
});

describe('Kimi K3: international variant and CN-platform provider', () => {
  const manager = new ConfigManager(null);
  const config = manager.getConfig();

  it('exposes kimi-k3 on the international provider with 1M context and output', () => {
    const model = config.models['kimi-k3'];
    expect(model).toBeDefined();
    expect(model.model_id).toBe('kimi-k3');
    expect(model.base_url).toBe('https://api.moonshot.ai/anthropic');
    expect(model.api_key_env).toBe('KIMI_API_KEY');
    expect(model.max_tokens).toBe(1048576);
    expect(model.context_window).toBe(1048576);
    expect(manager.resolveModelName('k3')).toBe('kimi-k3');
  });

  it('exposes the CN open platform as its own provider with its own key', () => {
    // platform.kimi.com (原 platform.moonshot.cn) keys do not work on the
    // international platform, so the CN endpoint is a separate provider.
    const model = config.models['kimi-cn-k3'];
    expect(model).toBeDefined();
    expect(model.model_id).toBe('kimi-k3');
    expect(model.base_url).toBe('https://api.moonshot.cn/anthropic');
    expect(model.api_key_env).toBe('KIMI_CN_API_KEY');
    expect(model.max_tokens).toBe(1048576);
    expect(model.context_window).toBe(1048576);
    expect(manager.resolveModelName('kimi-cn')).toBe('kimi-cn-k3');
    expect(manager.resolveModelName('k3-cn')).toBe('kimi-cn-k3');
  });

  it('mirrors the K2 series on the CN provider', () => {
    for (const key of ['kimi-cn-k2.6', 'kimi-cn-k2.7-code', 'kimi-cn-k2.7-code-highspeed']) {
      expect(config.models[key], key).toBeDefined();
      expect(config.models[key].api_key_env, key).toBe('KIMI_CN_API_KEY');
      expect(config.models[key].base_url, key).toBe('https://api.moonshot.cn/anthropic');
    }
  });
});

describe('Kimi Code: coding-plan subscription provider', () => {
  const manager = new ConfigManager(null);
  const config = manager.getConfig();

  it('exposes the coding-plan endpoint as its own provider and key', () => {
    // Keys come from the kimi.com member console and only work on
    // api.kimi.com/coding - a third platform besides moonshot.cn/.ai.
    const model = config.models['kimi-plan-k3-1m'];
    expect(model).toBeDefined();
    // Upstream Model ID is plain 'k3'; 'k3[1m]' is a Claude-Code-only env-var
    // string the API rejects with 401. 1M context is carried by context_window.
    expect(model.model_id).toBe('k3');
    expect(model.base_url).toBe('https://api.kimi.com/coding');
    expect(model.api_key_env).toBe('KIMI_CODE_API_KEY');
    expect(model.auth_type).toBe('api_key');
    expect(model.context_window).toBe(1048576);
    // k3-1m and k3 hit the same upstream model, differing only by context window
    expect(config.models['kimi-plan-k3'].model_id).toBe('k3');
    expect(config.models['kimi-plan-k3'].context_window).toBe(262144);
    expect(manager.resolveModelName('kimi-plan')).toBe('kimi-plan-k3-1m');
  });

  it('carries the tier-gated variants with the plan model ids', () => {
    expect(config.models['kimi-plan-k3'].model_id).toBe('k3');
    expect(config.models['kimi-plan-k3'].context_window).toBe(262144);
    expect(config.models['kimi-plan-for-coding'].model_id).toBe('kimi-for-coding');
    expect(config.models['kimi-plan-for-coding-highspeed'].model_id).toBe(
      'kimi-for-coding-highspeed'
    );
    expect(manager.resolveModelName('kimi-for-coding')).toBe('kimi-plan-for-coding');
  });

  it('keeps the legacy kimi-code aliases on the international K2.7 models', () => {
    // 'kimi-code' has meant the international K2.7 Code since v1.7.1 -
    // the subscription provider must not silently repurpose it.
    expect(manager.resolveModelName('kimi-code')).toBe('kimi-k2.7-code');
    expect(manager.resolveModelName('kimi-code-highspeed')).toBe('kimi-k2.7-code-highspeed');
  });
});

describe('Qwen 3.8: Token-Plan-only, 3.5 removal, pay-go stays on 3.7', () => {
  const manager = new ConfigManager(null);
  const config = manager.getConfig();

  it('keeps the pay-as-you-go qwen provider on 3.7-max (3.8 is not pay-go)', () => {
    // qwen3.8-max-preview returns 403 on pay-as-you-go keys (Token-Plan-only),
    // so it must NOT be a pay-go model; the bare qwen alias stays on 3.7.
    expect(config.models['qwen3.8-max']).toBeUndefined();
    const model = config.models['qwen3.7-max'];
    expect(model).toBeDefined();
    expect(model.model_id).toBe('qwen3.7-max');
    expect(model.api_key_env).toBe('QWEN_API_KEY');
    expect(manager.resolveModelName('qwen')).toBe('qwen3.7-max');
    expect(manager.resolveModelName('tongyi')).toBe('qwen3.7-max');
    expect(manager.resolveModelName('qwen-max')).toBe('qwen3.7-max');
  });

  it('removes the qwen3.5 models and their alias', () => {
    expect(config.models['qwen3.5-plus']).toBeUndefined();
    expect(config.models['qwen3.5-flash']).toBeUndefined();
    // 'qwen3.5' alias is gone -> passes through unchanged (not a real model)
    expect(config.models[manager.resolveModelName('qwen3.5')]).toBeUndefined();
  });

  it('serves qwen3.8-max-preview only through the Token Plan provider', () => {
    // sk-sp- keys from platform.qianwenai.com hit the same DashScope Anthropic
    // endpoint but bill against the subscription -> a separate provider/key,
    // and the only place the preview model actually resolves.
    const model = config.models['qwen-plan-3.8-max'];
    expect(model).toBeDefined();
    expect(model.model_id).toBe('qwen3.8-max-preview');
    expect(model.base_url).toBe('https://dashscope.aliyuncs.com/apps/anthropic');
    expect(model.api_key_env).toBe('QWEN_PLAN_API_KEY');
    expect(model.auth_type).toBe('api_key');
    expect(manager.resolveModelName('qwen-plan')).toBe('qwen-plan-3.8-max');
    // the intuitive 3.8 names route to the subscription model (its only home)
    expect(manager.resolveModelName('qwen3.8')).toBe('qwen-plan-3.8-max');
    expect(manager.resolveModelName('qwen3.8-max')).toBe('qwen-plan-3.8-max');
    expect(config.models['qwen-plan-3.7-max'].model_id).toBe('qwen3.7-max');
    expect(config.models['qwen-plan-3.7-max'].api_key_env).toBe('QWEN_PLAN_API_KEY');
  });
});

describe('ConfigManager: user config merging', () => {
  it('fails closed when an explicit config path does not exist', () => {
    expect(() => new ConfigManager('/definitely-missing/ccmr-models.yaml')).toThrow(
      'Config file not found'
    );
  });

  it('user file overrides default_model and adds providers', () => {
    const file = writeTempConfig(`
default_model: my-model-v1
providers:
  myprov:
    display_name: My Provider
    provider: custom
    base_url: https://api.example.com/anthropic
    api_key_env: MY_KEY
    default_variant: v1
    variants:
      v1:
        model_key: my-model-v1
        display_name: "My Model V1"
        model_id: my-model-001
        max_tokens: 4096
        context_window: 128000
`);
    const manager = new ConfigManager(file);
    const config = manager.getConfig();

    expect(config.default_model).toBe('my-model-v1');
    expect(config.models['my-model-v1'].model_id).toBe('my-model-001');
    // Defaults are preserved alongside user additions
    expect(config.models['kimi-k2.6']).toBeDefined();
  });

  it('user file can override a single variant field without losing siblings', () => {
    const file = writeTempConfig(`
providers:
  kimi:
    provider: moonshot
    base_url: https://api.moonshot.ai/anthropic
    api_key_env: KIMI_API_KEY
    variants:
      k2.6:
        display_name: "Kimi K2.6 (patched)"
        model_id: kimi-k2.6-patched
`);
    const manager = new ConfigManager(file);
    const config = manager.getConfig();

    expect(config.models['kimi-k2.6'].model_id).toBe('kimi-k2.6-patched');
    // Sibling variants from defaults survive the merge
    expect(config.models['kimi-k2.7-code']).toBeDefined();
  });

  it('rejects invalid gateway values before the server starts', () => {
    const file = writeTempConfig('gateway:\n  port: 70000\n');
    expect(() => new ConfigManager(file)).toThrow('gateway.port');
  });

  it('supports chained aliases and rejects alias cycles', () => {
    const chained = writeTempConfig('aliases:\n  fast: kimi\n');
    expect(new ConfigManager(chained).resolveModelName('fast')).toBe('kimi-k2.6');

    const cyclic = writeTempConfig('aliases:\n  cycle-a: cycle-b\n  cycle-b: cycle-a\n');
    expect(() => new ConfigManager(cyclic)).toThrow('Alias cycle');
  });
});

describe('ConfigManager: API key discovery', () => {
  afterEach(() => {
    delete process.env.KIMI_API_KEY;
  });

  it('marks models available when their env var is set', () => {
    process.env.KIMI_API_KEY = 'test-key-123';
    const manager = new ConfigManager(null);
    expect(manager.getApiKey('kimi-k2.6')).toBe('test-key-123');
    expect(manager.getApiKey('kimi-code')).toBe('test-key-123'); // via alias
  });

  it('returns undefined when the env var is missing', () => {
    // An explicit empty parent value must win over any project .env value.
    process.env.KIMI_API_KEY = '';
    const manager = new ConfigManager(null);
    expect(manager.getApiKey('kimi-k2.6')).toBeUndefined();
  });
});

describe('DEFAULT_CONFIG <-> generateConfigFile() template consistency', () => {
  const parsed = yaml.load(generateConfigFile()) as {
    default_model: string;
    providers: Record<string, ProviderConfig>;
    aliases: Record<string, string>;
  };

  it('default_model matches', () => {
    expect(parsed.default_model).toBe(DEFAULT_CONFIG.default_model);
  });

  it('provider sets are identical', () => {
    expect(Object.keys(parsed.providers).sort()).toEqual(
      Object.keys(DEFAULT_CONFIG.providers ?? {}).sort()
    );
  });

  it('every provider matches on connection settings and variants', () => {
    for (const [key, defProvider] of Object.entries(DEFAULT_CONFIG.providers ?? {})) {
      const tplProvider = parsed.providers[key];
      expect(tplProvider, `provider ${key} missing from template`).toBeDefined();
      expect(tplProvider.base_url, `${key}.base_url`).toBe(defProvider.base_url);
      expect(tplProvider.api_key_env, `${key}.api_key_env`).toBe(defProvider.api_key_env);
      expect(tplProvider.default_variant, `${key}.default_variant`).toBe(
        defProvider.default_variant
      );

      expect(
        Object.keys(tplProvider.variants).sort(),
        `${key} variant set`
      ).toEqual(Object.keys(defProvider.variants).sort());

      for (const [vKey, defVariant] of Object.entries(defProvider.variants)) {
        const tplVariant = tplProvider.variants[vKey];
        expect(tplVariant.model_id, `${key}.${vKey}.model_id`).toBe(defVariant.model_id);
        expect(tplVariant.model_key, `${key}.${vKey}.model_key`).toBe(defVariant.model_key);
        expect(tplVariant.max_tokens, `${key}.${vKey}.max_tokens`).toBe(defVariant.max_tokens);
        expect(tplVariant.context_window, `${key}.${vKey}.context_window`).toBe(
          defVariant.context_window
        );
      }
    }
  });

  it('alias tables are identical', () => {
    expect(parsed.aliases).toEqual(DEFAULT_CONFIG.aliases);
  });
});
