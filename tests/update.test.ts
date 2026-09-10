/**
 * Tests for `ccmr update`: version comparison, update planning, and the
 * registry lookup (against a local HTTP server, never the real registry).
 */

import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { compareVersions, planUpdate, fetchLatestVersion } from '../src/update.js';

const servers: http.Server[] = [];

afterEach(() => {
  for (const s of servers.splice(0)) s.close();
});

async function registryStub(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<string> {
  const server = http.createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('compareVersions', () => {
  it('orders releases numerically, not lexically', () => {
    // The bug this prevents: "1.9.0" > "1.10.0" under string comparison,
    // which would tell a user on 1.9.0 they are already up to date.
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.9.0', '1.10.0')).toBeLessThan(0);
    expect(compareVersions('1.19.0', '1.19.0')).toBe(0);
    expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0);
  });

  it('treats a prerelease as older than its release', () => {
    expect(compareVersions('1.20.0-beta.1', '1.20.0')).toBeLessThan(0);
    expect(compareVersions('1.20.0', '1.20.0-beta.1')).toBeGreaterThan(0);
  });

  it('tolerates missing segments', () => {
    expect(compareVersions('1.19', '1.19.0')).toBe(0);
    expect(compareVersions('2', '1.99.99')).toBeGreaterThan(0);
  });
});

describe('planUpdate', () => {
  it('plans an install when the registry is ahead', () => {
    expect(planUpdate('1.19.0', '1.20.0')).toEqual({
      action: 'install',
      current: '1.19.0',
      latest: '1.20.0',
    });
  });

  it('reports up-to-date when versions match', () => {
    expect(planUpdate('1.19.0', '1.19.0').action).toBe('up-to-date');
  });

  it('reports up-to-date when the local build is ahead of the registry', () => {
    // Happens on an unpublished local build; reinstalling would be a
    // downgrade, so it must not be planned as an install.
    expect(planUpdate('1.20.0', '1.19.0').action).toBe('up-to-date');
  });
});

describe('fetchLatestVersion', () => {
  it('reads the version from the registry document', async () => {
    const url = await registryStub((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ name: 'claude-code-model-router', version: '9.9.9' }));
    });

    await expect(fetchLatestVersion({ registryUrl: url })).resolves.toBe('9.9.9');
  });

  it('fails with a usable message when the registry errors', async () => {
    const url = await registryStub((_req, res) => {
      res.writeHead(503);
      res.end('upstream down');
    });

    await expect(fetchLatestVersion({ registryUrl: url })).rejects.toThrow(/503/);
  });

  it('fails when the payload carries no version', async () => {
    const url = await registryStub((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ name: 'claude-code-model-router' }));
    });

    await expect(fetchLatestVersion({ registryUrl: url })).rejects.toThrow(/version/i);
  });
});
