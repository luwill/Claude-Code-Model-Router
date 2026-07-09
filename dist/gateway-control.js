"use strict";
/**
 * Discover and stop running gateways (`ccmr status`, `ccmr stop`).
 *
 * A gateway auto-started by `ccmr claude` is detached and reparented to init,
 * so it survives the terminal that spawned it. Without these commands the only
 * way to find or stop one is a `pkill` pattern nobody remembers.
 *
 * Safety: a process is only ever signalled when it self-identifies as a ccmr
 * gateway through /health and reports its own pid. A stranger listening on the
 * port is reported, never killed. This also keeps the implementation free of
 * platform-specific `lsof` / `netstat` parsing.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SCAN_PORTS = void 0;
exports.discoverGateways = discoverGateways;
exports.stopGateway = stopGateway;
const node_net_1 = __importDefault(require("node:net"));
const launcher_js_1 = require("./launcher.js");
/** CLI default (8080), VSCode extension default (8088) and its fallback range. */
exports.DEFAULT_SCAN_PORTS = Array.from({ length: 20 }, (_, i) => 8080 + i);
/** A ccmr gateway always answers /health with a version string. */
function isCcmrGateway(health) {
    return !!health && typeof health.version === 'string';
}
function isPortOpen(port, timeoutMs = 300) {
    return new Promise((resolve) => {
        const socket = node_net_1.default.connect({ port, host: '127.0.0.1' });
        const done = (open) => {
            socket.destroy();
            resolve(open);
        };
        socket.setTimeout(timeoutMs);
        socket.once('connect', () => done(true));
        socket.once('timeout', () => done(false));
        socket.once('error', () => done(false));
    });
}
async function inspect(port, timeoutMs) {
    const health = await (0, launcher_js_1.probeGateway)(port, timeoutMs);
    if (!isCcmrGateway(health) || !health) {
        return null;
    }
    const models = Object.values(health.models ?? {});
    return {
        port,
        pid: health.pid,
        version: health.version,
        default_model: health.default_model,
        config_file: health.config_file ?? null,
        ccmr_home: health.ccmr_home,
        modelsReady: models.filter((status) => status === 'available').length,
        modelsTotal: models.length,
    };
}
async function discoverGateways(ports = exports.DEFAULT_SCAN_PORTS, timeoutMs = 400) {
    const results = await Promise.all(ports.map((port) => inspect(port, timeoutMs)));
    return results.filter((info) => info !== null);
}
async function stopGateway(port, options = {}) {
    const kill = options.kill ?? ((pid, signal) => process.kill(pid, signal));
    const waitMs = options.waitMs ?? 5000;
    const health = await (0, launcher_js_1.probeGateway)(port, 1000);
    if (!isCcmrGateway(health) || !health) {
        // Distinguish "nothing there" from "someone else's server" - we must not
        // kill the latter, and the user needs to know which case they are in.
        return (await isPortOpen(port)) ? { status: 'unknown_process' } : { status: 'not_running' };
    }
    if (typeof health.pid !== 'number') {
        return { status: 'no_pid', version: health.version };
    }
    const pid = health.pid;
    kill(pid, 'SIGTERM');
    if (await waitForPortToClose(port, waitMs)) {
        return { status: 'stopped', pid };
    }
    if (options.force) {
        kill(pid, 'SIGKILL');
        if (await waitForPortToClose(port, 2000)) {
            return { status: 'stopped', pid };
        }
    }
    return { status: 'still_running', pid };
}
async function waitForPortToClose(port, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (!(await isPortOpen(port, 200))) {
            return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
}
//# sourceMappingURL=gateway-control.js.map