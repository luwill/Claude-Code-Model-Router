/**
 * Tests for the Claude Code argument list built by `ccmr claude`.
 */

import { describe, it, expect } from 'vitest';
import { buildClaudeArgs } from '../src/claude-args.js';

describe('buildClaudeArgs: --model keeps the [1m] context suffix', () => {
  it('passes the suffixed launch name, not the raw --model value', () => {
    // Regression: `ccmr claude --model deepseek` forwarded plain "deepseek",
    // overriding ANTHROPIC_MODEL=deepseek[1m] and shrinking the window to 200k.
    const args = buildClaudeArgs(undefined, { model: 'deepseek' }, 'deepseek[1m]', []);
    expect(args).toEqual(['--model', 'deepseek[1m]']);
  });

  it('leaves sub-1M models unsuffixed', () => {
    const args = buildClaudeArgs(undefined, { model: 'kimi' }, 'kimi', []);
    expect(args).toEqual(['--model', 'kimi']);
  });

  it('omits --model when the user did not pass one (ANTHROPIC_MODEL covers it)', () => {
    expect(buildClaudeArgs(undefined, {}, 'deepseek-v4-pro[1m]', [])).toEqual([]);
  });
});

describe('buildClaudeArgs: passthrough', () => {
  it('keeps prompt first, maps known options, and appends unknown args', () => {
    const args = buildClaudeArgs(
      'hello',
      {
        continue: true,
        resume: 'abc',
        print: true,
        outputFormat: 'json',
        allowedTools: ['Bash', 'Read'],
        debug: true,
        verbose: true,
      },
      'm',
      ['--some-new-flag']
    );
    expect(args).toEqual([
      'hello',
      '--continue',
      '--resume', 'abc',
      '--print',
      '--output-format', 'json',
      '--allowed-tools', 'Bash', 'Read',
      '--debug',
      '--verbose',
      '--some-new-flag',
    ]);
  });

  it('distinguishes bare --resume / --debug from ones with a value', () => {
    expect(buildClaudeArgs(undefined, { resume: true, debug: 'api' }, 'm', [])).toEqual([
      '--resume',
      '--debug', 'api',
    ]);
  });
});
