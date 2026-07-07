/**
 * Tests for the usage tracker: per-model token/request accounting for both
 * non-streaming (response.usage) and streaming (SSE message_start/delta).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigManager } from '../src/config.js';
import { createServer } from '../src/server.js';
import { UsageTracker } from '../src/usage.js';

const cleanups: Array<() => void> = [];

afterAll(() => {
  delete process.env.USAGE_TEST_KEY;
  for (const cleanup of cleanups.splice(0)) cleanup();
});

describe('UsageTracker unit', () => {
  it('accumulates per-model tokens, requests, and errors', () => {
    const tracker = new UsageTracker();
    tracker.record('m1', { input_tokens: 10, output_tokens: 5 });
    tracker.record('m1', { input_tokens: 20, output_tokens: 15 });
    tracker.record('m2', { input_tokens: 1, output_tokens: 1 });
    tracker.recordError('m1');

    const snap = tracker.snapshot();
    expect(snap.models['m1'].requests).toBe(2);
    expect(snap.models['m1'].errors).toBe(1);
    expect(snap.models['m1'].input_tokens).toBe(30);
    expect(snap.models['m1'].output_tokens).toBe(20);
    expect(snap.totals.requests).toBe(3);
    expect(snap.totals.input_tokens).toBe(31);
    expect(snap.totals.output_tokens).toBe(21);
    expect(snap.since).toBeTruthy();
  });
});

describe('gateway /usage integration', () => {
  let upstreamPort: number;

  beforeAll(async () => {
    process.env.USAGE_TEST_KEY = 'sk-usage';
    const upstream = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const body = JSON.parse(raw) as { stream?: boolean };
        if (body.stream) {
          res.writeHead(200, { 'Content-Type': 'text/event-stream' });
          res.write(
            'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":40,"output_tokens":0}}}\n\n'
          );
          res.write(
            'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}}\n\n'
          );
          res.write(
            'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":9}}\n\n'
          );
          res.end();
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              id: 'msg',
              type: 'message',
              role: 'assistant',
              content: [{ type: 'text', text: 'ok' }],
              model: 'usage-001',
              stop_reason: 'end_turn',
              stop_sequence: null,
              usage: { input_tokens: 100, output_tokens: 50 },
            })
          );
        }
      });
    });
    upstreamPort = await new Promise<number>((resolve) =>
      upstream.listen(0, '127.0.0.1', () => resolve((upstream.address() as AddressInfo).port))
    );
    cleanups.push(() => upstream.close());
  });

  async function startGateway(): Promise<string> {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccmr-usage-'));
    cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
    const file = path.join(dir, 'models.yaml');
    fs.writeFileSync(
      file,
      `
default_model: usage-model-v1
providers:
  usage-model:
    display_name: Usage Model
    provider: custom
    base_url: http://127.0.0.1:${upstreamPort}
    api_key_env: USAGE_TEST_KEY
    default_variant: v1
    variants:
      v1:
        display_name: "Usage Model V1"
        model_id: usage-001
`
    );
    const app = createServer(new ConfigManager(file));
    const server = http.createServer(app);
    const port = await new Promise<number>((resolve) =>
      server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port))
    );
    cleanups.push(() => server.close());
    return `http://127.0.0.1:${port}`;
  }

  it('tracks non-streaming and streaming usage per model', async () => {
    const gateway = await startGateway();

    await fetch(`${gateway}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'usage-model-v1',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    const streamRes = await fetch(`${gateway}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'usage-model-v1',
        max_tokens: 10,
        stream: true,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    await streamRes.text(); // drain the stream

    const usage = (await (await fetch(`${gateway}/usage`)).json()) as {
      models: Record<
        string,
        { requests: number; input_tokens: number; output_tokens: number; errors: number }
      >;
      totals: { requests: number; input_tokens: number; output_tokens: number };
    };

    const m = usage.models['usage-model-v1'];
    expect(m.requests).toBe(2);
    expect(m.input_tokens).toBe(140); // 100 non-stream + 40 stream
    expect(m.output_tokens).toBe(59); // 50 non-stream + 9 stream
    expect(usage.totals.requests).toBe(2);
  });

  it('counts upstream failures as errors', async () => {
    // Upstream that always 500s
    const failing = http.createServer((req, res) => {
      req.resume();
      req.on('end', () => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { type: 'server_error', message: 'boom' } }));
      });
    });
    const failingPort = await new Promise<number>((resolve) =>
      failing.listen(0, '127.0.0.1', () => resolve((failing.address() as AddressInfo).port))
    );
    cleanups.push(() => failing.close());

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccmr-usage-err-'));
    cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
    const file = path.join(dir, 'models.yaml');
    fs.writeFileSync(
      file,
      `
default_model: err-model-v1
providers:
  err-model:
    display_name: Err Model
    provider: custom
    base_url: http://127.0.0.1:${failingPort}
    api_key_env: USAGE_TEST_KEY
    default_variant: v1
    variants:
      v1:
        display_name: "Err Model V1"
        model_id: err-001
`
    );
    const app = createServer(new ConfigManager(file));
    const server = http.createServer(app);
    const port = await new Promise<number>((resolve) =>
      server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port))
    );
    cleanups.push(() => server.close());
    const gateway = `http://127.0.0.1:${port}`;

    const res = await fetch(`${gateway}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'err-model-v1',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    expect(res.status).toBe(500);

    const usage = (await (await fetch(`${gateway}/usage`)).json()) as {
      models: Record<string, { errors: number; requests: number }>;
    };
    expect(usage.models['err-model-v1'].errors).toBe(1);
  });
});
