import fs from 'node:fs';
import path from 'node:path';

interface PackageMetadata {
  version?: string;
}

function readPackageVersion(): string {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as PackageMetadata;

  return packageJson.version ?? '0.0.0';
}

export const VERSION = readPackageVersion();
