/**
 * Gateway process helpers for `ccmr claude`: probe /health, wait for
 * readiness, and auto-start a detached gateway when none is running.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface GatewayHealth {
  status?: string;
  version?: string;
  default_model?: string;
}

export interface EnsureGatewayResult {
  health: GatewayHealth;
  autoStarted: boolean;
  pid?: number;
  logFile?: string;
}

export async function probeGateway(
  port: string | number,
  timeoutMs = 1500
): Promise<GatewayHealth | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: controller.signal });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as GatewayHealth;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function waitForHealthy(
  port: string | number,
  timeoutMs = 10000,
  intervalMs = 300
): Promise<GatewayHealth | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const health = await probeGateway(port, 1000);
    if (health) {
      return health;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

/**
 * Returns the running gateway's health, auto-starting a detached gateway
 * process (logs to ~/.ccmr/gateway.log) when none is reachable.
 * Returns null when auto-start failed to become healthy in time.
 */
export async function ensureGatewayRunning(
  port: string | number,
  cliScript: string
): Promise<EnsureGatewayResult | null> {
  const existing = await probeGateway(port);
  if (existing) {
    return { health: existing, autoStarted: false };
  }

  const logDir = path.join(os.homedir(), '.ccmr');
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, 'gateway.log');
  const out = fs.openSync(logFile, 'a');

  // Inherit cwd so the gateway discovers the same models.yaml/.env the CLI sees
  const child = spawn(process.execPath, [cliScript, 'start', '--port', String(port)], {
    detached: true,
    stdio: ['ignore', out, out],
    cwd: process.cwd(),
  });
  child.unref();
  fs.closeSync(out);

  const health = await waitForHealthy(port);
  if (!health) {
    return null;
  }
  return { health, autoStarted: true, pid: child.pid, logFile };
}
