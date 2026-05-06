"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
function readPackageVersion() {
    const packageJsonPath = node_path_1.default.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(node_fs_1.default.readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version ?? '0.0.0';
}
exports.VERSION = readPackageVersion();
//# sourceMappingURL=version.js.map