"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSetupPlan = buildSetupPlan;
exports.planEnvFileUpdates = planEnvFileUpdates;
exports.applyEnvUpdates = applyEnvUpdates;
exports.pickDefaultModel = pickDefaultModel;
exports.runNonInteractiveSetup = runNonInteractiveSetup;
exports.makeDoctorValidator = makeDoctorValidator;
exports.runInteractiveSetup = runInteractiveSetup;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_readline_1 = __importDefault(require("node:readline"));
const config_js_1 = require("./config.js");
const doctor_js_1 = require("./doctor.js");
const default_model_js_1 = require("./default-model.js");
function buildSetupPlan(configManager) {
    const config = configManager.getConfig();
    const providers = [];
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
    const currentDefaultProviderKey = config.models[currentDefault]?.provider_key ?? null;
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
function planEnvFileUpdates(content, updates) {
    let result = content;
    const skipped = [];
    for (const update of updates) {
        // Tolerate hand-written spacing ("NAME = value") so such lines are
        // filled in place instead of growing a duplicate entry.
        const empty = new RegExp(`^${update.name}\\s*=\\s*$`, 'm');
        const filled = new RegExp(`^${update.name}\\s*=\\s*\\S`, 'm');
        if (empty.test(result)) {
            result = result.replace(empty, `${update.name}=${update.value}`);
        }
        else if (filled.test(result)) {
            skipped.push(update);
        }
        else {
            const separator = result.endsWith('\n') || result === '' ? '' : '\n';
            result = `${result}${separator}${update.name}=${update.value}\n`;
        }
    }
    return { content: result, skipped };
}
function applyEnvUpdates(envFile, updates) {
    const existing = node_fs_1.default.existsSync(envFile) ? node_fs_1.default.readFileSync(envFile, 'utf-8') : '';
    const { content, skipped } = planEnvFileUpdates(existing, updates);
    node_fs_1.default.writeFileSync(envFile, content);
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
function pickDefaultModel(plan, chosenProviders) {
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
/**
 * CI/script path: take whatever keys the environment and .env already
 * provide, persist environment-only keys into .env, optionally validate
 * each provider, and land on a keyed default model. Never prompts.
 */
async function runNonInteractiveSetup(options) {
    const plan = buildSetupPlan(options.configManager);
    const keyed = plan.providers.filter((p) => p.hasKey);
    if (keyed.length === 0) {
        return {
            ok: false,
            reason: 'No API keys configured. Run `ccmr setup` to add them interactively, ' +
                'or export at least one provider key (see `ccmr models`) and retry.',
        };
    }
    const updates = keyed
        .filter((p) => process.env[p.apiKeyEnv])
        .map((p) => ({ name: p.apiKeyEnv, value: process.env[p.apiKeyEnv] }));
    const { written, skipped } = applyEnvUpdates(options.envFile, updates);
    let validation;
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
            (0, default_model_js_1.persistDefaultModel)(configPath, defaultModel);
        }
        else {
            const generated = node_path_1.default.join(node_path_1.default.dirname(options.envFile), 'models.yaml');
            node_fs_1.default.writeFileSync(generated, (0, config_js_1.generateConfigFile)());
            (0, default_model_js_1.persistDefaultModel)(generated, defaultModel);
        }
    }
    return { ok: true, written, skipped, defaultModel, validation };
}
/** Validate one provider through the doctor path (one tiny real request). */
function makeDoctorValidator(configManager) {
    return async (provider) => {
        const results = await (0, doctor_js_1.checkModels)(configManager, { models: [provider.defaultModel], timeout: 20 });
        const first = results[0];
        if (!first)
            return { status: 'fail', detail: 'no result' };
        return { status: first.status === 'ok' ? 'ok' : 'fail', detail: first.detail };
    };
}
// ---------------------------------------------------------------------------
// Interactive flow (TTY or piped stdin). The pure seams above carry the
// decisions; this part only asks questions and prints.
function question(rl, prompt) {
    return new Promise((resolve) => rl.question(prompt, (answer) => resolve(answer.trim())));
}
/**
 * Line-at-a-time reader for piped stdin. Sequential rl.question() calls are
 * unreliable on non-TTY streams (the second question misses its line), so
 * scripted answers go through one shared queue instead.
 */
function makeLineReader(input) {
    const buffered = [];
    const waiting = [];
    let done = false;
    const rl = node_readline_1.default.createInterface({ input });
    rl.on('line', (line) => {
        const resolve = waiting.shift();
        if (resolve)
            resolve(line);
        else
            buffered.push(line);
    });
    rl.on('close', () => {
        done = true;
        while (waiting.length > 0)
            waiting.shift()('');
    });
    return {
        next: () => buffered.length > 0
            ? Promise.resolve(buffered.shift())
            : done
                ? Promise.resolve('')
                : new Promise((resolve) => waiting.push(resolve)),
        close: () => rl.close(),
    };
}
/** Hidden input for secrets: raw-mode key-by-key on a TTY. */
function questionHidden(prompt) {
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
        const onData = (chunk) => {
            const s = chunk.toString('utf8');
            if (s === '\r' || s === '\n') {
                cleanup();
                process.stdout.write('\n');
                stdin.pause();
                resolve(buffer.trim());
            }
            else if (s === '\u0003') {
                cleanup();
                process.stdout.write('\n');
                process.exit(130);
            }
            else if (s === '\u007f' || s === '\b') {
                buffer = buffer.slice(0, -1);
            }
            else {
                buffer += s;
            }
        };
        stdin.on('data', onData);
    });
}
function makePrompter() {
    if (process.stdin.isTTY) {
        const rl = node_readline_1.default.createInterface({ input: process.stdin, output: process.stdout });
        return {
            ask: (prompt) => question(rl, prompt),
            secret: (prompt) => questionHidden(prompt),
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
async function runInteractiveSetup(options) {
    const plan = buildSetupPlan(options.configManager);
    const prompter = makePrompter();
    console.log('');
    console.log('Providers (key status from environment and .env):');
    console.log('');
    plan.providers.forEach((p, index) => {
        const status = p.hasKey ? '\x1b[32m[Key set]\x1b[0m' : '\x1b[33m[no key]\x1b[0m';
        console.log(`  ${String(index + 1).padStart(2)}. ${p.displayName.padEnd(24)} ${p.apiKeyEnv.padEnd(22)} ${status}`);
    });
    console.log('');
    console.log(`Keys will be written to: ${options.envFile}`);
    const updates = [];
    let selection = await prompter.ask('Configure which providers? (e.g. 1,3 or all — Enter to skip) ');
    while (selection) {
        const picks = selection.toLowerCase() === 'all'
            ? plan.providers.map((_, i) => i)
            : selection
                .split(/[\s,]+/)
                .map((token) => Number(token) - 1)
                .filter((i) => Number.isInteger(i) && i >= 0 && i < plan.providers.length);
        for (const index of picks) {
            const provider = plan.providers[index];
            if (!provider || provider.hasKey)
                continue;
            console.log('');
            const url = provider.consoleUrl ? ` (get one: ${provider.consoleUrl})` : '';
            const key = await prompter.secret(`Paste ${provider.apiKeyEnv} for ${provider.displayName}${url}: `);
            if (key) {
                updates.push({ name: provider.apiKeyEnv, value: key });
            }
        }
        selection = await prompter.ask('More providers? (numbers, or Enter to continue) ');
    }
    const { written, skipped } = updates.length > 0 ? applyEnvUpdates(options.envFile, updates) : { written: [], skipped: [] };
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
    let validation;
    const wantsValidation = await prompter.ask('Verify keys now with one tiny request per provider? [y/N] ');
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
    let defaultModel = null;
    const justConfigured = freshPlan.providers
        .filter((p) => updates.some((u) => u.name === p.apiKeyEnv))
        .map((p) => p.providerKey);
    const pick = pickDefaultModel(freshPlan, justConfigured);
    if (pick) {
        let answer = '';
        for (let attempt = 0; attempt < 3; attempt++) {
            answer = await prompter.ask(`Default model [${pick}] (Enter = accept, k = keep ${freshPlan.currentDefault}, n = skip): `);
            // Anything but '', 'k' or 'n' is a slip: re-ask instead of silently
            // accepting the suggestion. EOF (piped stdin) yields '' on the first
            // round, so the loop still terminates.
            if (['', 'k', 'n'].includes(answer.toLowerCase()))
                break;
            console.log(`  Unrecognized answer '${answer}' - Enter, k or n.`);
        }
        if (answer.toLowerCase() !== 'n') {
            defaultModel = answer.toLowerCase() === 'k' ? freshPlan.currentDefault : pick;
        }
    }
    if (defaultModel) {
        const configPath = freshManager.getConfigFilePath();
        if (configPath) {
            (0, default_model_js_1.persistDefaultModel)(configPath, defaultModel);
        }
        else {
            const generated = node_path_1.default.join(node_path_1.default.dirname(options.envFile), 'models.yaml');
            node_fs_1.default.writeFileSync(generated, (0, config_js_1.generateConfigFile)());
            (0, default_model_js_1.persistDefaultModel)(generated, defaultModel);
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
    return { ok: true, written, skipped, defaultModel, validation };
}
//# sourceMappingURL=setup.js.map