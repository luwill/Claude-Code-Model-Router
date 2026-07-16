/**
 * Config hot-reload watcher.
 *
 * Polls every candidate config/env path — including ones that do not exist
 * yet — so a gateway started before `ccmr init` still picks the files up when
 * they appear. Watching only files present at startup (v1.8.0) left an
 * auto-started gateway permanently stuck on built-in defaults with zero keys.
 *
 * Stat polling (rather than fs.watch) survives editors and installers that
 * replace files atomically via rename.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ConfigManager } from './config.js';
import { ccmrHome } from './paths.js';

export interface ConfigWatcherOptions {
  intervalMs?: number;
  /** Overridable for tests; defaults to the gateway's working directory. */
  cwd?: string;
  onReload?: (changedPaths: string[]) => void;
}

const ABSENT = 'absent';

/**
 * Every path whose creation, edit, or deletion should trigger a reload —
 * whether or not it currently exists.
 */
export function watchCandidates(configManager: ConfigManager, cwd = process.cwd()): string[] {
  const home = ccmrHome();
  const candidates = [
    configManager.getConfigFilePath(),
    path.join(cwd, 'models.yaml'),
    path.join(cwd, 'config', 'models.yaml'),
    path.join(cwd, '.claude-router.yaml'),
    path.join(home, 'models.yaml'),
    path.join(cwd, '.env'),
    path.join(home, '.env'),
    ...configManager.getEnvCandidatePaths(),
  ].filter((p): p is string => !!p);

  return [...new Set(candidates)];
}

function signature(filePath: string): string {
  try {
    const stat = fs.statSync(filePath);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return ABSENT;
  }
}

export class ConfigWatcher {
  private timer: NodeJS.Timeout | undefined;
  private readonly snapshot = new Map<string, string>();

  constructor(
    private readonly configManager: ConfigManager,
    private readonly options: ConfigWatcherOptions = {}
  ) {}

  paths(): string[] {
    return watchCandidates(this.configManager, this.options.cwd);
  }

  start(): void {
    for (const p of this.paths()) {
      this.snapshot.set(p, signature(p));
    }
    this.timer = setInterval(() => this.tick(), this.options.intervalMs ?? 1000);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private tick(): void {
    const changed: string[] = [];

    for (const p of this.paths()) {
      const current = signature(p);
      const previous = this.snapshot.get(p);

      if (previous === undefined) {
        // A newly relevant path (e.g. discovery moved the config file):
        // record it, and only treat it as a change if it actually exists.
        this.snapshot.set(p, current);
        if (current !== ABSENT) {
          changed.push(p);
        }
        continue;
      }

      if (previous !== current) {
        this.snapshot.set(p, current);
        changed.push(p);
      }
    }

    if (changed.length === 0) {
      return;
    }

    this.configManager.reload();
    this.options.onReload?.(changed);
  }
}
