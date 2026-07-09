/**
 * Tests for ConfigWatcher.
 *
 * Regression target (v1.8.0 bug): the watcher only observed files that
 * existed when the gateway started. A gateway auto-started before any
 * config existed watched nothing, so a models.yaml/.env created minutes
 * later was never picked up — the gateway served with zero API keys until
 * it was killed by hand.
 */

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigManager } from '../src/config.js';
import { ConfigWatcher, watchCandidates } from '../src/watcher.js';

const cleanups: Array<() => void> = [];

function tempHome(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccmr-watch-'));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** Poll until `predicate` holds, so tests never depend on a fixed sleep. */
async function until(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('condition not met before timeout');
}

const CONFIG_YAML = `
default_model: watch-model-v1
providers:
  watchprov:
    display_name: Watch Provider
    provider: custom
    base_url: https://api.example.com/anthropic
    api_key_env: WATCH_TEST_KEY
    default_variant: v1
    variants:
      v1:
        model_key: watch-model-v1
        display_name: "Watch Model V1"
        model_id: watch-001
`;

afterEach(() => {
  delete process.env.CCMR_HOME;
  delete process.env.WATCH_TEST_KEY;
  for (const cleanup of cleanups.splice(0)) cleanup();
});

describe('watchCandidates', () => {
  it('includes config and env paths that do not exist yet', () => {
    const home = tempHome();
    process.env.CCMR_HOME = home;
    const manager = new ConfigManager('/nonexistent/models.yaml');

    const candidates = watchCandidates(manager, '/some/cwd');

    // The whole point: absent paths are still watched, so later creation is seen
    expect(candidates).toContain(path.join(home, 'models.yaml'));
    expect(candidates).toContain(path.join(home, '.env'));
    expect(candidates).toContain(path.join('/some/cwd', 'models.yaml'));
    expect(candidates).toContain(path.join('/some/cwd', '.env'));
  });

  it('deduplicates the loaded config file against the discovery paths', () => {
    const home = tempHome();
    process.env.CCMR_HOME = home;
    const configPath = path.join(home, 'models.yaml');
    fs.writeFileSync(configPath, CONFIG_YAML);

    const manager = new ConfigManager(configPath);
    const candidates = watchCandidates(manager, '/some/cwd');

    expect(candidates.filter((p) => p === configPath)).toHaveLength(1);
  });
});

describe('ConfigWatcher', () => {
  it('picks up a config file created AFTER the watcher started', async () => {
    const home = tempHome();
    process.env.CCMR_HOME = home;

    // Gateway starts with no config anywhere: built-in defaults
    const manager = new ConfigManager();
    expect(manager.getConfigFilePath()).toBeNull();
    expect(manager.getModel('watch-model-v1')).toBeUndefined();

    let reloads = 0;
    const watcher = new ConfigWatcher(manager, {
      intervalMs: 20,
      cwd: home, // keep the repo's real .env out of this test's candidate list
      onReload: () => {
        reloads++;
      },
    });
    watcher.start();
    cleanups.push(() => watcher.stop());

    fs.writeFileSync(path.join(home, 'models.yaml'), CONFIG_YAML);

    await until(() => reloads > 0);
    expect(manager.getConfigFilePath()).toBe(path.join(home, 'models.yaml'));
    expect(manager.getConfig().default_model).toBe('watch-model-v1');
    expect(manager.getModel('watch-model-v1')?.model_id).toBe('watch-001');
  });

  it('picks up an API key added to a .env created after start', async () => {
    const home = tempHome();
    process.env.CCMR_HOME = home;
    fs.writeFileSync(path.join(home, 'models.yaml'), CONFIG_YAML);

    const manager = new ConfigManager();
    expect(manager.getApiKey('watch-model-v1')).toBeUndefined();

    let reloads = 0;
    const watcher = new ConfigWatcher(manager, {
      intervalMs: 20,
      cwd: home,
      onReload: () => {
        reloads++;
      },
    });
    watcher.start();
    cleanups.push(() => watcher.stop());

    fs.writeFileSync(path.join(home, '.env'), 'WATCH_TEST_KEY=sk-appeared-later\n');

    await until(() => reloads > 0);
    expect(manager.getApiKey('watch-model-v1')).toBe('sk-appeared-later');
  });

  it('reports which path changed and stops cleanly', async () => {
    const home = tempHome();
    process.env.CCMR_HOME = home;
    const manager = new ConfigManager();

    const changedPaths: string[] = [];
    const watcher = new ConfigWatcher(manager, {
      intervalMs: 20,
      cwd: home,
      onReload: (changed) => changedPaths.push(...changed),
    });
    watcher.start();

    fs.writeFileSync(path.join(home, 'models.yaml'), CONFIG_YAML);
    await until(() => changedPaths.length > 0);
    expect(changedPaths[0]).toBe(path.join(home, 'models.yaml'));

    watcher.stop();
    const countAfterStop = changedPaths.length;
    fs.writeFileSync(path.join(home, '.env'), 'WATCH_TEST_KEY=x\n');
    await new Promise((r) => setTimeout(r, 80));
    expect(changedPaths.length).toBe(countAfterStop);
  });
});

describe('ConfigManager readiness reporting', () => {
  it('reports zero ready models when no key is configured', () => {
    const home = tempHome();
    process.env.CCMR_HOME = home;
    fs.writeFileSync(path.join(home, 'models.yaml'), CONFIG_YAML);
    const manager = new ConfigManager(path.join(home, 'models.yaml'));

    const models = manager.listModels();
    expect(models['watch-model-v1'].available).toBe(false);
  });
});
