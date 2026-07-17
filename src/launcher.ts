/**
 * Gateway process helpers for `ccmr claude`: probe /health, wait for
 * readiness, and auto-start a detached gateway when none is running.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { gatewayLogFile } from './paths.js';

export interface GatewayHealth {
  status?: string;
  version?: string;
  default_model?: string;
  config_file?: string | null;
  ccmr_home?: string;
  /** Secret-free fingerprint of the config/.env source set. */
  config_source_id?: string;
  /** Random per-process identity, paired with a local 0600 registry file. */
  instance_id?: string;
  service?: string;
  /** The gateway's own process id (absent on gateways older than 1.8.2). */
  pid?: number;
  /** model key -> 'available' | 'no_api_key' (absent on gateways older than 1.8.1) */
  models?: Record<string, string>;
}

export type GatewayModelCheck =
  | { ok: true }
  | { ok: false; reason: 'unknown_model' | 'no_api_key' };

export type GatewaySourceCheck =
  | { ok: true }
  | { ok: false; reason: 'source_mismatch' | 'source_unknown' };

/** Refuse to reuse a detached gateway whose project/config provenance differs. */
export function checkGatewaySource(
  health: GatewayHealth,
  expectedSourceId: string
): GatewaySourceCheck {
  if (!health.config_source_id) {
    return { ok: false, reason: 'source_unknown' };
  }
  return health.config_source_id === expectedSourceId
    ? { ok: true }
    : { ok: false, reason: 'source_mismatch' };
}

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

/** Model keys the gateway can actually serve (it holds an API key for them). */
export function availableModels(health: GatewayHealth): string[] {
  return Object.entries(health.models ?? {})
    .filter(([, status]) => status === 'available')
    .map(([key]) => key);
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

  // Follows CCMR_HOME, so config and logs never end up in different places
  const logFile = gatewayLogFile();
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
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
