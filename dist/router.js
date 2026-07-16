"use strict";
/**
 * Request routing and forwarding logic
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelRouter = exports.RouterError = void 0;
const logging_js_1 = require("./logging.js");
class RouterError extends Error {
    statusCode;
    errorType;
    constructor(message, statusCode = 500, errorType = 'router_error') {
        super(message);
        this.name = 'RouterError';
        this.statusCode = statusCode;
        this.errorType = errorType;
    }
    toErrorResponse() {
        return {
            type: 'error',
            error: {
                type: this.errorType,
                message: this.message,
            },
        };
    }
}
exports.RouterError = RouterError;
/** Upstream failures worth retrying on a fallback model. */
function isRetryable(error) {
    return (error.errorType === 'connection_error' ||
        error.errorType === 'timeout_error' ||
        error.statusCode === 429 ||
        error.statusCode >= 500);
}
function parseUpstreamErrorMessage(errorText) {
    try {
        const errorJson = JSON.parse(errorText);
        return errorJson.error?.message || errorText;
    }
    catch {
        return errorText;
    }
}
function linkAbortSignal(controller, signal) {
    if (!signal) {
        return () => undefined;
    }
    const abort = () => controller.abort(signal.reason);
    if (signal.aborted) {
        abort();
    }
    else {
        signal.addEventListener('abort', abort, { once: true });
    }
    return () => signal.removeEventListener('abort', abort);
}
class ModelRouter {
    configManager;
    usageTracker;
    constructor(configManager, usageTracker) {
        this.configManager = configManager;
        this.usageTracker = usageTracker;
    }
    isLoggingEnabled() {
        return (0, logging_js_1.isInfoLoggingEnabled)(this.configManager.getConfig().gateway);
    }
    resolveRoute(modelName) {
        const resolvedName = this.configManager.resolveModelName(modelName);
        const modelConfig = this.configManager.getModel(resolvedName);
        if (!modelConfig) {
            const availableModels = Object.keys(this.configManager.getConfig().models).join(', ');
            throw new RouterError(`Model '${modelName}' not found. Available models: ${availableModels}`, 400, 'invalid_model');
        }
        const apiKey = this.configManager.getApiKey(resolvedName);
        if (!apiKey) {
            throw new RouterError(`API key not configured for model '${modelConfig.display_name}'. ` +
                `Please set the ${modelConfig.api_key_env} environment variable.`, 401, 'authentication_error');
        }
        return {
            name: resolvedName,
            config: modelConfig,
            apiKey,
        };
    }
    /**
     * The primary model followed by its configured fallbacks (aliases
     * resolved, duplicates removed). Fallbacks are one level deep by design:
     * a fallback's own fallback list is ignored, so chains cannot cycle.
     */
    buildChain(modelName) {
        const primary = this.configManager.resolveModelName(modelName);
        const chain = [primary];
        const fallbacks = this.configManager.getModel(primary)?.fallback ?? [];
        for (const fallback of fallbacks) {
            const resolved = this.configManager.resolveModelName(fallback);
            if (!chain.includes(resolved)) {
                chain.push(resolved);
            }
        }
        return chain;
    }
    buildHeaders(route, originalHeaders) {
        const authHeader = route.config.auth_header || 'x-api-key';
        const authType = route.config.auth_type || (authHeader.toLowerCase() === 'authorization' ? 'bearer' : 'api_key');
        const authValue = authType === 'bearer' ? `Bearer ${route.apiKey}` : route.apiKey;
        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            [authHeader]: authValue,
        };
        // Add Anthropic-specific headers for Anthropic provider
        if (route.config.provider === 'anthropic') {
            headers['anthropic-version'] = '2023-06-01';
            if (originalHeaders['anthropic-beta']) {
                headers['anthropic-beta'] = originalHeaders['anthropic-beta'];
            }
        }
        return headers;
    }
    buildRequestBody(request, modelConfig) {
        const body = { ...request };
        // Replace model name with actual model ID
        body.model = modelConfig.model_id;
        // Cap max_tokens if exceeds model limit
        const maxTokens = modelConfig.max_tokens || 8192;
        if (body.max_tokens && body.max_tokens > maxTokens) {
            body.max_tokens = maxTokens;
        }
        this.normalizeProviderRequestBody(body, modelConfig);
        return body;
    }
    validateCapabilities(route, request) {
        if (request.stream && route.config.supports_streaming === false) {
            throw new RouterError(`Model '${route.name}' does not support streaming`, 400, 'unsupported_feature');
        }
        if (request.tools && request.tools.length > 0 && route.config.supports_tools === false) {
            throw new RouterError(`Model '${route.name}' does not support tools`, 400, 'unsupported_feature');
        }
    }
    normalizeProviderRequestBody(body, modelConfig) {
        if (modelConfig.provider === 'deepseek') {
            this.normalizeDeepSeekRequestBody(body);
        }
    }
    normalizeDeepSeekRequestBody(body) {
        // DeepSeek documents Anthropic `metadata` as ignored, but the endpoint can still
        // reject Claude Code session metadata when `user_id` contains unsupported chars.
        delete body.metadata;
        delete body.user_id;
    }
    buildUrl(modelConfig, endpoint = '/v1/messages') {
        const baseUrl = modelConfig.base_url.replace(/\/$/, '');
        const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${baseUrl}${normalizedEndpoint}`;
    }
    async forwardRequest(request, originalHeaders, signal, onRoute) {
        const chain = this.buildChain(request.model);
        let lastError = null;
        for (let i = 0; i < chain.length; i++) {
            let route;
            try {
                route = this.resolveRoute(chain[i]);
            }
            catch (error) {
                if (i === 0) {
                    // Primary resolution failures are client misconfiguration - no failover
                    throw error;
                }
                continue; // Skip fallbacks that are unknown or missing a key
            }
            try {
                const response = await this.attemptRequest(route, request, originalHeaders, signal);
                onRoute?.(route);
                this.usageTracker?.record(route.name, response.usage ?? {});
                if (this.isLoggingEnabled()) {
                    console.log(`[${route.config.display_name}] Request completed | ` +
                        `Input: ${response.usage?.input_tokens ?? 'N/A'} | ` +
                        `Output: ${response.usage?.output_tokens ?? 'N/A'}`);
                }
                return response;
            }
            catch (error) {
                const routerError = error instanceof RouterError
                    ? error
                    : new RouterError('Unknown error occurred', 500, 'internal_error');
                if (routerError.errorType === 'request_aborted') {
                    // The client is gone: not a model failure, so no failover and no
                    // error counters - the /usage stats must reflect upstream health.
                    throw routerError;
                }
                this.usageTracker?.recordError(route.name);
                lastError = routerError;
                const hasMoreCandidates = i < chain.length - 1;
                if (isRetryable(routerError) && hasMoreCandidates) {
                    if (this.isLoggingEnabled()) {
                        console.log(`[failover] ${route.name} failed (${routerError.message}), trying ${chain[i + 1]}`);
                    }
                    continue;
                }
                throw routerError;
            }
        }
        throw lastError ?? new RouterError('No usable model in fallback chain', 500, 'internal_error');
    }
    async attemptRequest(route, request, originalHeaders, signal) {
        this.validateCapabilities(route, request);
        const headers = this.buildHeaders(route, originalHeaders);
        const body = this.buildRequestBody(request, route.config);
        const url = this.buildUrl(route.config);
        // Ensure stream is false for non-streaming
        body.stream = false;
        const timeout = this.configManager.getConfig().gateway.timeout * 1000;
        const controller = new AbortController();
        const unlinkAbort = linkAbortSignal(controller, signal);
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new RouterError(`Upstream API error (${route.config.provider}): ${parseUpstreamErrorMessage(errorText)}`, response.status, 'api_error');
            }
            return (await response.json());
        }
        catch (error) {
            if (error instanceof RouterError) {
                throw error;
            }
            // abort(reason) rejects fetch with the caller's reason, whose name is
            // NOT 'AbortError' - a client disconnect must be classified by the
            // signal, or it masquerades as a retryable connection error.
            if (signal?.aborted) {
                throw new RouterError('Client disconnected', 499, 'request_aborted');
            }
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new RouterError(`Request timed out after ${timeout / 1000}s`, 504, 'timeout_error');
                }
                throw new RouterError(`Connection error: ${error.message}`, 502, 'connection_error');
            }
            throw new RouterError('Unknown error occurred', 500, 'internal_error');
        }
        finally {
            clearTimeout(timeoutId);
            unlinkAbort();
        }
    }
    async forwardCountTokens(request, originalHeaders, signal) {
        const route = this.resolveRoute(request.model);
        this.validateCapabilities(route, { ...request, stream: false });
        const headers = this.buildHeaders(route, originalHeaders);
        const body = this.buildRequestBody(request, route.config);
        delete body.stream;
        const url = this.buildUrl(route.config, '/v1/messages/count_tokens');
        const timeout = this.configManager.getConfig().gateway.timeout * 1000;
        const controller = new AbortController();
        const unlinkAbort = linkAbortSignal(controller, signal);
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new RouterError(`Upstream API error (${route.config.provider}): ${parseUpstreamErrorMessage(errorText)}`, response.status, 'api_error');
            }
            return (await response.json());
        }
        catch (error) {
            if (error instanceof RouterError)
                throw error;
            // See attemptRequest: a client abort carries a custom reason, so it
            // must be classified by the signal rather than the error name.
            if (signal?.aborted) {
                throw new RouterError('Client disconnected', 499, 'request_aborted');
            }
            if (error instanceof Error && error.name === 'AbortError') {
                throw new RouterError(`Request timed out after ${timeout / 1000}s`, 504, 'timeout_error');
            }
            throw new RouterError(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, 502, 'connection_error');
        }
        finally {
            clearTimeout(timeoutId);
            unlinkAbort();
        }
    }
    async *forwardStream(request, originalHeaders, signal) {
        const chain = this.buildChain(request.model);
        const timeout = this.configManager.getConfig().gateway.timeout * 1000;
        let lastError = null;
        for (let i = 0; i < chain.length; i++) {
            if (signal?.aborted) {
                return;
            }
            let route;
            try {
                route = this.resolveRoute(chain[i]);
            }
            catch (error) {
                if (i === 0) {
                    const routerError = error instanceof RouterError
                        ? error
                        : new RouterError('Unknown error occurred', 500, 'internal_error');
                    yield this.formatErrorEvent(routerError.errorType, routerError.message);
                    return;
                }
                continue;
            }
            const headers = this.buildHeaders(route, originalHeaders);
            let body;
            try {
                this.validateCapabilities(route, request);
                body = this.buildRequestBody(request, route.config);
            }
            catch (error) {
                const routerError = error instanceof RouterError
                    ? error
                    : new RouterError('Unknown error occurred', 500, 'internal_error');
                yield this.formatErrorEvent(routerError.errorType, routerError.message);
                return;
            }
            const url = this.buildUrl(route.config);
            body.stream = true;
            headers.Accept = 'text/event-stream';
            const controller = new AbortController();
            const unlinkAbort = linkAbortSignal(controller, signal);
            const connectTimer = setTimeout(() => controller.abort(), timeout);
            let response;
            try {
                response = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                    signal: controller.signal,
                });
            }
            catch (error) {
                clearTimeout(connectTimer);
                unlinkAbort();
                if (signal?.aborted) {
                    // Client disconnect, not a model failure: no error counters.
                    return;
                }
                const routerError = error instanceof Error && error.name === 'AbortError'
                    ? new RouterError(`Request timed out after ${timeout / 1000}s`, 504, 'timeout_error')
                    : new RouterError(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, 502, 'connection_error');
                this.usageTracker?.recordError(route.name);
                lastError = routerError;
                if (i < chain.length - 1) {
                    this.logFailover(route.name, routerError.message, chain[i + 1]);
                    continue;
                }
                yield this.formatErrorEvent(routerError.errorType, routerError.message);
                return;
            }
            clearTimeout(connectTimer);
            if (!response.ok) {
                let errorText;
                try {
                    errorText = await response.text();
                }
                finally {
                    unlinkAbort();
                }
                const routerError = new RouterError(parseUpstreamErrorMessage(errorText), response.status, 'api_error');
                this.usageTracker?.recordError(route.name);
                lastError = routerError;
                if (isRetryable(routerError) && i < chain.length - 1) {
                    this.logFailover(route.name, routerError.message, chain[i + 1]);
                    continue;
                }
                yield this.formatErrorEvent('api_error', routerError.message);
                return;
            }
            // Connected: stream the body. No failover past this point - the
            // client may already have received partial output.
            try {
                yield* this.streamBody(route, response, controller, timeout, signal);
            }
            finally {
                unlinkAbort();
            }
            return;
        }
        const message = lastError?.message ?? 'No usable model in fallback chain';
        yield this.formatErrorEvent(lastError?.errorType ?? 'internal_error', message);
    }
    async *streamBody(route, response, controller, timeoutMs, clientSignal) {
        if (!response.body) {
            this.usageTracker?.recordError(route.name);
            yield this.formatErrorEvent('internal_error', 'No response body');
            return;
        }
        const usage = { input: 0, output: 0 };
        const decoder = new TextDecoder();
        let buffer = '';
        let usedByteDecoder = false;
        let eventCount = 0;
        // Idle watchdog: a stream that stops producing chunks for the full
        // gateway timeout is aborted instead of hanging the connection forever.
        let lastChunkAt = Date.now();
        const idleTimer = setInterval(() => {
            if (Date.now() - lastChunkAt > timeoutMs) {
                controller.abort();
            }
        }, 1000);
        try {
            for await (const value of response.body) {
                lastChunkAt = Date.now();
                const chunk = typeof value === 'string'
                    ? value
                    : ((usedByteDecoder = true), decoder.decode(value, { stream: true }));
                buffer += chunk;
                // Process complete SSE events
                while (true) {
                    const delimiter = /\r?\n\r?\n/.exec(buffer);
                    if (!delimiter || delimiter.index === undefined) {
                        break;
                    }
                    const idx = delimiter.index;
                    const event = buffer.slice(0, idx);
                    buffer = buffer.slice(idx + delimiter[0].length);
                    if (event.trim()) {
                        eventCount++;
                        this.accumulateStreamUsage(event, usage);
                        yield event + delimiter[0];
                    }
                }
            }
            if (usedByteDecoder) {
                buffer += decoder.decode();
            }
            // Don't forget remaining data
            if (buffer.trim()) {
                eventCount++;
                this.accumulateStreamUsage(buffer, usage);
                yield buffer + '\n\n';
            }
            this.usageTracker?.record(route.name, {
                input_tokens: usage.input,
                output_tokens: usage.output,
            });
            if (this.isLoggingEnabled()) {
                console.log(`[${route.config.display_name}] Stream completed (${eventCount} events)`);
            }
        }
        catch (error) {
            if (clientSignal?.aborted) {
                // Client disconnect, not a model failure: no error counters.
                return;
            }
            this.usageTracker?.recordError(route.name);
            let errorMessage = 'Unknown error';
            let errorType = 'internal_error';
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    errorMessage = `Stream idle for more than ${timeoutMs / 1000}s, aborted`;
                    errorType = 'timeout_error';
                }
                else {
                    errorMessage = error.message;
                }
            }
            yield this.formatErrorEvent(errorType, errorMessage);
        }
        finally {
            clearInterval(idleTimer);
        }
    }
    /** Pull token counts out of message_start / message_delta SSE events. */
    accumulateStreamUsage(event, usage) {
        if (!event.includes('"usage"')) {
            return;
        }
        const dataLine = event.split(/\r?\n/).find((line) => line.startsWith('data:'));
        if (!dataLine) {
            return;
        }
        try {
            const parsed = JSON.parse(dataLine.slice(5));
            if (parsed.type === 'message_start' && parsed.message?.usage) {
                usage.input += parsed.message.usage.input_tokens ?? 0;
                usage.output = parsed.message.usage.output_tokens ?? usage.output;
            }
            else if (parsed.type === 'message_delta' && parsed.usage) {
                // message_delta reports the cumulative output count
                usage.output = parsed.usage.output_tokens ?? usage.output;
            }
        }
        catch {
            // Non-JSON data lines are passed through untouched
        }
    }
    logFailover(from, reason, to) {
        if (this.isLoggingEnabled()) {
            console.log(`[failover] ${from} failed (${reason}), trying ${to}`);
        }
    }
    formatErrorEvent(errorType, message) {
        const errorEvent = {
            type: 'error',
            error: { type: errorType, message },
        };
        return `event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`;
    }
}
exports.ModelRouter = ModelRouter;
//# sourceMappingURL=router.js.map