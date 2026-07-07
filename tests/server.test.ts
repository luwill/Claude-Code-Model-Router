/**
 * Baseline tests for the HTTP gateway: /health, /v1/models,
 * /v1/messages forwarding (JSON + SSE) and optional inbound auth.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigManager } from '../src/config.js';
import { createServer } from '../src/server.js';
import { VERSION } from '../src/version.js';

interface UpstreamCapture {
  path?: string;
  headers?: http.IncomingHttpHeaders;
  body?: Record<string, unknown>;
}

const cleanups: Array<() => void> = [];
let upstream: http.Server;
let upstreamPort: number;
const captured: UpstreamCapture = {};

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve((server.address() as AddressInfo).port);
    });
  });
}

function writeTempConfig(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccmr-server-test-'));
  const file = path.join(dir, 'models.yaml');
  fs.writeFileSync(file, content);
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  return file;
}

async function startGateway(configFile: string): Promise<{ url: string; close: () => void }> {
  const manager = new ConfigManager(configFile);
  const app = createServer(manager);
  const server = http.createServer(app);
  const port = await listen(server);
  const close = () => server.close();
  cleanups.push(close);
  return { url: `http://127.0.0.1:${port}`, close };
}

function testConfig(upstreamUrl: string): string {
  return `
default_model: testmodel-v1
providers:
  testmodel:
    display_name: Test Upstream
    provider: custom
    base_url: ${upstreamUrl}
    api_key_env: TEST_UPSTREAM_KEY
    auth_header: Authorization
    auth_type: bearer
    default_variant: v1
    variants:
      v1:
        display_name: "Test Model V1"
        model_id: upstream-model-001
        max_tokens: 4096
        context_window: 128000
`;
}

beforeAll(async () => {
  process.env.TEST_UPSTREAM_KEY = 'sk-upstream-test';

  upstream = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      captured.path = req.url ?? '';
      captured.headers = req.headers;
      captured.body = raw ? JSON.parse(raw) : {};

      const body = captured.body as { stream?: boolean };
      if (body.stream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write('event: message_start\n');
        res.write(
          'data: {"type":"message_start","message":{"usage":{"input_tokens":11,"output_tokens":0}}}\n\n'
        );
        res.write('event: content_block_delta\n');
        res.write(
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"pong"}}\n\n'
        );
        res.write('event: message_delta\n');
        res.write('data: {"type":"message_delta","usage":{"output_tokens":7}}\n\n');
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: 'msg_test',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'pong' }],
            model: 'upstream-model-001',
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: { input_tokens: 11, output_tokens: 7 },
          })
        );
      }
    });
  });
  upstreamPort = await listen(upstream);
});

afterAll(() => {
  upstream.close();
  delete process.env.TEST_UPSTREAM_KEY;
});

afterEach(() => {
  delete process.env.CCMR_REQUIRED_AUTH_TOKEN;
});

describe('GET /health and /v1/models', () => {
  it('reports version, default model, and per-model availability', async () => {
    const configFile = writeTempConfig(testConfig(`http://127.0.0.1:${upstreamPort}`));
    const gateway = await startGateway(configFile);

    const health = (await (await fetch(`${gateway.url}/health`)).json()) as {
      status: string;
      version: string;
      default_model: string;
      models: Record<string, string>;
    };
    expect(health.status).toBe('healthy');
    expect(health.version).toBe(VERSION);
    expect(health.default_model).toBe('testmodel-v1');
    expect(health.models['testmodel-v1']).toBe('available');

    const models = (await (await fetch(`${gateway.url}/v1/models`)).json()) as {
      data: Array<{ id: string; model_id: string; available: boolean }>;
    };
    const testModel = models.data.find((m) => m.id === 'testmodel-v1');
    expect(testModel).toBeDefined();
    expect(testModel?.model_id).toBe('upstream-model-001');
    expect(testModel?.available).toBe(true);
  });
});

describe('POST /v1/messages forwarding', () => {
  it('forwards non-streaming requests and passes the response through', async () => {
    const configFile = writeTempConfig(testConfig(`http://127.0.0.1:${upstreamPort}`));
    const gateway = await startGateway(configFile);

    const res = await fetch(`${gateway.url}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'testmodel-v1',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { content: Array<{ text: string }> };
    expect(data.content[0].text).toBe('pong');

    // Upstream saw the translated model id and bearer auth
    expect(captured.path).toBe('/v1/messages');
    expect(captured.body?.model).toBe('upstream-model-001');
    expect(captured.headers?.authorization).toBe('Bearer sk-upstream-test');
  });

  it('streams SSE events through unchanged', async () => {
    const configFile = writeTempConfig(testConfig(`http://127.0.0.1:${upstreamPort}`));
    const gateway = await startGateway(configFile);

    const res = await fetch(`${gateway.url}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'testmodel-v1',
        max_tokens: 100,
        stream: true,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const text = await res.text();
    expect(text).toContain('message_start');
    expect(text).toContain('"text":"pong"');
    expect(text).toContain('message_delta');
  });

  it('returns 400 invalid_model for unknown models', async () => {
    const configFile = writeTempConfig(testConfig(`http://127.0.0.1:${upstreamPort}`));
    const gateway = await startGateway(configFile);

    const res = await fetch(`${gateway.url}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'ghost-model',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: { type: string } };
    expect(data.error.type).toBe('invalid_model');
  });
});

describe('inbound auth (CCMR_REQUIRED_AUTH_TOKEN)', () => {
  it('rejects /v1/* without the token but keeps /health open', async () => {
    process.env.CCMR_REQUIRED_AUTH_TOKEN = 'secret-token';
    const configFile = writeTempConfig(testConfig(`http://127.0.0.1:${upstreamPort}`));
    const gateway = await startGateway(configFile);

    expect((await fetch(`${gateway.url}/health`)).status).toBe(200);
    expect((await fetch(`${gateway.url}/v1/models`)).status).toBe(401);
    expect(
      (await fetch(`${gateway.url}/v1/models`, { headers: { 'x-api-key': 'wrong' } })).status
    ).toBe(401);
    expect(
      (
        await fetch(`${gateway.url}/v1/models`, {
          headers: { authorization: 'Bearer secret-token' },
        })
      ).status
    ).toBe(200);
  });
});

afterAll(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
});
