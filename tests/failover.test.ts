/**
 * Tests for fallback model chains: upstream 5xx/429/connection failures
 * fail over to the configured fallback; client errors (4xx) do not.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigManager } from '../src/config.js';
import { ModelRouter, RouterError } from '../src/router.js';
import { UsageTracker } from '../src/usage.js';

const cleanups: Array<() => void> = [];

afterAll(() => {
  delete process.env.FO_PRIMARY_KEY;
  delete process.env.FO_BACKUP_KEY;
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function jsonResponse(model: string) {
  return JSON.stringify({
    id: 'msg',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: `answered-by-${model}` }],
    model,
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  });
}

async function startUpstream(
  handler: http.RequestListener
): Promise<number> {
  const server = http.createServer(handler);
  const port = await new Promise<number>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port))
  );
  cleanups.push(() => server.close());
  return port;
}

let failingPort: number; // always 503
let clientErrorPort: number; // always 400
let healthyPort: number; // always 200
let unreachablePort: number; // nothing listening

beforeAll(async () => {
  process.env.FO_PRIMARY_KEY = 'sk-primary';
  process.env.FO_BACKUP_KEY = 'sk-backup';

  failingPort = await startUpstream((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { type: 'overloaded', message: 'upstream down' } }));
    });
  });
  clientErrorPort = await startUpstream((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { type: 'invalid_request', message: 'bad request' } }));
    });
  });
  healthyPort = await startUpstream((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = JSON.parse(raw) as { stream?: boolean; model?: string };
      if (body.stream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write(
          `event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"answered-by-${body.model}"}}\n\n`
        );
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(jsonResponse(body.model ?? 'unknown'));
      }
    });
  });

  // Reserve a port with nothing on it
  const probe = http.createServer(() => {});
  unreachablePort = await new Promise<number>((resolve) =>
    probe.listen(0, '127.0.0.1', () => resolve((probe.address() as AddressInfo).port))
  );
  probe.close();
});

function routerFor(
  primaryPort: number,
  fallback?: string[],
  options: { backupPort?: number; tracker?: UsageTracker } = {}
): ModelRouter {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccmr-failover-'));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'models.yaml');
  fs.writeFileSync(
    file,
    `
default_model: fo-primary-v1
gateway:
  timeout: 5
  enable_logging: false
providers:
  fo-primary:
    display_name: Failover Primary
    provider: custom
    base_url: http://127.0.0.1:${primaryPort}
    api_key_env: FO_PRIMARY_KEY
    default_variant: v1
    variants:
      v1:
        display_name: "Failover Primary V1"
        model_id: fo-primary-001
${fallback ? `        fallback: [${fallback.join(', ')}]` : ''}
  fo-backup:
    display_name: Failover Backup
    provider: custom
    base_url: http://127.0.0.1:${options.backupPort ?? healthyPort}
    api_key_env: FO_BACKUP_KEY
    default_variant: v1
    variants:
      v1:
        display_name: "Failover Backup V1"
        model_id: fo-backup-001
`
  );
  return new ModelRouter(new ConfigManager(file), options.tracker);
}

const request = {
  model: 'fo-primary-v1',
  max_tokens: 10,
  messages: [{ role: 'user' as const, content: 'hi' }],
};

describe('forwardRequest failover', () => {
  it('fails over to the fallback on upstream 5xx', async () => {
    const router = routerFor(failingPort, ['fo-backup-v1']);
    const response = await router.forwardRequest({ ...request }, {});
    expect(response.content[0].text).toBe('answered-by-fo-backup-001');
  });

  it('fails over on connection errors', async () => {
    const router = routerFor(unreachablePort, ['fo-backup-v1']);
    const response = await router.forwardRequest({ ...request }, {});
    expect(response.content[0].text).toBe('answered-by-fo-backup-001');
  });

  it('does not fail over on 4xx client errors', async () => {
    const router = routerFor(clientErrorPort, ['fo-backup-v1']);
    await expect(router.forwardRequest({ ...request }, {})).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('throws the original error when no fallback is configured', async () => {
    const router = routerFor(failingPort);
    await expect(router.forwardRequest({ ...request }, {})).rejects.toBeInstanceOf(RouterError);
  });

  it('skips fallbacks whose API key is missing', async () => {
    delete process.env.FO_BACKUP_KEY;
    try {
      const router = routerFor(failingPort, ['fo-backup-v1']);
      // Backup has no key -> chain exhausted -> original 503 surfaces
      await expect(router.forwardRequest({ ...request }, {})).rejects.toMatchObject({
        statusCode: 503,
      });
    } finally {
      process.env.FO_BACKUP_KEY = 'sk-backup';
    }
  });
});

describe('forwardStream failover', () => {
  async function collect(router: ModelRouter): Promise<string> {
    let out = '';
    for await (const chunk of router.forwardStream({ ...request, stream: true }, {})) {
      out += chunk;
    }
    return out;
  }

  it('fails over before any bytes are streamed', async () => {
    const router = routerFor(failingPort, ['fo-backup-v1']);
    const text = await collect(router);
    expect(text).toContain('answered-by-fo-backup-001');
    expect(text).not.toContain('event: error');
  });

  it('yields an error event when the chain is exhausted', async () => {
    const router = routerFor(failingPort);
    const text = await collect(router);
    expect(text).toContain('event: error');
    expect(text).toContain('upstream down');
  });
});

// A client disconnect arrives as abort(reason), which rejects fetch with the
// caller's reason - NOT an 'AbortError'. It must be classified by the signal,
// never treated as an upstream failure: no failover, no error counters.
describe('client disconnect (aborted signal)', () => {
  function abortLikeServerDoes(controller: AbortController, afterMs: number): void {
    setTimeout(() => controller.abort(new Error('Client disconnected')), afterMs);
  }

  async function hangingUpstream(onHit: () => void): Promise<number> {
    return startUpstream((req) => {
      onHit();
      req.resume(); // read the body, then never respond
    });
  }

  it('rejects with 499 request_aborted instead of a connection error', async () => {
    const hangingPort = await hangingUpstream(() => {});
    const router = routerFor(hangingPort);
    const controller = new AbortController();
    abortLikeServerDoes(controller, 50);

    await expect(
      router.forwardRequest({ ...request }, {}, controller.signal)
    ).rejects.toMatchObject({ statusCode: 499, errorType: 'request_aborted' });
  });

  it('does not attempt failover or count model errors for an aborted request', async () => {
    const hangingPort = await hangingUpstream(() => {});
    let backupHits = 0;
    const countingBackupPort = await startUpstream((req, res) => {
      backupHits++;
      req.resume();
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(jsonResponse('fo-backup-001'));
      });
    });
    const tracker = new UsageTracker();
    const router = routerFor(hangingPort, ['fo-backup-v1'], {
      backupPort: countingBackupPort,
      tracker,
    });
    const controller = new AbortController();
    abortLikeServerDoes(controller, 50);

    await expect(
      router.forwardRequest({ ...request }, {}, controller.signal)
    ).rejects.toMatchObject({ errorType: 'request_aborted' });
    expect(backupHits).toBe(0);
    expect(tracker.snapshot().totals.errors).toBe(0);
  });

  it('rejects count_tokens with 499 request_aborted when the client disconnects', async () => {
    const hangingPort = await hangingUpstream(() => {});
    const router = routerFor(hangingPort);
    const controller = new AbortController();
    abortLikeServerDoes(controller, 50);

    await expect(
      router.forwardCountTokens({ ...request }, {}, controller.signal)
    ).rejects.toMatchObject({ statusCode: 499, errorType: 'request_aborted' });
  });

  it('ends a connecting stream quietly without counting a model error', async () => {
    const hangingPort = await hangingUpstream(() => {});
    const tracker = new UsageTracker();
    const router = routerFor(hangingPort, undefined, { tracker });
    const controller = new AbortController();
    abortLikeServerDoes(controller, 50);

    let out = '';
    for await (const chunk of router.forwardStream(
      { ...request, stream: true },
      {},
      controller.signal
    )) {
      out += chunk;
    }
    expect(out).not.toContain('event: error');
    expect(tracker.snapshot().totals.errors).toBe(0);
  });

  it('stops mid-stream without counting a model error when the client disconnects', async () => {
    const streamThenHangPort = await startUpstream((req, res) => {
      req.resume();
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write(
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":1,"output_tokens":0}}}\n\n'
        );
        // keep the stream open forever
      });
    });
    const tracker = new UsageTracker();
    const router = routerFor(streamThenHangPort, undefined, { tracker });
    const controller = new AbortController();

    let out = '';
    for await (const chunk of router.forwardStream(
      { ...request, stream: true },
      {},
      controller.signal
    )) {
      out += chunk;
      controller.abort(new Error('Client disconnected'));
    }
    expect(out).toContain('message_start');
    expect(out).not.toContain('event: error');
    expect(tracker.snapshot().totals.errors).toBe(0);
  });
});
