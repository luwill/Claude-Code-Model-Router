/**
 * Tests for `ccmr doctor` connectivity checks and the init .env guard.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigManager } from '../src/config.js';
import { checkModels } from '../src/doctor.js';
import { ensureEnvIgnored } from '../src/env-guard.js';

const cleanups: Array<() => void> = [];

function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

afterAll(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

describe('checkModels', () => {
  let okUpstream: http.Server;
  let failUpstream: http.Server;
  let okPort: number;
  let failPort: number;

  beforeAll(async () => {
    okUpstream = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          id: 'msg_ok',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'ok' }],
          model: 'm',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        })
      );
    });
    failUpstream = http.createServer((_req, res) => {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ error: { type: 'forbidden', message: 'ModelNotOpen: activate first' } })
      );
    });
    okPort = await new Promise<number>((resolve) =>
      okUpstream.listen(0, '127.0.0.1', () => resolve((okUpstream.address() as AddressInfo).port))
    );
    failPort = await new Promise<number>((resolve) =>
      failUpstream.listen(0, '127.0.0.1', () =>
        resolve((failUpstream.address() as AddressInfo).port)
      )
    );
    cleanups.push(() => okUpstream.close(), () => failUpstream.close());

    process.env.DOCTOR_OK_KEY = 'sk-ok';
    process.env.DOCTOR_FAIL_KEY = 'sk-fail';
    delete process.env.DOCTOR_MISSING_KEY;
    cleanups.push(() => {
      delete process.env.DOCTOR_OK_KEY;
      delete process.env.DOCTOR_FAIL_KEY;
    });
  });

  function doctorConfig(): ConfigManager {
    const dir = tempDir('ccmr-doctor-');
    const file = path.join(dir, 'models.yaml');
    fs.writeFileSync(
      file,
      `
default_model: doc-ok-v1
providers:
  doc-ok:
    display_name: Doctor OK
    provider: custom
    base_url: http://127.0.0.1:${okPort}
    api_key_env: DOCTOR_OK_KEY
    default_variant: v1
    variants:
      v1:
        display_name: "Doctor OK V1"
        model_id: doc-ok-001
  doc-fail:
    display_name: Doctor Fail
    provider: custom
    base_url: http://127.0.0.1:${failPort}
    api_key_env: DOCTOR_FAIL_KEY
    default_variant: v1
    variants:
      v1:
        display_name: "Doctor Fail V1"
        model_id: doc-fail-001
  doc-nokey:
    display_name: Doctor NoKey
    provider: custom
    base_url: http://127.0.0.1:${okPort}
    api_key_env: DOCTOR_MISSING_KEY
    default_variant: v1
    variants:
      v1:
        display_name: "Doctor NoKey V1"
        model_id: doc-nokey-001
`
    );
    return new ConfigManager(file);
  }

  it('reports ok with latency for reachable models', async () => {
    const results = await checkModels(doctorConfig(), { models: ['doc-ok-v1'], timeout: 10 });
    expect(results).toHaveLength(1);
    expect(results[0].model).toBe('doc-ok-v1');
    expect(results[0].status).toBe('ok');
    expect(results[0].latencyMs).toBeGreaterThan(0);
  });

  it('reports fail with the upstream error message', async () => {
    const results = await checkModels(doctorConfig(), { models: ['doc-fail-v1'], timeout: 10 });
    expect(results[0].status).toBe('fail');
    expect(results[0].detail).toContain('ModelNotOpen');
  });

  it('reports skipped with the env var name when the key is missing', async () => {
    const results = await checkModels(doctorConfig(), { models: ['doc-nokey-v1'], timeout: 10 });
    expect(results[0].status).toBe('skipped');
    expect(results[0].detail).toContain('DOCTOR_MISSING_KEY');
  });

  it('checks all non-duplicate models when none are specified', async () => {
    // The repo .env may hold real provider keys (loaded by dotenv at import).
    // Clear every non-test key so this never sends real paid requests.
    const manager = doctorConfig();
    const saved = new Map<string, string | undefined>();
    for (const model of Object.values(manager.getConfig().models)) {
      if (!model.api_key_env.startsWith('DOCTOR_') && !saved.has(model.api_key_env)) {
        saved.set(model.api_key_env, process.env[model.api_key_env]);
        // Keep an explicit empty parent value so constructing another manager
        // cannot reload a real key from the repository .env file.
        process.env[model.api_key_env] = '';
      }
    }

    try {
      const results = await checkModels(doctorConfig(), { timeout: 10 });
      const names = results.map((r) => r.model);
      expect(names).toContain('doc-ok-v1');
      expect(names).toContain('doc-fail-v1');
      expect(names).toContain('doc-nokey-v1');
      // provider-key duplicate entries (doc-ok === doc-ok-v1) are not double-checked
      expect(names).not.toContain('doc-ok');
      // default models without keys are reported as skipped, not silently dropped
      const kimi = results.find((r) => r.model === 'kimi-k2.6');
      expect(kimi?.status).toBe('skipped');
    } finally {
      for (const [key, value] of saved) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it('fails fast with an unknown model name', async () => {
    const results = await checkModels(doctorConfig(), { models: ['ghost'], timeout: 10 });
    expect(results[0].status).toBe('fail');
    expect(results[0].detail).toContain('not found');
  });
});

describe('ensureEnvIgnored', () => {
  it('creates .gitignore with .env inside a git repo', () => {
    const dir = tempDir('ccmr-guard-');
    fs.mkdirSync(path.join(dir, '.git'));

    expect(ensureEnvIgnored(dir)).toBe('added');
    const content = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8');
    expect(content.split('\n')).toContain('.env');
  });

  it('appends .env to an existing .gitignore without clobbering it', () => {
    const dir = tempDir('ccmr-guard-');
    fs.mkdirSync(path.join(dir, '.git'));
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n');

    expect(ensureEnvIgnored(dir)).toBe('added');
    const lines = fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8').split('\n');
    expect(lines).toContain('node_modules/');
    expect(lines).toContain('.env');
  });

  it('reports present when .env is already ignored', () => {
    const dir = tempDir('ccmr-guard-');
    fs.mkdirSync(path.join(dir, '.git'));
    fs.writeFileSync(path.join(dir, '.gitignore'), '.env\nnode_modules/\n');

    expect(ensureEnvIgnored(dir)).toBe('present');
    expect(fs.readFileSync(path.join(dir, '.gitignore'), 'utf-8')).toBe('.env\nnode_modules/\n');
  });

  it('does nothing outside a git repo', () => {
    const dir = tempDir('ccmr-guard-');
    expect(ensureEnvIgnored(dir)).toBe('no-git');
    expect(fs.existsSync(path.join(dir, '.gitignore'))).toBe(false);
  });
});
