"use strict";
/**
 * Gateway process helpers for `ccmr claude`: probe /health, wait for
 * readiness, and auto-start a detached gateway when none is running.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.probeGateway = probeGateway;
exports.waitForHealthy = waitForHealthy;
exports.ensureGatewayRunning = ensureGatewayRunning;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
async function probeGateway(port, timeoutMs = 1500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: controller.signal });
        if (!res.ok) {
            return null;
        }
        return (await res.json());
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(timer);
    }
}
async function waitForHealthy(port, timeoutMs = 10000, intervalMs = 300) {
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
async function ensureGatewayRunning(port, cliScript) {
    const existing = await probeGateway(port);
    if (existing) {
        return { health: existing, autoStarted: false };
    }
    const logDir = node_path_1.default.join(node_os_1.default.homedir(), '.ccmr');
    node_fs_1.default.mkdirSync(logDir, { recursive: true });
    const logFile = node_path_1.default.join(logDir, 'gateway.log');
    const out = node_fs_1.default.openSync(logFile, 'a');
    // Inherit cwd so the gateway discovers the same models.yaml/.env the CLI sees
    const child = (0, node_child_process_1.spawn)(process.execPath, [cliScript, 'start', '--port', String(port)], {
        detached: true,
        stdio: ['ignore', out, out],
        cwd: process.cwd(),
    });
    child.unref();
    node_fs_1.default.closeSync(out);
    const health = await waitForHealthy(port);
    if (!health) {
        return null;
    }
    return { health, autoStarted: true, pid: child.pid, logFile };
}
//# sourceMappingURL=launcher.js.map