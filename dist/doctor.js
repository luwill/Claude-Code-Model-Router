"use strict";
/**
 * Connectivity self-check for configured models (`ccmr doctor`).
 *
 * Sends a minimal real request through the exact same routing path the
 * gateway uses, so endpoint mistakes, auth problems, and account-side
 * blockers (e.g. Volcengine ModelNotOpen) surface at configuration time
 * instead of mid-session.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkModels = checkModels;
const router_js_1 = require("./router.js");
const DEFAULT_DOCTOR_TIMEOUT_SECONDS = 30;
const DEFAULT_DOCTOR_CONCURRENCY = 3;
async function checkModels(configManager, options = {}) {
    const config = configManager.getConfig();
    // Doctor owns this ConfigManager instance; shorten the forwarding timeout
    // so a hung provider does not stall the whole report, and silence the
    // router's per-request logging so the report stays clean.
    config.gateway.timeout = options.timeout ?? DEFAULT_DOCTOR_TIMEOUT_SECONDS;
    config.gateway.enable_logging = false;
    const router = new router_js_1.ModelRouter(configManager);
    const targets = options.models ??
        Object.entries(config.models)
            .filter(([name, model]) => !(model.provider_key && name === model.provider_key))
            .map(([name]) => name);
    const results = new Array(targets.length);
    let nextIndex = 0;
    const worker = async () => {
        while (nextIndex < targets.length) {
            const index = nextIndex++;
            results[index] = await checkOne(configManager, router, targets[index]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(DEFAULT_DOCTOR_CONCURRENCY, targets.length) }, worker));
    return results;
}
async function checkOne(configManager, router, name) {
    const model = configManager.getModel(name);
    if (!model) {
        return {
            model: name,
            displayName: name,
            provider: 'unknown',
            status: 'fail',
            detail: `Model '${name}' not found`,
        };
    }
    const base = {
        model: name,
        displayName: model.display_name,
        provider: model.provider,
    };
    if (!configManager.getApiKey(name)) {
        return { ...base, status: 'skipped', detail: `${model.api_key_env} not set` };
    }
    const started = Date.now();
    try {
        await router.forwardRequest({
            model: name,
            max_tokens: 16,
            messages: [{ role: 'user', content: 'hi' }],
        }, {});
        return { ...base, status: 'ok', latencyMs: Date.now() - started };
    }
    catch (error) {
        const detail = error instanceof router_js_1.RouterError
            ? `[${error.statusCode}] ${error.message}`
            : error instanceof Error
                ? error.message
                : 'Unknown error';
        return { ...base, status: 'fail', latencyMs: Date.now() - started, detail };
    }
}
//# sourceMappingURL=doctor.js.map