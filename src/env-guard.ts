/**
 * Keeps plaintext .env files out of git: `ccmr init` writes provider API
 * keys into ./.env, so inside a git repo that file must be gitignored
 * before an accidental `git add -A` publishes every key.
 */

import fs from 'node:fs';
import path from 'node:path';

export type EnvGuardResult = 'added' | 'present' | 'no-git';

export function ensureEnvIgnored(dir: string): EnvGuardResult {
  if (!fs.existsSync(path.join(dir, '.git'))) {
    return 'no-git';
  }

  const gitignorePath = path.join(dir, '.gitignore');
  const existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';

  const lines = existing.split(/\r?\n/).map((line) => line.trim());
  if (lines.includes('.env')) {
    return 'present';
  }

  const separator = existing.length === 0 || existing.endsWith('\n') ? '' : '\n';
  const block = `${separator}# API keys (written by ccmr init) - never commit\n.env\n`;
  fs.writeFileSync(gitignorePath, existing + block);
  return 'added';
}
