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
import type { ConfigManager } from './config.js';
export interface ConfigWatcherOptions {
    intervalMs?: number;
    /** Overridable for tests; defaults to the gateway's working directory. */
    cwd?: string;
    onReload?: (changedPaths: string[]) => void;
}
/**
 * Every path whose creation, edit, or deletion should trigger a reload —
 * whether or not it currently exists.
 */
export declare function watchCandidates(configManager: ConfigManager, cwd?: string): string[];
export declare class ConfigWatcher {
    private readonly configManager;
    private readonly options;
    private timer;
    private readonly snapshot;
    constructor(configManager: ConfigManager, options?: ConfigWatcherOptions);
    paths(): string[];
    start(): void;
    stop(): void;
    private tick;
}
//# sourceMappingURL=watcher.d.ts.map