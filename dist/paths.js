"use strict";
/**
 * Shared filesystem locations. CCMR_HOME overrides the default ~/.ccmr
 * (also handy for test isolation).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ccmrHome = ccmrHome;
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
function ccmrHome() {
    return process.env.CCMR_HOME || node_path_1.default.join(node_os_1.default.homedir(), '.ccmr');
}
//# sourceMappingURL=paths.js.map