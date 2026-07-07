/**
 * Tests for gateway probing/waiting used by `ccmr claude` auto-start.
 */

import { describe, it, expect, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { probeGateway, waitForHealthy } from '../src/launcher.js';

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
