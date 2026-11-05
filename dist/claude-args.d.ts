/**
 * Builds the argument list `ccmr claude` hands to the Claude Code binary.
 */
/** The subset of `ccmr claude` options forwarded to Claude Code. */
export interface ClaudeLaunchOptions {
    continue?: boolean;
    resume?: string | true;
    forkSession?: boolean;
    dangerouslySkipPermissions?: boolean;
    permissionMode?: string;
    print?: boolean;
    outputFormat?: string;
    inputFormat?: string;
    allowedTools?: string[];
    disallowedTools?: string[];
    model?: string;
    systemPrompt?: string;
    appendSystemPrompt?: string;
    addDir?: string[];
    debug?: string | true;
    verbose?: boolean;
    ide?: boolean;
}
/**
 * @param launchModelName The --model value with its [1m] suffix already
 *   applied. Forwarding the raw `options.model` instead would override
 *   ANTHROPIC_MODEL and drop Claude Code back to a ~200k window.
 */
export declare function buildClaudeArgs(prompt: string | undefined, options: ClaudeLaunchOptions, launchModelName: string, unknownArgs: string[]): string[];
//# sourceMappingURL=claude-args.d.ts.map