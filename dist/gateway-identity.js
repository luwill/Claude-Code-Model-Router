"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.newGatewayInstanceId = newGatewayInstanceId;
exports.gatewayIdentityFile = gatewayIdentityFile;
exports.writeGatewayIdentity = writeGatewayIdentity;
exports.readGatewayIdentity = readGatewayIdentity;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const paths_js_1 = require("./paths.js");
function newGatewayInstanceId() {
    return node_crypto_1.default.randomBytes(24).toString('hex');
}
function gatewayIdentityFile(port) {
    return node_path_1.default.join((0, paths_js_1.ccmrHome)(), `gateway-${port}.identity.json`);
}
function writeGatewayIdentity(port, instanceId) {
    const file = gatewayIdentityFile(port);
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(file), { recursive: true, mode: 0o700 });
    const identity = { pid: process.pid, port, instanceId };
    node_fs_1.default.writeFileSync(file, JSON.stringify(identity), { mode: 0o600 });
    try {
        node_fs_1.default.chmodSync(file, 0o600);
    }
    catch {
        // Best effort on filesystems/platforms without POSIX modes.
    }
}
function readGatewayIdentity(port) {
    try {
        const parsed = JSON.parse(node_fs_1.default.readFileSync(gatewayIdentityFile(port), 'utf-8'));
        if (parsed.port !== port ||
            !Number.isInteger(parsed.pid) ||
            parsed.pid <= 0 ||
            typeof parsed.instanceId !== 'string' ||
            parsed.instanceId.length < 32) {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=gateway-identity.js.map