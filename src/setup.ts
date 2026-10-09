/**
 * Guided first-run configuration (`ccmr setup`).
 *
 * The audit's H1 finding: after `ccmr init` the user was left alone with a
 * generated .env of 18 empty variables and vendor console URLs buried in
 * comments. setup closes that gap with one command: it shows which
 * providers already have keys, asks for the missing ones (hidden input),
 * optionally verifies each with the same tiny request `ccmr doctor` uses,
 * writes the .env in place, and lands the user on a keyed default model.
 *
 * Every decision-making piece is a pure, tested seam; only the TTY prompt
 * loop lives outside them. `--yes` runs the whole flow non-interactively
 * from whatever keys the environment already provides (CI-friendly).
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import type { ConfigManager } from './config.js';
import { generateConfigFile } from './config.js';
import { checkModels } from './doctor.js';
import { persistDefaultModel } from './default-model.js';

export interface ProviderStatus {
  /** Config-level key, e.g. 'deepseek' or 'kimi-plan'. */
  providerKey: string;
  displayName: string;
  /** Vendor id, e.g. 'moonshot-code'. */
  providerName: string;
  apiKeyEnv: string;
  consoleUrl?: string;
  /** Canonical model key of the provider's default variant. */
  defaultModel: string;
  hasKey: boolean;
}

export interface SetupPlan {
  providers: ProviderStatus[];
  currentDefault: string;
  currentDefaultProviderKey: string | null;
  /** First keyed provider's default model, or null when nothing is keyed. */
  suggestedDefault: string | null;
}

export interface EnvUpdate {
  name: string;
  value: string;
}

export interface EnvUpdateResult {
  written: EnvUpdate[];
  skipped: EnvUpdate[];
}

export interface ValidationOutcome {
  providerKey: string;
  model: string;
  status: 'ok' | 'fail';
  detail?: string;
}

export interface SetupOutcome {
  ok: boolean;
  reason?: string;
  written?: EnvUpdate[];
  skipped?: EnvUpdate[];
  defaultModel?: string | null;
  validation?: ValidationOutcome[];
  /** True when --validate ran and every provider failed: the CLI turns this into exit 1 (CI gate). */
  allValidationsFailed?: boolean;
}

export type ProviderValidator = (
  provider: ProviderStatus
) => Promise<{ status: 'ok' | 'fail'; detail?: string }>;

export function buildSetupPlan(configManager: ConfigManager): SetupPlan {
  const config = configManager.getConfig();
  const providers: ProviderStatus[] = [];

  for (const [providerKey, provider] of Object.entries(config.providers ?? {})) {
    const defaultVariant = provider.default_variant ?? Object.keys(provider.variants)[0];
    let defaultModel = providerKey;
    for (const [name, model] of Object.entries(config.models)) {
      if (model.provider_key === providerKey && model.variant_key === defaultVariant) {
        defaultModel = name;
        break;
      }
    }
    providers.push({
      providerKey,
      displayName: provider.display_name ?? providerKey,
      providerName: provider.provider,
      apiKeyEnv: provider.api_key_env,
      consoleUrl: provider.console_url,
      defaultModel,
      hasKey: Boolean(configManager.getApiKey(defaultModel)),
    });
  }

  const currentDefault = config.default_model;
  const currentDefaultProviderKey =
    config.models[currentDefault]?.provider_key ?? null;
  const firstKeyed = providers.find((p) => p.hasKey) ?? null;

  return {
    providers,
    currentDefault,
    currentDefaultProviderKey,
    suggestedDefault: firstKeyed ? firstKeyed.defaultModel : null,
  };
}

/**
 * Rewrite .env content for the given updates: empty `NAME=` slots are
 * filled in place, names with an existing value are never touched, and
 * unknown names are appended. Comments and layout survive.
 */
export function planEnvFileUpdates(
  content: string,
  updates: EnvUpdate[]
): { content: string; skipped: EnvUpdate[] } {
  let result = content;
  const skipped: EnvUpdate[] = [];

  for (const update of updates) {
    // Tolerate hand-written spacing ("NAME = value") so such lines are
    // filled in place instead of growing a duplicate entry.
    const empty = new RegExp(`^${update.name}\\s*=\\s*$`, 'm');
    const filled = new RegExp(`^${update.name}\\s*=\\s*\\S`, 'm');
    if (empty.test(result)) {
      result = result.replace(empty, `${update.name}=${update.value}`);
    } else if (filled.test(result)) {
      skipped.push(update);
    } else {
      const separator = result.endsWith('\n') || result === '' ? '' : '\n';
      result = `${result}${separator}${update.name}=${update.value}\n`;
    }
  }

  return { content: result, skipped };
}

export function applyEnvUpdates(envFile: string, updates: EnvUpdate[]): EnvUpdateResult {
  const existing = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf-8') : '';
  const { content, skipped } = planEnvFileUpdates(existing, updates);
  fs.writeFileSync(envFile, content);
  const skippedNames = new Set(skipped.map((s) => s.name));
  return {
    written: updates.filter((u) => !skippedNames.has(u.name)),
    skipped,
  };
}

/**
 * The default model after setup: keep the current one when its provider is
 * keyed; otherwise move to the first keyed provider (chosen list first).
 */
export function pickDefaultModel(plan: SetupPlan, chosenProviders: string[]): string | null {
  const current = plan.providers.find((p) => p.providerKey === plan.currentDefaultProviderKey);
  if (current?.hasKey) {
    return plan.currentDefault;
  }
  const byChoice = chosenProviders
    .map((key) => plan.providers.find((p) => p.providerKey === key))
    .find((p) => p?.hasKey);
  const target = byChoice ?? plan.providers.find((p) => p.hasKey);
  return target ? target.defaultModel : null;
}

export interface NonInteractiveOptions {
  configManager: ConfigManager;
  envFile: string;
  validate: boolean;
  validateProvider?: ProviderValidator;
}

/**
 * CI/script path: take whatever keys the environment and .env already
 * provide, persist environment-only keys into .env, optionally validate
 * each provider, and land on a keyed default model. Never prompts.
 */
export async function runNonInteractiveSetup(
  options: NonInteractiveOptions
): Promise<SetupOutcome> {
  const plan = buildSetupPlan(options.configManager);
  const keyed = plan.providers.filter((p) => p.hasKey);
  if (keyed.length === 0) {
    return {
      ok: false,
      reason:
        'No API keys configured. Run `ccmr setup` to add them interactively, ' +
        'or export at least one provider key (see `ccmr models`) and retry.',
    };
  }

  const updates = keyed
    .filter((p) => process.env[p.apiKeyEnv])
    .map((p) => ({ name: p.apiKeyEnv, value: process.env[p.apiKeyEnv] as string }));
  const { written, skipped } = applyEnvUpdates(options.envFile, updates);

  let validation: ValidationOutcome[] | undefined;
  if (options.validate) {
    const validate = options.validateProvider ?? makeDoctorValidator(options.configManager);
    validation = [];
    for (const provider of keyed) {
      const result = await validate(provider);
      validation.push({
        providerKey: provider.providerKey,
        model: provider.defaultModel,
        status: result.status,
        detail: result.detail,
      });
    }
  }

  const defaultModel = pickDefaultModel(plan, keyed.map((p) => p.providerKey));
  if (defaultModel) {
    const configPath = options.configManager.getConfigFilePath();
    if (configPath) {
      persistDefaultModel(configPath, defaultModel);
    } else {
      const generated = path.join(path.dirname(options.envFile), 'models.yaml');
      fs.writeFileSync(generated, generateConfigFile());
      persistDefaultModel(generated, defaultModel);
    }
  }

  const allValidationsFailed =
    validation !== undefined && validation.length > 0 && validation.every((v) => v.status === 'fail');

  return { ok: true, written, skipped, defaultModel, validation, allValidationsFailed };
}

/** Validate one provider through the doctor path (one tiny real request). */
export function makeDoctorValidator(configManager: ConfigManager): ProviderValidator {
  return async (provider) => {
    const results = await checkModels(configManager, { models: [provider.defaultModel], timeout: 20 });
    const first = results[0];
    if (!first) return { status: 'fail', detail: 'no result' };
    return { status: first.status === 'ok' ? 'ok' : 'fail', detail: first.detail };
  };
}



// ---------------------------------------------------------------------------
// Interactive flow (TTY or piped stdin). The pure seams above carry the
// decisions; this part only asks questions and prints.

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, (answer) => resolve(answer.trim())));
}

/**
 * Line-at-a-time reader for piped stdin. Sequential rl.question() calls are
 * unreliable on non-TTY streams (the second question misses its line), so
 * scripted answers go through one shared queue instead.
 */
function makeLineReader(
  input: NodeJS.ReadableStream
): { next: () => Promise<string>; close: () => void } {
  const buffered: string[] = [];
  const waiting: Array<(line: string) => void> = [];
  let done = false;
  const rl = readline.createInterface({ input });
  rl.on('line', (line: string) => {
    const resolve = waiting.shift();
    if (resolve) resolve(line);
    else buffered.push(line);
  });
  rl.on('close', () => {
    done = true;
    while (waiting.length > 0) waiting.shift()!('');
  });
  return {
    next: () =>
      buffered.length > 0
        ? Promise.resolve(buffered.shift()!)
        : done
          ? Promise.resolve('')
          : new Promise((resolve) => waiting.push(resolve)),
    close: () => rl.close(),
  };
}

/** Hidden input for secrets: raw-mode key-by-key on a TTY. */
function questionHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    if (!stdin.isTTY || !stdin.setRawMode) {
      resolve('');
      return;
    }
    process.stdout.write(prompt);
    let buffer = '';
    const wasRaw = stdin.isRaw ?? false;
    stdin.setRawMode(true);
    stdin.resume();
    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(wasRaw);
    };
    const onData = (chunk: Buffer) => {
      const s = chunk.toString('utf8');
      if (s === '\r' || s === '\n') {
        cleanup();
        process.stdout.write('\n');
        stdin.pause();
        // A pasted key can carry interior newlines/controls; keys never
        // contain them, so strip rather than write a corrupt entry.
        resolve(buffer.replace(/[\x00-\x1f\x7f]/g, '').trim());
      } else if (s === '\u0003') {
        cleanup();
        process.stdout.write('\n');
        process.exit(130);
      } else if (s === '\u0004') {
        // Ctrl+D is the reflex "abort this prompt" key elsewhere; here it
        // must not be swallowed into the key (final-adversary round).
        cleanup();
        process.stdout.write('\n');
        stdin.pause();
        resolve('');
      } else if (s === '\u007f' || s === '\b') {
        buffer = buffer.slice(0, -1);
      } else {
        buffer += s;
      }
    };
    stdin.on('data', onData);
  });
}

interface Prompter {
  ask(prompt: string): Promise<string>;
  secret(prompt: string): Promise<string>;
  close(): void;
}

function makePrompter(): Prompter {
  if (process.stdin.isTTY) {
    // One reader at a time: readline software-echoes every keystroke, so a
    // live interface must not stay attached while questionHidden reads the
    // secret in raw mode (round-1 review: the key echoed in cleartext).
    // Closing before and recreating after is the proven pattern.
    let rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return {
      ask: (prompt) => question(rl, prompt),
      secret: async (prompt) => {
        rl.close();
        try {
          return await questionHidden(prompt);
        } finally {
          rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        }
      },
      close: () => rl.close(),
    };
  }
  const reader = makeLineReader(process.stdin);
  return {
    ask: async (prompt) => {
      process.stdout.write(prompt);
      return reader.next();
    },
    secret: async (prompt) => {
      process.stdout.write(prompt);
      return reader.next();
    },
    close: () => reader.close(),
  };
}

export interface InteractiveOptions {
  configManager: ConfigManager;
  envFile: string;
}

export async function runInteractiveSetup(options: InteractiveOptions): Promise<SetupOutcome> {
  const plan = buildSetupPlan(options.configManager);
  const prompter = makePrompter();

  console.log('');
  console.log('Providers (key status from environment and .env):');
  console.log('');
  plan.providers.forEach((p, index) => {
    const status = p.hasKey ? '\x1b[32m[Key set]\x1b[0m' : '\x1b[33m[no key]\x1b[0m';
    console.log(
      `  ${String(index + 1).padStart(2)}. ${p.displayName.padEnd(24)} ${p.apiKeyEnv.padEnd(22)} ${status}`
    );
  });
  console.log('');
  console.log(`Keys will be written to: ${options.envFile}`);

  const updates: EnvUpdate[] = [];
  let selection = await prompter.ask(
    'Configure which providers? (e.g. 1,3 or all — Enter to skip) '
  );
  while (selection) {
    const picks =
      selection.toLowerCase() === 'all'
        ? plan.providers.map((_, i) => i)
        : selection
            .split(/[\s,]+/)
            .map((token) => Number(token) - 1)
            .filter((i) => Number.isInteger(i) && i >= 0 && i < plan.providers.length);
    for (const index of picks) {
      const provider = plan.providers[index];
      if (!provider || provider.hasKey) continue;
      console.log('');
      const url = provider.consoleUrl ? ` (get one: ${provider.consoleUrl})` : '';
      const key = await prompter.secret(
        `Paste ${provider.apiKeyEnv} for ${provider.displayName}${url}: `
      );
      if (key) {
        updates.push({ name: provider.apiKeyEnv, value: key });
      }
    }
    selection = await prompter.ask('More providers? (numbers, or Enter to continue) ');
  }

  const { written, skipped } =
    updates.length > 0 ? applyEnvUpdates(options.envFile, updates) : { written: [], skipped: [] };
  if (written.length > 0) {
    console.log(`\x1b[32m[OK]\x1b[0m Wrote ${written.length} key(s) to ${options.envFile}`);
    // The .env file is only parsed at ConfigManager construction; mirror the
    // freshly pasted values into process.env so the plan below sees them.
    for (const update of written) {
      process.env[update.name] = update.value;
    }
  }
  for (const skip of skipped) {
    console.log(`\x1b[33m[SKIP]\x1b[0m ${skip.name} already has a value in ${options.envFile}`);
  }

  // Rebuild the plan so freshly written keys count as configured.
  const freshManager = options.configManager;
  freshManager.reloadApiKeys();
  const freshPlan = buildSetupPlan(freshManager);
  const keyed = freshPlan.providers.filter((p) => p.hasKey);

  if (keyed.length === 0) {
    prompter.close();
    return { ok: false, written, skipped, reason: 'No keys configured — nothing to validate.' };
  }

  let validation: ValidationOutcome[] | undefined;
  const wantsValidation = await prompter.ask(
    'Verify keys now with one tiny request per provider? [y/N] '
  );
  if (wantsValidation.toLowerCase().startsWith('y')) {
    const validate = makeDoctorValidator(freshManager);
    validation = [];
    for (const provider of keyed) {
      console.log(`  checking ${provider.displayName} (${provider.defaultModel})...`);
      const result = await validate(provider);
      validation.push({
        providerKey: provider.providerKey,
        model: provider.defaultModel,
        status: result.status,
        detail: result.detail,
      });
      const mark = result.status === 'ok' ? '\x1b[32m[OK]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
      const detail = result.detail ? ` ${result.detail}` : '';
      console.log(`  ${mark} ${provider.displayName}${detail}`);
    }
  }

  let defaultModel: string | null = null;
  const justConfigured = freshPlan.providers
    .filter((p) => updates.some((u) => u.name === p.apiKeyEnv))
    .map((p) => p.providerKey);
  const pick = pickDefaultModel(freshPlan, justConfigured);
  if (pick) {
    let answer = '';
    let recognized = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      answer = await prompter.ask(
        `Default model [${pick}] (Enter = accept, k = keep ${freshPlan.currentDefault}, n = skip): `
      );
      // Anything but '', 'k' or 'n' is a slip: re-ask instead of silently
      // accepting the suggestion. EOF (piped stdin) yields '' on the first
      // round, so the loop still terminates.
      if (['', 'k', 'n'].includes(answer.toLowerCase())) {
        recognized = true;
        break;
      }
      console.log(`  Unrecognized answer '${answer}' - Enter, k or n.`);
    }
    if (!recognized) {
      // Three unrecognized answers mean confusion, not consent: change
      // nothing rather than accept the suggestion (final-audit F5).
      console.log('  Skipping default-model change after 3 unrecognized answers.');
      answer = 'n';
    }
    if (answer.toLowerCase() !== 'n') {
      defaultModel = answer.toLowerCase() === 'k' ? freshPlan.currentDefault : pick;
    }
  }
  if (defaultModel) {
    const configPath = freshManager.getConfigFilePath();
    if (configPath) {
      persistDefaultModel(configPath, defaultModel);
    } else {
      const generated = path.join(path.dirname(options.envFile), 'models.yaml');
      fs.writeFileSync(generated, generateConfigFile());
      persistDefaultModel(generated, defaultModel);
    }
    console.log(`\x1b[32m[OK]\x1b[0m Default model: ${defaultModel}`);
  }

  prompter.close();
  console.log('');
  console.log('Next steps:');
  console.log('  ccmr claude    # start Claude Code through the gateway');
  console.log('  ccmr doctor    # full connectivity report');
  console.log('  ccmr models    # list models and switch defaults');
  console.log('');
  const allValidationsFailed =
    validation !== undefined && validation.length > 0 && validation.every((v) => v.status === 'fail');

  return { ok: true, written, skipped, defaultModel, validation, allValidationsFailed };
}
