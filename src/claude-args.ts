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
export function buildClaudeArgs(
  prompt: string | undefined,
  options: ClaudeLaunchOptions,
  launchModelName: string,
  unknownArgs: string[]
): string[] {
  const args: string[] = [];

  if (prompt) args.push(prompt);

  // Session options
  if (options.continue) args.push('--continue');
  if (options.resume !== undefined) {
    if (options.resume === true) {
      args.push('--resume');
    } else {
      args.push('--resume', options.resume);
    }
  }
  if (options.forkSession) args.push('--fork-session');

  // Permission options
  if (options.dangerouslySkipPermissions) args.push('--dangerously-skip-permissions');
  if (options.permissionMode) args.push('--permission-mode', options.permissionMode);

  // Output options
  if (options.print) args.push('--print');
  if (options.outputFormat) args.push('--output-format', options.outputFormat);
  if (options.inputFormat) args.push('--input-format', options.inputFormat);

  // Tool options
  if (options.allowedTools) args.push('--allowed-tools', ...options.allowedTools);
  if (options.disallowedTools) args.push('--disallowed-tools', ...options.disallowedTools);

  // Other options
  if (options.model) args.push('--model', launchModelName);
  if (options.systemPrompt) args.push('--system-prompt', options.systemPrompt);
  if (options.appendSystemPrompt) args.push('--append-system-prompt', options.appendSystemPrompt);
  if (options.addDir) args.push('--add-dir', ...options.addDir);
  if (options.debug !== undefined) {
    if (options.debug === true) {
      args.push('--debug');
    } else {
      args.push('--debug', options.debug);
    }
  }
  if (options.verbose) args.push('--verbose');
  if (options.ide) args.push('--ide');

  // Pass through any unknown options (collected by allowUnknownOption)
  args.push(...unknownArgs);

  return args;
}
