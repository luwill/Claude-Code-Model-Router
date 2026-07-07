/**
 * Keeps plaintext .env files out of git: `ccmr init` writes provider API
 * keys into ./.env, so inside a git repo that file must be gitignored
 * before an accidental `git add -A` publishes every key.
 */
export type EnvGuardResult = 'added' | 'present' | 'no-git';
export declare function ensureEnvIgnored(dir: string): EnvGuardResult;
//# sourceMappingURL=env-guard.d.ts.map