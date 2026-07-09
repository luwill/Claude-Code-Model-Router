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
function createServer(configManager) {
    const app = (0, express_1.default)();
    const usageTracker = new usage_js_1.UsageTracker();
    const router = new router_js_1.ModelRouter(configManager, usageTracker);
    // Middleware
    app.use(express_1.default.json({ limit: '50mb' }));
    // Optional inbound auth: when CCMR_REQUIRED_AUTH_TOKEN is set, /v1/* and
    // /usage require it. /health is always reachable so liveness probes work
    // without credentials.
    const requiredToken = process.env.CCMR_REQUIRED_AUTH_TOKEN;
    if (requiredToken && requiredToken.length > 0) {
        app.use((req, res, next) => {
            if (!req.path.startsWith('/v1/') && req.path !== '/usage') {
                return next();
            }
            const raw = req.headers['x-api-key'] ?? req.headers.authorization ?? '';
            const got = String(raw).replace(/^Bearer\s+/i, '').trim();
            if (!tokensEqual(got, requiredToken)) {
                res.status(401).json({
                    type: 'error',
                    error: { type: 'authentication_error', message: 'invalid CCMR auth token' },
                });
                return;
            }
            next();
        });
    }
    // Logging middleware (reads config per request so hot-reload applies)
    app.use((req, _res, next) => {
        if (configManager.getConfig().gateway.enable_logging && req.path !== '/health') {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        }
        next();
    });
    // Health check
    app.get('/health', (_req, res) => {
        const config = configManager.getConfig();
        const models = {};
        for (const [name, model] of Object.entries(config.models)) {
            if (model.provider_key && name === model.provider_key) {
                continue;
            }
            models[name] = configManager.getApiKey(name) ? 'available' : 'no_api_key';
        }
        res.json({
            status: 'healthy',
            version: version_js_1.VERSION,
            default_model: config.default_model,
            // Config provenance: without it, "which config is this gateway using?"
            // can only be answered by inspecting the process's open files.
            config_file: configManager.getConfigFilePath(),
            ccmr_home: (0, paths_js_1.ccmrHome)(),
            models,
        });
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
        try {
            const body = req.body;
            const config = configManager.getConfig();
            // Use default model if not specified
            if (!body.model) {
                body.model = config.default_model;
            }
            // Get original headers for forwarding
            const originalHeaders = {};
            if (req.headers['anthropic-beta']) {
                originalHeaders['anthropic-beta'] = req.headers['anthropic-beta'];
            }
            if (req.headers['anthropic-version']) {
                originalHeaders['anthropic-version'] = req.headers['anthropic-version'];
            }
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
                res.setHeader('X-Model-Router', modelDisplayName);
                res.flushHeaders();
                // Stream the response
                for await (const chunk of router.forwardStream(body, originalHeaders)) {
                    res.write(chunk);
                    // Flush immediately for real-time streaming
                    if (typeof res.flush === 'function') {
                        res.flush();
                    }
                }
                res.end();
            }
            else {
                // Non-streaming response
                const response = await router.forwardRequest(body, originalHeaders);
                if (config.gateway.enable_logging) {
                    res.setHeader('X-Model-Router', modelDisplayName);
                }
                res.json(response);
            }
        }
        catch (error) {
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
    });
    // Per-model usage counters (reset on gateway restart)
    app.get('/usage', (_req, res) => {
        res.json(usageTracker.snapshot());
    });
    // Token counting (not implemented)
    app.post('/v1/messages/count_tokens', (_req, res) => {
        res.status(501).json({
            type: 'error',
            error: {
                type: 'not_implemented',
                message: 'Token counting is not yet implemented',
            },
        });
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
        console.error('Server error:', err);
        res.status(500).json({
            type: 'error',
            error: {
                type: 'internal_error',
                message: err.message,
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
function startServer(configManager) {
    const app = createServer(configManager);
    const config = configManager.getConfig();
    const { host, port } = config.gateway;
    const authEnabled = !!(process.env.CCMR_REQUIRED_AUTH_TOKEN ?? '').trim();
    if (!LOOPBACK_HOSTS.has(host) && !authEnabled) {
        console.warn('');
        console.warn('\x1b[33m[WARNING]\x1b[0m Gateway is binding to a non-loopback address');
        console.warn(`  (host="${host}") with NO inbound authentication.`);
        console.warn('  Anyone who can reach this address can spend your provider API keys.');
        console.warn('  Set CCMR_REQUIRED_AUTH_TOKEN to require a token, or bind to 127.0.0.1.');
    }
    const server = app.listen(port, host, () => {
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