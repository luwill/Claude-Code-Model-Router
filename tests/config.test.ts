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

describe('Qwen 3.8 GA: pay-go restored as default, Token Plan on the GA id', () => {
  const manager = new ConfigManager(null);
  const config = manager.getConfig();

  it('restores qwen3.8-max as the pay-as-you-go default', () => {
    // The GA release dropped the -preview suffix AND opened pay-as-you-go
    // access (verified live: dashscope endpoint returns 200 with a pay-go
    // key), so the v1.11.1 removal is reverted: 3.8 is back as the pay-go
    // default and the bare aliases point at it.
    const model = config.models['qwen3.8-max'];
    expect(model).toBeDefined();
    expect(model.model_id).toBe('qwen3.8-max');
    expect(model.api_key_env).toBe('QWEN_API_KEY');
    expect(manager.resolveModelName('qwen')).toBe('qwen3.8-max');
    expect(manager.resolveModelName('tongyi')).toBe('qwen3.8-max');
    expect(manager.resolveModelName('qwen3.8')).toBe('qwen3.8-max');
    expect(manager.resolveModelName('qwen3.8-max')).toBe('qwen3.8-max');
    // 3.7 stays available under its versioned aliases
    expect(config.models['qwen3.7-max'].model_id).toBe('qwen3.7-max');
    expect(manager.resolveModelName('qwen-max')).toBe('qwen3.7-max');
    expect(manager.resolveModelName('qwen3.7')).toBe('qwen3.7-max');
  });

  it('removes the qwen3.5 models and their alias', () => {
    expect(config.models['qwen3.5-plus']).toBeUndefined();
    expect(config.models['qwen3.5-flash']).toBeUndefined();
    // 'qwen3.5' alias is gone -> passes through unchanged (not a real model)
    expect(config.models[manager.resolveModelName('qwen3.5')]).toBeUndefined();
  });

  it('keeps the Token Plan provider on its dedicated endpoint with the GA id', () => {
    // sk-sp- keys from platform.qianwenai.com only work on the dedicated
    // token-plan endpoint (they 403 on the pay-as-you-go dashscope one).
    // The subscription model now uses the GA id too (the old -preview id
    // still answers upstream but is deprecated).
    const model = config.models['qwen-plan-3.8-max'];
    expect(model).toBeDefined();
    expect(model.model_id).toBe('qwen3.8-max');
    expect(model.base_url).toBe(
      'https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic'
    );
    expect(model.api_key_env).toBe('QWEN_PLAN_API_KEY');
    expect(model.auth_type).toBe('api_key');
    expect(manager.resolveModelName('qwen-plan')).toBe('qwen-plan-3.8-max');
    expect(config.models['qwen-plan-3.7-max'].model_id).toBe('qwen3.7-max');
    expect(config.models['qwen-plan-3.7-max'].api_key_env).toBe('QWEN_PLAN_API_KEY');
  });
});

describe('GLM: Coding-Plan-only provider (no domestic pay-go Anthropic channel)', () => {
  const manager = new ConfigManager(null);
  const config = manager.getConfig();

  it('exposes the bigmodel Anthropic endpoint as the glm-plan provider', () => {
    // open.bigmodel.cn/api/anthropic is gated by the GLM Coding Plan
    // subscription: pay-go keys/token packages get 429 [1309] and the
    // coding-plan FAQ states resource packages are unusable there. Zhipu has
    // no pay-as-you-go Anthropic endpoint (only OpenAI /api/paas/v4), so the
    // provider carries the -plan name and its own key env, like
    // kimi-plan/qwen-plan.
    const model = config.models['glm-plan-5.2'];
    expect(model).toBeDefined();
    expect(model.model_id).toBe('glm-5.2');
    expect(model.base_url).toBe('https://open.bigmodel.cn/api/anthropic');
    expect(model.api_key_env).toBe('GLM_PLAN_API_KEY');
    expect(model.auth_type).toBe('api_key');
    expect(manager.resolveModelName('glm-plan')).toBe('glm-plan-5.3');
  });

  it('keeps every legacy glm alias working against the renamed provider', () => {
    // The rename must not break /model glm for existing users.
    expect(config.models['glm-5.2']).toBeUndefined();
    expect(manager.resolveModelName('glm')).toBe('glm-plan-5.3');
    expect(manager.resolveModelName('zhipu')).toBe('glm-plan-5.3');
    expect(manager.resolveModelName('chatglm')).toBe('glm-plan-5.3');
    expect(manager.resolveModelName('glm-5.2')).toBe('glm-plan-5.2');
  });

  it('removes GLM-5.1 everywhere (vendor retired it; 5.2 is the only GLM)', () => {
    // Zhipu retired GLM-5.1: coding-plan calls to it are auto-switched to
    // GLM-5.2 upstream, so carrying the variant only misleads. Removed from
    // both the domestic plan provider and the Z.ai global provider, along
    // with the glm-5 / glm-5.1 aliases (they pass through unresolved).
    expect(config.models['glm-plan-5.1']).toBeUndefined();
    expect(config.models['glm-global-5.1']).toBeUndefined();
    expect(config.models[manager.resolveModelName('glm-5.1')]).toBeUndefined();
    expect(config.models[manager.resolveModelName('glm-5')]).toBeUndefined();
  });

  it('keeps the Z.ai global 5.2 model', () => {
    expect(config.models['glm-global-5.2'].api_key_env).toBe('GLM_GLOBAL_API_KEY');
    expect(config.models['glm-global-5.2'].model_id).toBe('glm-5.2');
  });
});

describe('GLM-5.3: new flagship default on both plan endpoints', () => {
  const manager = new ConfigManager(null);
  const config = manager.getConfig();

  it('adds glm-5.3 as the default Coding Plan variant', () => {
    // docs.bigmodel.cn/cn/guide/models/text/glm-5.3: model id glm-5.3,
    // 1M context, 128K max output, Anthropic endpoint unchanged
    // (open.bigmodel.cn/api/anthropic); Coding Plan carries 5.3 for all
    // subscribers.
    const model = config.models['glm-plan-5.3'];
    expect(model).toBeDefined();
    expect(model.model_id).toBe('glm-5.3');
    expect(model.max_tokens).toBe(131072);
    expect(model.context_window).toBe(1000000);
    expect(model.base_url).toBe('https://open.bigmodel.cn/api/anthropic');
    expect(model.api_key_env).toBe('GLM_PLAN_API_KEY');
    expect(manager.resolveModelName('glm-5.3')).toBe('glm-plan-5.3');
  });

  it('adds glm-5.3 as the default Z.ai global variant', () => {
    // docs.z.ai/guides/llm/glm-5.3: same id and limits on
    // api.z.ai/api/anthropic.
    const model = config.models['glm-global-5.3'];
    expect(model).toBeDefined();
    expect(model.model_id).toBe('glm-5.3');
    expect(model.max_tokens).toBe(131072);
    expect(model.context_window).toBe(1000000);
    expect(manager.resolveModelName('glm-global')).toBe('glm-global-5.3');
    expect(manager.resolveModelName('zai')).toBe('glm-global-5.3');
    expect(manager.resolveModelName('z-ai')).toBe('glm-global-5.3');
  });
});

describe('DeepSeek V4.1 Flash GA: deepseek-flash replaces the whole V4 Flash line', () => {
  const manager = new ConfigManager(null);
  const config = manager.getConfig();

  it('exposes deepseek-flash with the GA model name', () => {
    // Launch post 2026-09-10 ("将模型名称更改为 deepseek-flash 即可调用") +
    // api-docs.deepseek.com/quick_start/pricing: 1M context, 384K max
    // output, natively multimodal. Verified live: text 200 in 0.62s, and a
    // base64 image block is genuinely read (blue test PNG -> "Blue",
    // input_tokens 227).
    const model = config.models['deepseek-flash'];
    expect(model).toBeDefined();
    expect(model.model_id).toBe('deepseek-flash');
    expect(model.max_tokens).toBe(393216);
    expect(model.context_window).toBe(1048576);
    expect(model.base_url).toBe('https://api.deepseek.com/anthropic');
    expect(model.api_key_env).toBe('DEEPSEEK_API_KEY');
  });

  it('retires the V4 Flash, Vision Exp and dated beta model keys', () => {
    // The vendor took V4 Flash and V4 Flash Vision Exp offline; all three
    // retired ids now echo back model "deepseek-flash" upstream, so keeping
    // them as separate model keys would advertise models that no longer
    // exist.
    expect(config.models['deepseek-v4-flash']).toBeUndefined();
    expect(config.models['deepseek-v4-flash-vision-exp']).toBeUndefined();
    expect(config.models['deepseek-v4.1-flash-exp']).toBeUndefined();
  });

  it('keeps the surviving short names pointing at deepseek-flash', () => {
    for (const alias of [
      'deepseek-flash',
      'deepseek-chat',
      'deepseek-vision',
      'ds-vision',
      'deepseek-4.1-flash',
      'deepseek-v4.1-flash',
      'ds-4.1',
    ]) {
      expect(manager.resolveModelName(alias)).toBe('deepseek-flash');
    }
  });

  it('does not alias the retired ids back to deepseek-flash (cycle guard)', () => {
    // Configs generated before 1.18 contain the opposite alias
    // (deepseek-flash -> deepseek-v4-flash) and user configs merge over
    // DEFAULT_CONFIG, so adding the reverse mapping here would create an
    // alias cycle and break every command on upgrade. Observed live.
    expect(DEFAULT_CONFIG.aliases['deepseek-v4-flash']).toBeUndefined();
    expect(DEFAULT_CONFIG.aliases['deepseek-v4-flash-vision-exp']).toBeUndefined();
  });

  it('still loads when merged over a pre-1.18 user config', () => {
    const file = writeTempConfig(`default_model: deepseek-v4-pro
providers:
  deepseek:
    display_name: DeepSeek
    provider: deepseek
    base_url: https://api.deepseek.com/anthropic
    api_key_env: DEEPSEEK_API_KEY
    auth_header: x-api-key
    auth_type: api_key
    default_variant: v4-pro
    variants:
      v4-pro:
        display_name: "DeepSeek V4 Pro"
        model_id: deepseek-v4-pro
        max_tokens: 393216
        context_window: 1048576
      v4-flash:
        display_name: "DeepSeek V4 Flash"
        model_id: deepseek-v4-flash
        max_tokens: 393216
        context_window: 1048576
aliases:
  deepseek-flash: deepseek-v4-flash
  deepseek-chat: deepseek-v4-flash
`);
    const legacy = new ConfigManager(file);
    expect(legacy.resolveModelName('deepseek-flash')).toBe('deepseek-v4-flash');
    expect(legacy.getConfig().models['deepseek-flash']).toBeDefined();
  });

  it('leaves V4 Pro and the bare deepseek alias in place', () => {
    // Launch post: from 2026-09-14 12:00 CST deepseek-v4-pro is routed to
    // V4.1 Flash and billed at its price until V4.1 Pro ships. The id still
    // answers as v4-pro today (verified live), so the entry stays.
    expect(config.models['deepseek-v4-pro'].model_id).toBe('deepseek-v4-pro');
    expect(manager.resolveModelName('deepseek')).toBe('deepseek-v4-pro');
  });

  it('makes deepseek-flash the shipped default model', () => {
    // V4 Pro would otherwise stay the default past 2026-09-14 12:00 CST,
    // when the vendor starts routing it to V4.1 Flash anyway -- that would
    // show "DeepSeek V4 Pro" while actually running V4.1 Flash.
    expect(config.default_model).toBe('deepseek-flash');
    expect(config.models[config.default_model]).toBeDefined();
  });
});

describe('GLM-5.3-Flash: multimodal flash tier on both plan endpoints', () => {
  const manager = new ConfigManager(null);
  const config = manager.getConfig();

  it('adds glm-5.3-flash to the Coding Plan provider without moving the default', () => {
    // docs.bigmodel.cn/cn/guide/models/vlm/glm-5.3-flash: model code
    // glm-5.3-flash, 1M context, 128K max output, text params identical to
    // GLM-5.3; docs.bigmodel.cn/cn/coding-plan/tool/claude configures it on
    // open.bigmodel.cn/api/anthropic (same key/endpoint as glm-5.3).
    const model = config.models['glm-plan-5.3-flash'];
    expect(model).toBeDefined();
    expect(model.model_id).toBe('glm-5.3-flash');
    expect(model.max_tokens).toBe(131072);
    expect(model.context_window).toBe(1000000);
    expect(model.base_url).toBe('https://open.bigmodel.cn/api/anthropic');
    expect(model.api_key_env).toBe('GLM_PLAN_API_KEY');
    expect(manager.resolveModelName('glm-flash')).toBe('glm-plan-5.3-flash');
    expect(manager.resolveModelName('glm-5.3-flash')).toBe('glm-plan-5.3-flash');
    expect(manager.resolveModelName('glm-plan-flash')).toBe('glm-plan-5.3-flash');
    expect(manager.resolveModelName('glm')).toBe('glm-plan-5.3');
  });

  it('adds glm-5.3-flash to the Z.ai global provider without moving the default', () => {
    // docs.z.ai/guides/vlm/glm-5.3-flash + docs.z.ai/devpack/tool/claude:
    // same id and limits on api.z.ai/api/anthropic.
    const model = config.models['glm-global-5.3-flash'];
    expect(model).toBeDefined();
    expect(model.model_id).toBe('glm-5.3-flash');
    expect(model.max_tokens).toBe(131072);
    expect(model.context_window).toBe(1000000);
    expect(model.base_url).toBe('https://api.z.ai/api/anthropic');
    expect(model.api_key_env).toBe('GLM_GLOBAL_API_KEY');
    expect(manager.resolveModelName('glm-global-flash')).toBe('glm-global-5.3-flash');
    expect(manager.resolveModelName('zai-flash')).toBe('glm-global-5.3-flash');
    expect(manager.resolveModelName('glm-global')).toBe('glm-global-5.3');
  });
});

describe('Qwen3.8 Flash: multimodal flash tier on pay-go and Token Plan', () => {
  const manager = new ConfigManager(null);
  const config = manager.getConfig();

  it('adds qwen3.8-flash to the pay-as-you-go provider without moving the default', () => {
    // help.aliyun.com/zh/model-studio/qwen3-8-flash: id qwen3.8-flash,
    // context 1,000,000, max output 131,072; listed as supported by the
    // Bailian Anthropic-compatible Messages API (anthropic-api-messages).
    const model = config.models['qwen3.8-flash'];
    expect(model).toBeDefined();
    expect(model.model_id).toBe('qwen3.8-flash');
    expect(model.max_tokens).toBe(131072);
    expect(model.context_window).toBe(1000000);
    expect(model.base_url).toBe('https://dashscope.aliyuncs.com/apps/anthropic');
    expect(model.api_key_env).toBe('QWEN_API_KEY');
    expect(manager.resolveModelName('qwen-flash')).toBe('qwen3.8-flash');
    expect(manager.resolveModelName('qwen3.8-flash')).toBe('qwen3.8-flash');
    expect(manager.resolveModelName('qwen')).toBe('qwen3.8-max');
  });

  it('adds qwen3.8-flash to the Token Plan provider without moving the default', () => {
    // platform.qianwenai.com latest-model doc: Token Plan credits cover
    // Qwen3.8-Flash on the same subscription endpoint.
    const model = config.models['qwen-plan-3.8-flash'];
    expect(model).toBeDefined();
    expect(model.model_id).toBe('qwen3.8-flash');
    expect(model.max_tokens).toBe(131072);
    expect(model.context_window).toBe(1000000);
    expect(model.base_url).toBe('https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic');
    expect(model.api_key_env).toBe('QWEN_PLAN_API_KEY');
    expect(manager.resolveModelName('qwen-plan-flash')).toBe('qwen-plan-3.8-flash');
    expect(manager.resolveModelName('qwen-plan-3.8-flash')).toBe('qwen-plan-3.8-flash');
    expect(manager.resolveModelName('qwen-plan')).toBe('qwen-plan-3.8-max');
  });

  it('does not expose qwen3.8-flash-next (open weights only, no hosted Anthropic endpoint)', () => {
    // Bailian returns 404 for a qwen3.8-flash-next model page, the Qwen AI
    // platform / QwenCloud / OpenRouter catalogs do not list it, and the HF
    // model card names qwen3.8-flash as the production API built on it.
    expect(config.models['qwen3.8-flash-next']).toBeUndefined();
    expect(manager.resolveModelName('qwen3.8-flash-next')).toBe('qwen3.8-flash-next');
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
