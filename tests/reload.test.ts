/**
 * Tests for config reload, global (~/.ccmr) config discovery via CCMR_HOME,
 * default_model persistence, and per-request config reads in the server.
 */

import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigManager } from '../src/config.js';
import { createServer } from '../src/server.js';
import { updateDefaultModelInYaml } from '../src/default-model.js';

const cleanups: Array<() => void> = [];

function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

afterEach(() => {
  delete process.env.CCMR_HOME;
  delete process.env.RELOAD_TEST_KEY;
  for (const cleanup of cleanups.splice(0)) cleanup();
});

const CONFIG_V1 = `
default_model: kimi-k2.6
`;

const CONFIG_V2 = `
default_model: reload-model-v2
providers:
  reloadprov:
    display_name: Reload Provider
    provider: custom
    base_url: https://api.example.com/anthropic
    api_key_env: RELOAD_TEST_KEY
    default_variant: v2
    variants:
      v2:
        model_key: reload-model-v2
        display_name: "Reload Model V2"
        model_id: reload-002
`;

describe('ConfigManager.reload', () => {
  it('re-reads the config file it originally loaded', () => {
    const dir = tempDir('ccmr-reload-');
    const file = path.join(dir, 'models.yaml');
    fs.writeFileSync(file, CONFIG_V1);

    const manager = new ConfigManager(file);
    expect(manager.getConfig().default_model).toBe('kimi-k2.6');
    expect(manager.getConfigFilePath()).toBe(file);

    fs.writeFileSync(file, CONFIG_V2);
    manager.reload();

    expect(manager.getConfig().default_model).toBe('reload-model-v2');
    expect(manager.getModel('reload-model-v2')?.model_id).toBe('reload-002');
  });

  it('picks up API keys that appear after construction', () => {
    const dir = tempDir('ccmr-reload-');
    const file = path.join(dir, 'models.yaml');
    fs.writeFileSync(file, CONFIG_V2);

    const manager = new ConfigManager(file);
    expect(manager.getApiKey('reload-model-v2')).toBeUndefined();

    process.env.RELOAD_TEST_KEY = 'sk-appeared-later';
    manager.reload();
    expect(manager.getApiKey('reload-model-v2')).toBe('sk-appeared-later');
  });

  it('revokes an API key removed from a managed .env file', () => {
    const home = tempDir('ccmr-home-');
    const configFile = path.join(home, 'models.yaml');
    const envFile = path.join(home, '.env');
    fs.writeFileSync(configFile, CONFIG_V2);
    fs.writeFileSync(envFile, 'RELOAD_TEST_KEY=sk-temporary\n');
    process.env.CCMR_HOME = home;

    const manager = new ConfigManager(configFile);
    expect(manager.getApiKey('reload-model-v2')).toBe('sk-temporary');

    fs.writeFileSync(envFile, '');
    manager.reload();

    expect(manager.getApiKey('reload-model-v2')).toBeUndefined();
    expect(process.env.RELOAD_TEST_KEY).toBeUndefined();
  });

  it('loads an .env next to an explicit config outside cwd', () => {
    const dir = tempDir('ccmr-explicit-');
    const file = path.join(dir, 'models.yaml');
    fs.writeFileSync(file, CONFIG_V2);
    fs.writeFileSync(path.join(dir, '.env'), 'RELOAD_TEST_KEY=sk-adjacent\n');

    const manager = new ConfigManager(file);
    expect(manager.getApiKey('reload-model-v2')).toBe('sk-adjacent');
    expect(manager.getEnvFilePaths()).toContain(path.join(dir, '.env'));
  });

  it('keeps the previous config when the file becomes unparseable', () => {
    const dir = tempDir('ccmr-reload-');
    const file = path.join(dir, 'models.yaml');
    fs.writeFileSync(file, CONFIG_V2);

    const manager = new ConfigManager(file);
    fs.writeFileSync(file, 'default_model: [unclosed');
    manager.reload();

    // Malformed file must not wipe a working gateway config
    expect(manager.getConfig().default_model).toBe('reload-model-v2');
  });
});

describe('global config discovery (CCMR_HOME)', () => {
  it('falls back to $CCMR_HOME/models.yaml when cwd has no config', () => {
    const home = tempDir('ccmr-home-');
    fs.writeFileSync(path.join(home, 'models.yaml'), CONFIG_V2);
    process.env.CCMR_HOME = home;

    // No explicit path and no models.yaml in cwd during tests
    const manager = new ConfigManager();
    expect(manager.getConfig().default_model).toBe('reload-model-v2');
    expect(manager.getConfigFilePath()).toBe(path.join(home, 'models.yaml'));
  });

  it('explicit config path wins over the global fallback', () => {
    const home = tempDir('ccmr-home-');
    fs.writeFileSync(path.join(home, 'models.yaml'), CONFIG_V2);
    process.env.CCMR_HOME = home;

    const dir = tempDir('ccmr-local-');
    const file = path.join(dir, 'models.yaml');
    fs.writeFileSync(file, CONFIG_V1);

    const manager = new ConfigManager(file);
    expect(manager.getConfig().default_model).toBe('kimi-k2.6');
  });
});

describe('updateDefaultModelInYaml', () => {
  it('replaces an existing default_model line and preserves comments', () => {
    const input = '# my config\ndefault_model: old-model # inline note\nproviders: {}\n';
    const output = updateDefaultModelInYaml(input, 'new-model');
    expect(output).toContain('default_model: new-model');
    expect(output).toContain('# my config');
    expect(output).toContain('providers: {}');
    expect(output).not.toContain('old-model');
  });

  it('prepends default_model when the file has none', () => {
    const input = '# comments only\nproviders: {}\n';
    const output = updateDefaultModelInYaml(input, 'new-model');
    expect(output.startsWith('default_model: new-model\n')).toBe(true);
    expect(output).toContain('# comments only');
  });

  it('is idempotent', () => {
    const once = updateDefaultModelInYaml('default_model: a\n', 'b');
    expect(updateDefaultModelInYaml(once, 'b')).toBe(once);
  });
});

describe('server reads config per request (hot-reload visibility)', () => {
  it('reflects a reloaded default_model without recreating the app', async () => {
    const dir = tempDir('ccmr-server-reload-');
    const file = path.join(dir, 'models.yaml');
    fs.writeFileSync(file, CONFIG_V1);

    const manager = new ConfigManager(file);
    const app = createServer(manager);
    const server = http.createServer(app);
    const port = await new Promise<number>((resolve) =>
      server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port))
    );
    cleanups.push(() => server.close());

    const before = (await (await fetch(`http://127.0.0.1:${port}/health`)).json()) as {
      default_model: string;
    };
    expect(before.default_model).toBe('kimi-k2.6');

    fs.writeFileSync(file, CONFIG_V2);
    manager.reload();

    const after = (await (await fetch(`http://127.0.0.1:${port}/health`)).json()) as {
      default_model: string;
      models: Record<string, string>;
    };
    expect(after.default_model).toBe('reload-model-v2');
    expect(after.models['reload-model-v2']).toBeDefined();
  });
});
