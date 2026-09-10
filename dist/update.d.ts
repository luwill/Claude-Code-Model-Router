/**
 * Self-update for the CLI: look up the published version and reinstall
 * globally from npm.
 *
 * The install is spawned with argv arrays and never a shell string, and the
 * package name and dist-tag are literals here, so nothing from the network or
 * the user's config reaches a command line.
 */
export declare const PACKAGE_NAME = "claude-code-model-router";
/**
 * Compare two versions numerically. Negative when `a` is older, positive when
 * newer, zero when equal. A prerelease sorts before its release.
 */
export declare function compareVersions(a: string, b: string): number;
export type UpdatePlan = {
    action: 'up-to-date';
    current: string;
    latest: string;
} | {
    action: 'install';
    current: string;
    latest: string;
};
/**
 * Decide whether to reinstall. A local build ahead of the registry (an
 * unpublished version) counts as up to date -- installing would downgrade it.
 */
export declare function planUpdate(current: string, latest: string): UpdatePlan;
export interface FetchLatestOptions {
    registryUrl?: string;
    timeoutMs?: number;
}
/** Read the published version from the npm registry. */
export declare function fetchLatestVersion(options?: FetchLatestOptions): Promise<string>;
export interface InstallResult {
    command: string;
    exitCode: number | null;
}
/**
 * Run the global install, streaming npm's own output so the user sees
 * progress and any permission error verbatim.
 */
export declare function installLatest(packageManager?: string): Promise<InstallResult>;
//# sourceMappingURL=update.d.ts.map