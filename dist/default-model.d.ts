/**
 * Persist the default model into a models.yaml without disturbing the
 * rest of the file (`ccmr use`). A yaml.dump round-trip would strip user
 * comments, so the default_model line is rewritten textually instead.
 */
export declare function updateDefaultModelInYaml(content: string, model: string): string;
export declare function persistDefaultModel(filePath: string, model: string): void;
//# sourceMappingURL=default-model.d.ts.map