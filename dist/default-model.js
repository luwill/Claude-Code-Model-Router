"use strict";
/**
 * Persist the default model into a models.yaml without disturbing the
 * rest of the file (`ccmr use`). A yaml.dump round-trip would strip user
 * comments, so the default_model line is rewritten textually instead.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDefaultModelInYaml = updateDefaultModelInYaml;
exports.persistDefaultModel = persistDefaultModel;
const node_fs_1 = __importDefault(require("node:fs"));
function updateDefaultModelInYaml(content, model) {
    const line = `default_model: ${model}`;
    if (/^default_model:[^\n]*$/m.test(content)) {
        return content.replace(/^default_model:[^\n]*$/m, line);
    }
    return `${line}\n${content}`;
}
function persistDefaultModel(filePath, model) {
    const existing = node_fs_1.default.existsSync(filePath) ? node_fs_1.default.readFileSync(filePath, 'utf-8') : '';
    node_fs_1.default.writeFileSync(filePath, updateDefaultModelInYaml(existing, model));
}
//# sourceMappingURL=default-model.js.map