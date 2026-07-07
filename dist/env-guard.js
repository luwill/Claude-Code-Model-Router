"use strict";
/**
 * Keeps plaintext .env files out of git: `ccmr init` writes provider API
 * keys into ./.env, so inside a git repo that file must be gitignored
 * before an accidental `git add -A` publishes every key.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureEnvIgnored = ensureEnvIgnored;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
function ensureEnvIgnored(dir) {
    if (!node_fs_1.default.existsSync(node_path_1.default.join(dir, '.git'))) {
        return 'no-git';
    }
    const gitignorePath = node_path_1.default.join(dir, '.gitignore');
    const existing = node_fs_1.default.existsSync(gitignorePath) ? node_fs_1.default.readFileSync(gitignorePath, 'utf-8') : '';
    const lines = existing.split(/\r?\n/).map((line) => line.trim());
    if (lines.includes('.env')) {
        return 'present';
    }
    const separator = existing.length === 0 || existing.endsWith('\n') ? '' : '\n';
    const block = `${separator}# API keys (written by ccmr init) - never commit\n.env\n`;
    node_fs_1.default.writeFileSync(gitignorePath, existing + block);
    return 'added';
}
//# sourceMappingURL=env-guard.js.map