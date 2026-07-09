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
  config_file?: string | null;
  ccmr_home?: string;
  /** model key -> 'available' | 'no_api_key' (absent on gateways older than 1.8.1) */
  models?: Record<string, string>;
}

export type GatewayModelCheck =
  | { ok: true }
  | { ok: false; reason: 'unknown_model' | 'no_api_key' };

/**
 * Guards against reusing a reachable-but-useless gateway. A gateway that
 * started before its config existed answers /health with 200 while holding
 * zero API keys; without this check the user only finds out via a 401
 * raised several layers down inside Claude Code.
 */
export function checkGatewayModel(health: GatewayHealth, modelKey: string): GatewayModelCheck {
  if (!health.models) {
    // Older gateway: no readiness data. Don't block on missing information.
    return { ok: true };
  }
  const status = health.models[modelKey];
  if (status === undefined) {
    return { ok: false, reason: 'unknown_model' };
  }
  if (status !== 'available') {
    return { ok: false, reason: 'no_api_key' };
  }
  return { ok: true };
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
