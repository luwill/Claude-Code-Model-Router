/**
 * Shared filesystem locations. CCMR_HOME overrides the default ~/.ccmr
 * (also handy for test isolation).
 */

import os from 'node:os';
import path from 'node:path';

export function ccmrHome(): string {
  return process.env.CCMR_HOME || path.join(os.homedir(), '.ccmr');
}

/** Where an auto-started (detached) gateway writes its output. */
export function gatewayLogFile(): string {
  return path.join(ccmrHome(), 'gateway.log');
}
