"use strict";
/**
 * Self-update for the CLI: look up the published version and reinstall
 * globally from npm.
 *
 * The install is spawned with argv arrays and never a shell string, and the
 * package name and dist-tag are literals here, so nothing from the network or
 * the user's config reaches a command line.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PACKAGE_NAME = void 0;
exports.compareVersions = compareVersions;
exports.planUpdate = planUpdate;
exports.fetchLatestVersion = fetchLatestVersion;
exports.installLatest = installLatest;
const node_child_process_1 = require("node:child_process");
exports.PACKAGE_NAME = 'claude-code-model-router';
const DEFAULT_REGISTRY_URL = `https://registry.npmjs.org/${exports.PACKAGE_NAME}/latest`;
const DEFAULT_TIMEOUT_MS = 10_000;
/** Split "1.20.0-beta.1" into numeric core segments plus a prerelease tag. */
function parseVersion(version) {
    const [core, ...rest] = version.trim().split('-');
    return {
        core: core.split('.').map((segment) => Number.parseInt(segment, 10) || 0),
        prerelease: rest.join('-'),
    };
}
/**
 * Compare two versions numerically. Negative when `a` is older, positive when
 * newer, zero when equal. A prerelease sorts before its release.
 */
function compareVersions(a, b) {
    const left = parseVersion(a);
    const right = parseVersion(b);
    const segments = Math.max(left.core.length, right.core.length);
    for (let i = 0; i < segments; i += 1) {
        const diff = (left.core[i] ?? 0) - (right.core[i] ?? 0);
        if (diff !== 0) {
            return diff;
        }
    }
    if (left.prerelease === right.prerelease) {
        return 0;
    }
    if (!left.prerelease) {
        return 1;
    }
    if (!right.prerelease) {
        return -1;
    }
    return left.prerelease < right.prerelease ? -1 : 1;
}
/**
 * Decide whether to reinstall. A local build ahead of the registry (an
 * unpublished version) counts as up to date -- installing would downgrade it.
 */
function planUpdate(current, latest) {
    const action = compareVersions(latest, current) > 0 ? 'install' : 'up-to-date';
    return { action, current, latest };
}
/** Read the published version from the npm registry. */
async function fetchLatestVersion(options = {}) {
    const url = options.registryUrl ?? DEFAULT_REGISTRY_URL;
    const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) {
        throw new Error(`Registry request failed with HTTP ${response.status}`);
    }
    const document = (await response.json());
    if (typeof document.version !== 'string' || !document.version.trim()) {
        throw new Error('Registry response carried no version field');
    }
    return document.version.trim();
}
/**
 * Run the global install, streaming npm's own output so the user sees
 * progress and any permission error verbatim.
 */
async function installLatest(packageManager = 'npm') {
    const args = ['install', '-g', `${exports.PACKAGE_NAME}@latest`];
    const command = `${packageManager} ${args.join(' ')}`;
    const exitCode = await new Promise((resolve, reject) => {
        const child = (0, node_child_process_1.spawn)(packageManager, args, { stdio: 'inherit', shell: false });
        child.on('error', reject);
        child.on('close', resolve);
    });
    return { command, exitCode };
}
//# sourceMappingURL=update.js.map