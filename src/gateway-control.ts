/**
 * Discover and stop running gateways (`ccmr status`, `ccmr stop`).
 *
 * A gateway auto-started by `ccmr claude` is detached and reparented to init,
 * so it survives the terminal that spawned it. Without these commands the only
 * way to find or stop one is a `pkill` pattern nobody remembers.
 *
 * Safety: a process is only ever signalled when it self-identifies as a ccmr
 * gateway through /health and reports its own pid. A stranger listening on the
 * port is reported, never killed. This also keeps the implementation free of
 * platform-specific `lsof` / `netstat` parsing.
 */

import net from 'node:net';
import { probeGateway } from './launcher.js';
import { readGatewayIdentity } from './gateway-identity.js';
import type { GatewayHealth } from './launcher.js';

/** CLI default (8080), VSCode extension default (8088) and its fallback range. */
export const DEFAULT_SCAN_PORTS: number[] = Array.from({ length: 20 }, (_, i) => 8080 + i);

export interface GatewayInfo {
  port: number;
  pid?: number;
  version?: string;
  default_model?: string;
  config_file?: string | null;
  ccmr_home?: string;
  modelsReady: number;
  modelsTotal: number;
}

export type StopResult =
  | { status: 'stopped'; pid: number }
  | { status: 'still_running'; pid: number }
  | { status: 'not_running' }
  | { status: 'unknown_process' }
  | { status: 'unverified_gateway'; pid?: number }
  | { status: 'no_pid'; version?: string };

export interface StopOptions {
  /** Injectable for tests; defaults to signalling the real process. */
  kill?: (pid: number, signal: NodeJS.Signals) => void;
  /** How long to wait for the port to free up after SIGTERM. */
  waitMs?: number;
  /** Escalate to SIGKILL if the process ignores SIGTERM. */
  force?: boolean;
  /** Injectable for tests; defaults to checking the local identity registry. */
  verifyIdentity?: (port: number, health: GatewayHealth) => boolean;
}

/** A ccmr gateway always answers /health with a version string. */
function isCcmrGateway(health: unknown): boolean {
  if (
    !health ||
    (health as { status?: unknown }).status !== 'healthy' ||
    typeof (health as { version?: unknown }).version !== 'string'
  ) {
    return false;
  }
  const service = (health as { service?: unknown }).service;
  return service === undefined || service === 'claude-code-model-router';
}

function verifyRegisteredIdentity(port: number, health: GatewayHealth): boolean {
  // Pre-1.8.3 gateways never advertised an instance_id or wrote an identity
  // record. Requiring one would make them unstoppable after an upgrade: the
  // old binary is gone, so "restart it with the current version" can never be
  // satisfied without the stop this check would refuse. They keep the trust
  // level `ccmr stop` shipped with in 1.8.2 (a /health-self-identified pid).
  if (!health.instance_id) {
    return true;
  }
  const registered = readGatewayIdentity(port);
  return (
    !!registered &&
    registered.pid === health.pid &&
    registered.instanceId === health.instance_id
  );
}

function isPortOpen(port: number, timeoutMs = 300): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    const done = (open: boolean) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function inspect(port: number, timeoutMs: number): Promise<GatewayInfo | null> {
  const health = await probeGateway(port, timeoutMs);
  if (!isCcmrGateway(health) || !health) {
    return null;
  }

  const models = Object.values(health.models ?? {});
  return {
    port,
    pid: health.pid,
    version: health.version,
    default_model: health.default_model,
    config_file: health.config_file ?? null,
    ccmr_home: health.ccmr_home,
    modelsReady: models.filter((status) => status === 'available').length,
    modelsTotal: models.length,
  };
}

export async function discoverGateways(
  ports: number[] = DEFAULT_SCAN_PORTS,
  timeoutMs = 400
): Promise<GatewayInfo[]> {
  const results = await Promise.all(ports.map((port) => inspect(port, timeoutMs)));
  return results.filter((info): info is GatewayInfo => info !== null);
}

export async function stopGateway(port: number, options: StopOptions = {}): Promise<StopResult> {
  const kill = options.kill ?? ((pid, signal) => process.kill(pid, signal));
  const waitMs = options.waitMs ?? 5000;

  const health = await probeGateway(port, 1000);

  if (!isCcmrGateway(health) || !health) {
    // Distinguish "nothing there" from "someone else's server" - we must not
    // kill the latter, and the user needs to know which case they are in.
    return (await isPortOpen(port)) ? { status: 'unknown_process' } : { status: 'not_running' };
  }

  if (typeof health.pid !== 'number') {
    return { status: 'no_pid', version: health.version };
  }

  const verifyIdentity = options.verifyIdentity ?? verifyRegisteredIdentity;
  if (!verifyIdentity(port, health)) {
    return { status: 'unverified_gateway', pid: health.pid };
  }

  const pid = health.pid;
  kill(pid, 'SIGTERM');

  if (await waitForPortToClose(port, waitMs)) {
    return { status: 'stopped', pid };
  }

  if (options.force) {
    kill(pid, 'SIGKILL');
    if (await waitForPortToClose(port, 2000)) {
      return { status: 'stopped', pid };
    }
  }

  return { status: 'still_running', pid };
}

async function waitForPortToClose(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isPortOpen(port, 200))) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}
