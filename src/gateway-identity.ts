import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ccmrHome } from './paths.js';

export interface GatewayIdentity {
  pid: number;
  port: number;
  instanceId: string;
}

export function newGatewayInstanceId(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function gatewayIdentityFile(port: number): string {
  return path.join(ccmrHome(), `gateway-${port}.identity.json`);
}

export function writeGatewayIdentity(port: number, instanceId: string): void {
  const file = gatewayIdentityFile(port);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const identity: GatewayIdentity = { pid: process.pid, port, instanceId };
  fs.writeFileSync(file, JSON.stringify(identity), { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Best effort on filesystems/platforms without POSIX modes.
  }
}

export function readGatewayIdentity(port: number): GatewayIdentity | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(gatewayIdentityFile(port), 'utf-8')) as GatewayIdentity;
    if (
      parsed.port !== port ||
      !Number.isInteger(parsed.pid) ||
      parsed.pid <= 0 ||
      typeof parsed.instanceId !== 'string' ||
      parsed.instanceId.length < 32
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
