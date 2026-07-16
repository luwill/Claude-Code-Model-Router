/**
 * Tests for `ccmr status` / `ccmr stop`.
 *
 * Safety property under test: a gateway is only ever stopped when it
 * self-identifies through /health. A stranger listening on the port must
 * never be killed.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { discoverGateways, stopGateway } from '../src/gateway-control.js';
import { newGatewayInstanceId, writeGatewayIdentity } from '../src/gateway-identity.js';

const servers: http.Server[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) {
    server.close();
  }
});

function listen(handler: http.RequestListener): Promise<number> {
  const server = http.createServer(handler);
  servers.push(server);
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port))
  );
}

interface FakeHealth {
  version?: string;
  pid?: number;
  default_model?: string;
  config_file?: string | null;
  models?: Record<string, string>;
  instance_id?: string;
}

function ccmrGateway(health: FakeHealth): Promise<number> {
  return listen((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', ...health }));
    } else {
      res.writeHead(404).end();
    }
  });
}

/** Something else entirely on the port — must never be touched. */
function strangerServer(): Promise<number> {
  return listen((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('I am not a ccmr gateway');
  });
}

async function freePort(): Promise<number> {
  const port = await listen(() => {});
  servers.pop()?.close();
  return port;
}

describe('discoverGateways', () => {
  it('reports version, pid, config source and ready-model counts', async () => {
    const port = await ccmrGateway({
      version: '1.8.2',
      pid: 4242,
      default_model: 'deepseek-v4-pro',
      config_file: '/home/u/.ccmr/models.yaml',
      models: { 'deepseek-v4-pro': 'available', 'kimi-k2.6': 'no_api_key' },
    });

    const found = await discoverGateways([port]);

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      port,
      pid: 4242,
      version: '1.8.2',
      default_model: 'deepseek-v4-pro',
      config_file: '/home/u/.ccmr/models.yaml',
      modelsReady: 1,
      modelsTotal: 2,
    });
  });

  it('ignores ports serving something that is not a ccmr gateway', async () => {
    const stranger = await strangerServer();
    expect(await discoverGateways([stranger])).toEqual([]);
  });

  it('ignores free ports', async () => {
    expect(await discoverGateways([await freePort()])).toEqual([]);
  });

  it('scans several ports at once', async () => {
    const a = await ccmrGateway({ version: '1.8.2', pid: 1, models: {} });
    const b = await ccmrGateway({ version: '1.8.2', pid: 2, models: {} });
    const found = await discoverGateways([a, await freePort(), b]);
    expect(found.map((g) => g.port).sort()).toEqual([a, b].sort());
  });
});

describe('stopGateway', () => {
  it('sends SIGTERM to the pid the gateway reported, then confirms the port is free', async () => {
    const killed: Array<[number, string]> = [];
    const port = await ccmrGateway({ version: '1.8.2', pid: 4242, models: {} });
    const server = servers[servers.length - 1];

    const result = await stopGateway(port, {
      verifyIdentity: () => true,
      kill: (pid, signal) => {
        killed.push([pid, signal]);
        server.close(); // a real gateway would exit here
      },
    });

    expect(result).toEqual({ status: 'stopped', pid: 4242 });
    expect(killed).toEqual([[4242, 'SIGTERM']]);
  });

  it('never kills a process that is not a ccmr gateway', async () => {
    const killed: number[] = [];
    const port = await strangerServer();

    const result = await stopGateway(port, { kill: (pid) => killed.push(pid) });

    expect(result).toEqual({ status: 'unknown_process' });
    expect(killed).toEqual([]);
  });

  it('reports not_running for a free port without killing anything', async () => {
    const killed: number[] = [];
    const result = await stopGateway(await freePort(), { kill: (pid) => killed.push(pid) });

    expect(result).toEqual({ status: 'not_running' });
    expect(killed).toEqual([]);
  });

  it('refuses to guess when an older gateway reports no pid', async () => {
    const killed: number[] = [];
    const port = await ccmrGateway({ version: '1.8.1', models: {} });

    const result = await stopGateway(port, { kill: (pid) => killed.push(pid) });

    expect(result).toEqual({ status: 'no_pid', version: '1.8.1' });
    expect(killed).toEqual([]);
  });

  it('reports still_running when the process ignores SIGTERM', async () => {
    const port = await ccmrGateway({ version: '1.8.2', pid: 4242, models: {} });

    const result = await stopGateway(port, {
      verifyIdentity: () => true,
      kill: () => {
        /* stubborn process: stays up */
      },
      waitMs: 300,
    });

    expect(result).toEqual({ status: 'still_running', pid: 4242 });
  });

  it('refuses to signal a self-identified gateway without a matching local identity', async () => {
    const killed: number[] = [];
    const port = await ccmrGateway({ version: '1.8.3', pid: 4242, models: {} });

    const result = await stopGateway(port, {
      verifyIdentity: () => false,
      kill: (pid) => killed.push(pid),
    });

    expect(result).toEqual({ status: 'unverified_gateway', pid: 4242 });
    expect(killed).toEqual([]);
  });
});

// The DEFAULT identity check (no injected verifyIdentity). Upgrade property
// under test: a pre-1.8.3 gateway never wrote an identity record, so requiring
// one would make it unstoppable right after an upgrade - `ccmr stop` refuses,
// while its own advice ("restart with the current version") needs the stop to
// succeed first. Legacy gateways keep the 1.8.2 trust level instead.
describe('stopGateway default identity verification', () => {
  let savedHome: string | undefined;

  beforeEach(() => {
    savedHome = process.env.CCMR_HOME;
    process.env.CCMR_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'ccmr-identity-'));
  });

  afterEach(() => {
    fs.rmSync(process.env.CCMR_HOME!, { recursive: true, force: true });
    if (savedHome === undefined) delete process.env.CCMR_HOME;
    else process.env.CCMR_HOME = savedHome;
  });

  it('stops a legacy gateway that predates identity records', async () => {
    const killed: Array<[number, string]> = [];
    const port = await ccmrGateway({ version: '1.8.2', pid: 4242, models: {} });
    const server = servers[servers.length - 1];

    const result = await stopGateway(port, {
      kill: (pid, signal) => {
        killed.push([pid, signal]);
        server.close();
      },
    });

    expect(result).toEqual({ status: 'stopped', pid: 4242 });
    expect(killed).toEqual([[4242, 'SIGTERM']]);
  });

  it('refuses a gateway that advertises an instance_id with no local record', async () => {
    const killed: number[] = [];
    const port = await ccmrGateway({
      version: '1.8.3',
      pid: 4242,
      models: {},
      instance_id: newGatewayInstanceId(),
    });

    const result = await stopGateway(port, { kill: (pid) => killed.push(pid) });

    expect(result).toEqual({ status: 'unverified_gateway', pid: 4242 });
    expect(killed).toEqual([]);
  });

  it('stops a gateway whose instance_id matches the local identity record', async () => {
    const killed: Array<[number, string]> = [];
    const instanceId = newGatewayInstanceId();
    const port = await ccmrGateway({
      version: '1.8.3',
      pid: process.pid, // writeGatewayIdentity records the writer's own pid
      models: {},
      instance_id: instanceId,
    });
    const server = servers[servers.length - 1];
    writeGatewayIdentity(port, instanceId);

    const result = await stopGateway(port, {
      kill: (pid, signal) => {
        killed.push([pid, signal]);
        server.close();
      },
    });

    expect(result).toEqual({ status: 'stopped', pid: process.pid });
    expect(killed).toEqual([[process.pid, 'SIGTERM']]);
  });
});
