"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigWatcher = void 0;
exports.watchCandidates = watchCandidates;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const paths_js_1 = require("./paths.js");
const ABSENT = 'absent';
/**
 * Every path whose creation, edit, or deletion should trigger a reload —
 * whether or not it currently exists.
 */
function watchCandidates(configManager, cwd = process.cwd()) {
    const home = (0, paths_js_1.ccmrHome)();
    const candidates = [
        configManager.getConfigFilePath(),
        node_path_1.default.join(cwd, 'models.yaml'),
        node_path_1.default.join(cwd, 'config', 'models.yaml'),
        node_path_1.default.join(cwd, '.claude-router.yaml'),
        node_path_1.default.join(home, 'models.yaml'),
        node_path_1.default.join(cwd, '.env'),
        node_path_1.default.join(home, '.env'),
    ].filter((p) => !!p);
    return [...new Set(candidates)];
}
function signature(filePath) {
    try {
        const stat = node_fs_1.default.statSync(filePath);
        return `${stat.mtimeMs}:${stat.size}`;
    }
    catch {
        return ABSENT;
    }
}
class ConfigWatcher {
    configManager;
    options;
    timer;
    snapshot = new Map();
    constructor(configManager, options = {}) {
        this.configManager = configManager;
        this.options = options;
    }
    paths() {
        return watchCandidates(this.configManager, this.options.cwd);
    }
    start() {
        for (const p of this.paths()) {
            this.snapshot.set(p, signature(p));
        }
        this.timer = setInterval(() => this.tick(), this.options.intervalMs ?? 1000);
        this.timer.unref?.();
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }
    tick() {
        const changed = [];
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
exports.ConfigWatcher = ConfigWatcher;
//# sourceMappingURL=watcher.js.map