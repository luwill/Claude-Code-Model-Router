/**
 * Persist the default model into a models.yaml without disturbing the
 * rest of the file (`ccmr use`). A yaml.dump round-trip would strip user
 * comments, so the default_model line is rewritten textually instead.
 */

import fs from 'node:fs';

export function updateDefaultModelInYaml(content: string, model: string): string {
  const line = `default_model: ${model}`;
  if (/^default_model:[^\n]*$/m.test(content)) {
    return content.replace(/^default_model:[^\n]*$/m, line);
  }
  return `${line}\n${content}`;
}

export function persistDefaultModel(filePath: string, model: string): void {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  fs.writeFileSync(filePath, updateDefaultModelInYaml(existing, model));
}
