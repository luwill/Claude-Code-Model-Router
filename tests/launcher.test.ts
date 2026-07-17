/**
 * Tests for gateway probing/waiting used by `ccmr claude` auto-start.
 */

import { describe, it, expect, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import {
  availableModels,
  checkGatewayModel,
  checkGatewaySource,
  probeGateway,
  waitForHealthy,
} from '../src/launcher.js';
import { ccmrHome, gatewayLogFile } from '../src/paths.js';

const cleanups: Array<() => void> = [];

afterAll(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function healthServer(version = '9.9.9'): Promise<{ port: number; close: () => void }> {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', version, default_model: 'test-model' }));
    } else {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const close = () => server.close();
      cleanups.push(close);
      resolve({ port: (server.address() as AddressInfo).port, close });
    });
  });
}

async function freePort(): Promise<number> {
  const { port, close } = await healthServer();
  close();
  return port;
}

describe('probeGateway', () => {
  it('returns health info from a running gateway', async () => {
    const { port } = await healthServer('1.2.3');
    const health = await probeGateway(port);
    expect(health?.version).toBe('1.2.3');
    expect(health?.default_model).toBe('test-model');
  });

  it('returns null when nothing is listening', async () => {
    const port = await freePort();
    expect(await probeGateway(port, 500)).toBeNull();
  });
});

describe('gatewayLogFile', () => {
  // Config moved with CCMR_HOME but the auto-start log used to stay in ~/.ccmr
  it('follows CCMR_HOME so config and logs stay together', () => {
    const saved = process.env.CCMR_HOME;
    process.env.CCMR_HOME = '/tmp/ccmr-elsewhere';
    try {
      expect(gatewayLogFile()).toBe(path.join('/tmp/ccmr-elsewhere', 'gateway.log'));
      expect(path.dirname(gatewayLogFile())).toBe(ccmrHome());
    } finally {
      if (saved === undefined) delete process.env.CCMR_HOME;
      else process.env.CCMR_HOME = saved;
    }
  });
});

describe('checkGatewayModel', () => {
  // Regression: a reachable gateway with zero API keys used to be reused
  // silently, surfacing as a 401 deep inside Claude Code.
  it('accepts a model the gateway reports as available', () => {
    const health = { models: { 'deepseek-v4-pro': 'available' } };
    expect(checkGatewayModel(health, 'deepseek-v4-pro')).toEqual({ ok: true });
  });

  it('rejects a model the gateway has no API key for', () => {
    const health = { models: { 'deepseek-v4-pro': 'no_api_key' } };
    expect(checkGatewayModel(health, 'deepseek-v4-pro')).toEqual({
      ok: false,
      reason: 'no_api_key',
    });
  });

  it('rejects a model the gateway does not know at all', () => {
    const health = { models: { 'kimi-k2.6': 'available' } };
    expect(checkGatewayModel(health, 'deepseek-v4-pro')).toEqual({
      ok: false,
      reason: 'unknown_model',
    });
  });

  it('does not block when an older gateway omits the models map', () => {
    expect(checkGatewayModel({ version: '1.7.1' }, 'deepseek-v4-pro')).toEqual({ ok: true });
  });
});

describe('availableModels', () => {
  // Drives the no_api_key guidance split in `ccmr claude`: a healthy gateway
  // with other keyed models gets "ccmr use <model>" advice, not "stop + init".
  it('lists only models the gateway holds a key for', () => {
    const health = {
      models: {
        'kimi-k2.6': 'no_api_key',
        'deepseek-v4-pro': 'available',
        'kimi-cn-k3': 'available',
      },
    };
    expect(availableModels(health)).toEqual(['deepseek-v4-pro', 'kimi-cn-k3']);
  });

  it('returns empty when the gateway has no keys or no models map', () => {
    expect(availableModels({ models: { 'kimi-k2.6': 'no_api_key' } })).toEqual([]);
    expect(availableModels({ version: '1.7.1' })).toEqual([]);
  });
});

describe('checkGatewaySource', () => {
  it('accepts a gateway created from the same config source', () => {
    expect(checkGatewaySource({ config_source_id: 'same-source' }, 'same-source')).toEqual({
      ok: true,
    });
  });

  it('rejects a gateway from another project even when it is healthy', () => {
    expect(checkGatewaySource({ config_source_id: 'project-a' }, 'project-b')).toEqual({
      ok: false,
      reason: 'source_mismatch',
    });
  });

  it('requires an old gateway without source identity to be restarted', () => {
    expect(checkGatewaySource({ version: '1.8.2' }, 'current-source')).toEqual({
      ok: false,
      reason: 'source_unknown',
    });
  });
});

describe('waitForHealthy', () => {
  it('resolves once the gateway comes up late', async () => {
    const port = await freePort();
    setTimeout(async () => {
      const server = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', version: '1.2.3' }));
      });
      server.listen(port, '127.0.0.1');
      cleanups.push(() => server.close());
    }, 400);

    const health = await waitForHealthy(port, 3000, 100);
    expect(health?.version).toBe('1.2.3');
  });

  it('gives up after the deadline', async () => {
    const port = await freePort();
    expect(await waitForHealthy(port, 600, 100)).toBeNull();
  });
});
