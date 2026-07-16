import type { GatewayConfig } from './types.js';

const INFO_LEVELS = new Set(['DEBUG', 'INFO']);

/** Whether routine request/completion logs should be emitted. */
export function isInfoLoggingEnabled(config: GatewayConfig): boolean {
  return config.enable_logging && INFO_LEVELS.has(config.log_level.toUpperCase());
}
