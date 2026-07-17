"use strict";
/**
 * Gateway process helpers for `ccmr claude`: probe /health, wait for
 * readiness, and auto-start a detached gateway when none is running.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkGatewaySource = checkGatewaySource;
exports.checkGatewayModel = checkGatewayModel;
exports.availableModels = availableModels;
exports.probeGateway = probeGateway;
exports.waitForHealthy = waitForHealthy;
exports.ensureGatewayRunning = ensureGatewayRunning;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const paths_js_1 = require("./paths.js");
/** Refuse to reuse a detached gateway whose project/config provenance differs. */
function checkGatewaySource(health, expectedSourceId) {
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
function checkGatewayModel(health, modelKey) {
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
function availableModels(health) {
    return Object.entries(health.models ?? {})
        .filter(([, status]) => status === 'available')
        .map(([key]) => key);
}
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
    // Follows CCMR_HOME, so config and logs never end up in different places
    const logFile = (0, paths_js_1.gatewayLogFile)();
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(logFile), { recursive: true });
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