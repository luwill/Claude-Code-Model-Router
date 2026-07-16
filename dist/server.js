"use strict";
/**
 * Express server for Claude Code Model Router
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const paths_js_1 = require("./paths.js");
const router_js_1 = require("./router.js");
const usage_js_1 = require("./usage.js");
const version_js_1 = require("./version.js");
const watcher_js_1 = require("./watcher.js");
const logging_js_1 = require("./logging.js");
const gateway_identity_js_1 = require("./gateway-identity.js");
function requiredAuthToken() {
    return (process.env.CCMR_REQUIRED_AUTH_TOKEN ?? '').trim();
}
function requestToken(req) {
    const raw = req.headers['x-api-key'] ?? req.headers.authorization ?? '';
    return String(raw).replace(/^Bearer\s+/i, '').trim();
}
function isAuthorized(req, token = requiredAuthToken()) {
    return token.length > 0 && tokensEqual(requestToken(req), token);
}
function isLoopbackRequest(req) {
    const address = req.socket.remoteAddress ?? '';
    return (address === '::1' ||
        address === '127.0.0.1' ||
        address === '::ffff:127.0.0.1' ||
        address.startsWith('127.'));
}
function clientAbortController(req, res) {
    const controller = new AbortController();
    const abort = () => {
        if (!res.writableEnded && !controller.signal.aborted) {
            controller.abort(new Error('Client disconnected'));
        }
    };
    req.once('aborted', abort);
    res.once('close', abort);
    return {
        controller,
        cleanup: () => {
            req.off('aborted', abort);
            res.off('close', abort);
        },
    };
}
async function writeWithBackpressure(res, chunk, signal) {
    if (signal.aborted || res.destroyed) {
        return false;
    }
    if (res.write(chunk)) {
        return true;
    }
    await new Promise((resolve) => {
        const done = () => {
            res.off('drain', done);
            res.off('close', done);
            signal.removeEventListener('abort', done);
            resolve();
        };
        res.once('drain', done);
        res.once('close', done);
        signal.addEventListener('abort', done, { once: true });
    });
    return !signal.aborted && !res.destroyed;
}
function requestValidationError(body) {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        return 'Request body must be a JSON object';
    }
    const request = body;
    if (request.model !== undefined && (typeof request.model !== 'string' || !request.model.trim())) {
        return 'model must be a non-empty string';
    }
    if (!Array.isArray(request.messages) || request.messages.length === 0) {
        return 'messages must be a non-empty array';
    }
    for (const [index, message] of request.messages.entries()) {
        if (!message || (message.role !== 'user' && message.role !== 'assistant')) {
            return `messages[${index}].role must be user or assistant`;
        }
        if (typeof message.content !== 'string' && !Array.isArray(message.content)) {
            return `messages[${index}].content must be a string or content-block array`;
        }
    }
    if (request.max_tokens !== undefined &&
        (!Number.isInteger(request.max_tokens) || request.max_tokens <= 0)) {
        return 'max_tokens must be a positive integer';
    }
    if (request.stream !== undefined && typeof request.stream !== 'boolean') {
        return 'stream must be a boolean';
    }
    if (request.tools !== undefined && !Array.isArray(request.tools)) {
        return 'tools must be an array';
    }
    return null;
}
function originalAnthropicHeaders(req) {
    const headers = {};
    if (req.headers['anthropic-beta']) {
        headers['anthropic-beta'] = String(req.headers['anthropic-beta']);
    }
    if (req.headers['anthropic-version']) {
        headers['anthropic-version'] = String(req.headers['anthropic-version']);
    }
    return headers;
}
function sendInvalidRequest(res, message) {
    res.status(400).json({
        type: 'error',
        error: { type: 'invalid_request_error', message },
    });
}
function createServer(configManager, options = {}) {
    const app = (0, express_1.default)();
    const instanceId = options.instanceId ?? (0, gateway_identity_js_1.newGatewayInstanceId)();
    const usageTracker = new usage_js_1.UsageTracker();
    const router = new router_js_1.ModelRouter(configManager, usageTracker);
    // Optional inbound auth: when CCMR_REQUIRED_AUTH_TOKEN is set, /v1/* and
    // /usage require it. /health is always reachable so liveness probes work
    // without credentials.
    app.use((req, res, next) => {
        if (!req.path.startsWith('/v1/') && req.path !== '/usage') {
            return next();
        }
        const token = requiredAuthToken();
        if (token.length === 0) {
            return next();
        }
        if (!isAuthorized(req, token)) {
            res.status(401).json({
                type: 'error',
                error: { type: 'authentication_error', message: 'invalid CCMR auth token' },
            });
            return;
        }
        next();
    });
    // Parse only after authentication, so an unauthenticated network client
    // cannot force allocation of the full request-body limit.
    app.use(express_1.default.json({ limit: '32mb', strict: true }));
    // Logging middleware (reads config per request so hot-reload applies)
    app.use((req, _res, next) => {
        if ((0, logging_js_1.isInfoLoggingEnabled)(configManager.getConfig().gateway) && req.path !== '/health') {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        }
        next();
    });
    // Health check
    app.get('/health', (_req, res) => {
        const config = configManager.getConfig();
        const includeDetails = isLoopbackRequest(_req) || isAuthorized(_req);
        const models = {};
        for (const [name, model] of Object.entries(config.models)) {
            if (model.provider_key && name === model.provider_key) {
                continue;
            }
            models[name] = configManager.getApiKey(name) ? 'available' : 'no_api_key';
        }
        const health = {
            status: 'healthy',
            service: 'claude-code-model-router',
            version: version_js_1.VERSION,
            default_model: config.default_model,
        };
        if (includeDetails) {
            Object.assign(health, {
                // Config provenance: without it, "which config is this gateway using?"
                // can only be answered by inspecting the process's open files.
                config_file: configManager.getConfigFilePath(),
                ccmr_home: (0, paths_js_1.ccmrHome)(),
                config_source_id: configManager.getSourceId(),
                // Lets `ccmr stop` target this process without parsing lsof/netstat,
                // and guarantees it can only ever signal a self-identified gateway.
                pid: process.pid,
                instance_id: instanceId,
                models,
            });
        }
        res.json(health);
    });
    // List models
    app.get('/v1/models', (_req, res) => {
        const config = configManager.getConfig();
        const data = Object.entries(config.models)
            .filter(([id, model]) => !(model.provider_key && id === model.provider_key))
            .map(([id, model]) => ({
            id,
            object: 'model',
            display_name: model.display_name,
            provider: model.provider,
            provider_key: model.provider_key,
            variant: model.variant_key,
            model_id: model.model_id,
            available: !!configManager.getApiKey(id),
        }));
        res.json({ object: 'list', data });
    });
    // Messages endpoint
    app.post('/v1/messages', async (req, res) => {
        const client = clientAbortController(req, res);
        try {
            const validationError = requestValidationError(req.body);
            if (validationError) {
                sendInvalidRequest(res, validationError);
                return;
            }
            const body = req.body;
            const config = configManager.getConfig();
            // Use default model if not specified
            if (!body.model) {
                body.model = config.default_model;
            }
            // Get original headers for forwarding
            const originalHeaders = originalAnthropicHeaders(req);
            // Get model display name for headers
            const modelConfig = configManager.getModel(body.model);
            const modelDisplayName = modelConfig?.display_name || body.model;
            // Check if streaming
            if (body.stream) {
                // Set SSE headers
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('X-Accel-Buffering', 'no');
                res.setHeader('X-Model-Router-Requested', modelDisplayName);
                res.flushHeaders();
                // Stream the response
                for await (const chunk of router.forwardStream(body, originalHeaders, client.controller.signal)) {
                    if (!(await writeWithBackpressure(res, chunk, client.controller.signal))) {
                        break;
                    }
                    // Flush immediately for real-time streaming
                    if (typeof res.flush === 'function') {
                        res.flush();
                    }
                }
                if (!res.destroyed) {
                    res.end();
                }
            }
            else {
                // Non-streaming response
                const response = await router.forwardRequest(body, originalHeaders, client.controller.signal, (route) => res.setHeader('X-Model-Router', route.config.display_name));
                res.json(response);
            }
        }
        catch (error) {
            if (client.controller.signal.aborted) {
                return;
            }
            // Check if headers already sent (streaming started)
            if (res.headersSent) {
                // For streaming, send error as SSE event and end
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                const errorEvent = {
                    type: 'error',
                    error: { type: 'stream_error', message: errorMessage },
                };
                res.write(`event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`);
                res.end();
                return;
            }
            if (error instanceof router_js_1.RouterError) {
                res.status(error.statusCode).json(error.toErrorResponse());
            }
            else {
                console.error('Unexpected error:', error);
                res.status(500).json({
                    type: 'error',
                    error: {
                        type: 'internal_error',
                        message: error instanceof Error ? error.message : 'Unknown error',
                    },
                });
            }
        }
        finally {
            client.cleanup();
        }
    });
    // Per-model usage counters (reset on gateway restart)
    app.get('/usage', (_req, res) => {
        res.json(usageTracker.snapshot());
    });
    // Token counting is proxied to the selected provider's compatible endpoint.
    app.post('/v1/messages/count_tokens', async (req, res) => {
        const client = clientAbortController(req, res);
        try {
            const validationError = requestValidationError(req.body);
            if (validationError) {
                sendInvalidRequest(res, validationError);
                return;
            }
            const body = req.body;
            if (!body.model) {
                body.model = configManager.getConfig().default_model;
            }
            const response = await router.forwardCountTokens(body, originalAnthropicHeaders(req), client.controller.signal);
            res.json(response);
        }
        catch (error) {
            if (client.controller.signal.aborted)
                return;
            if (error instanceof router_js_1.RouterError) {
                res.status(error.statusCode).json(error.toErrorResponse());
            }
            else {
                console.error('Unexpected count_tokens error:', error);
                res.status(500).json({
                    type: 'error',
                    error: { type: 'internal_error', message: 'Token counting failed' },
                });
            }
        }
        finally {
            client.cleanup();
        }
    });
    // 404 handler
    app.use((_req, res) => {
        res.status(404).json({
            type: 'error',
            error: {
                type: 'not_found',
                message: 'Endpoint not found',
            },
        });
    });
    // Error handler
    app.use((err, _req, res, _next) => {
        const status = err.status ?? err.statusCode ?? 500;
        const safeStatus = status >= 400 && status < 600 ? status : 500;
        if (safeStatus >= 500) {
            console.error('Server error:', err);
        }
        const message = err.type === 'entity.too.large'
            ? 'Request body exceeds the 32 MB limit'
            : safeStatus < 500
                ? err.message
                : 'Internal server error';
        res.status(safeStatus).json({
            type: 'error',
            error: {
                type: safeStatus < 500 ? 'invalid_request_error' : 'internal_error',
                message,
            },
        });
    });
    return app;
}
/** Constant-time token comparison (hash first so lengths always match). */
function tokensEqual(a, b) {
    const hashA = node_crypto_1.default.createHash('sha256').update(a).digest();
    const hashB = node_crypto_1.default.createHash('sha256').update(b).digest();
    return node_crypto_1.default.timingSafeEqual(hashA, hashB);
}
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);
/** Count of models the gateway can actually serve, ignoring provider-key aliases. */
function countReadyModels(configManager) {
    const entries = Object.entries(configManager.getConfig().models).filter(([name, model]) => !(model.provider_key && name === model.provider_key));
    const ready = entries.filter(([name]) => configManager.getApiKey(name)).length;
    return { ready, total: entries.length };
}
/**
 * A gateway that starts with no config and no keys is useless, and stays
 * useless invisibly. Say so loudly rather than serving 401s.
 */
function warnIfUnusable(configManager) {
    const configFile = configManager.getConfigFilePath();
    const { ready, total } = countReadyModels(configManager);
    if (!configFile) {
        console.warn('');
        console.warn('\x1b[33m[WARNING]\x1b[0m No config file found - using built-in defaults.');
        console.warn(`  Looked in: ${process.cwd()} and ${(0, paths_js_1.ccmrHome)()}`);
        console.warn('  Create one with: ccmr init --global');
    }
    if (ready === 0) {
        console.warn('');
        console.warn(`\x1b[33m[WARNING]\x1b[0m 0/${total} models have an API key.`);
        console.warn('  Every request will fail with 401 until a key is configured.');
        console.warn(`  Add keys to ${(0, paths_js_1.ccmrHome)()}/.env (or ./.env), then check: ccmr doctor`);
    }
}
function startWatching(configManager, host, port) {
    const watcher = new watcher_js_1.ConfigWatcher(configManager, {
        onReload: (changed) => {
            // Keep the already-bound address truthful after reload
            const gateway = configManager.getConfig().gateway;
            gateway.host = host;
            gateway.port = port;
            const { ready, total } = countReadyModels(configManager);
            console.log(`[reload] Configuration reloaded (${changed.join(', ')} changed) | ` +
                `${ready}/${total} models ready`);
        },
    });
    watcher.start();
    console.log(`Hot reload: watching ${configManager.getConfigFilePath() ?? '(no config file yet)'}`);
    console.log(`  plus config/.env candidates under ${process.cwd()} and ${(0, paths_js_1.ccmrHome)()}`);
    return watcher;
}
function startServer(configManager, options = {}) {
    const config = configManager.getConfig();
    const { host, port } = config.gateway;
    const authEnabled = requiredAuthToken().length > 0;
    if (!LOOPBACK_HOSTS.has(host) && !authEnabled && !options.allowInsecureNetwork) {
        throw new Error(`Refusing to bind unauthenticated gateway to non-loopback host "${host}". ` +
            'Set CCMR_REQUIRED_AUTH_TOKEN or pass --allow-insecure-network.');
    }
    const instanceId = (0, gateway_identity_js_1.newGatewayInstanceId)();
    const app = createServer(configManager, { instanceId });
    const server = app.listen(port, host, () => {
        try {
            (0, gateway_identity_js_1.writeGatewayIdentity)(port, instanceId);
        }
        catch (error) {
            console.warn('[WARNING] Could not write the local gateway identity record; ccmr stop will refuse to signal this process:', error instanceof Error ? error.message : error);
        }
        const displayHost = LOOPBACK_HOSTS.has(host) ? 'localhost' : host;
        console.log('');
        console.log('============================================================');
        console.log('  Claude Code Model Router');
        console.log('============================================================');
        console.log('');
        console.log(`Gateway running at: http://${displayHost}:${port}`);
        console.log(`Default model: ${config.default_model}`);
        console.log('');
        console.log('Available models:');
        for (const [name, model] of Object.entries(config.models)) {
            if (model.provider_key && name === model.provider_key) {
                continue;
            }
            const hasKey = !!configManager.getApiKey(name);
            const status = hasKey ? '\x1b[32m[Ready]\x1b[0m' : '\x1b[33m[No API Key]\x1b[0m';
            console.log(`  - ${name}: ${model.display_name} (${model.provider}) ${status}`);
        }
        console.log('');
        startWatching(configManager, host, port);
        warnIfUnusable(configManager);
        console.log('');
        console.log('Press Ctrl+C to stop the gateway.');
        console.log('============================================================');
        console.log('');
    });
    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error('');
            console.error(`\x1b[31m[ERROR]\x1b[0m Port ${port} is already in use.`);
            console.error('  Another gateway (or process) is listening there. Either:');
            console.error(`  - keep using the running gateway, or`);
            console.error(`  - start on another port: ccmr start --port ${port + 1}`);
            console.error('');
        }
        else {
            console.error('Server error:', error);
        }
        process.exit(1);
    });
}
//# sourceMappingURL=server.js.map