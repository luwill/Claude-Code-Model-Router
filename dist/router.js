"use strict";
/**
 * Request routing and forwarding logic
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelRouter = exports.RouterError = void 0;
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
class ModelRouter {
    configManager;
    usageTracker;
    constructor(configManager, usageTracker) {
        this.configManager = configManager;
        this.usageTracker = usageTracker;
    }
    isLoggingEnabled() {
        return this.configManager.getConfig().gateway.enable_logging;
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
        let baseUrl = modelConfig.base_url.replace(/\/$/, '');
        // Handle different API structures
        if (modelConfig.provider === 'anthropic') {
            return `${baseUrl}${endpoint}`;
        }
        // For other providers with /anthropic or /coding in base URL
        if (baseUrl.includes('/anthropic') ||
            baseUrl.includes('/coding') ||
            baseUrl.includes('/apps/anthropic')) {
            return `${baseUrl}/v1/messages`;
        }
        return `${baseUrl}${endpoint}`;
    }
    async forwardRequest(request, originalHeaders) {
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
                const response = await this.attemptRequest(route, request, originalHeaders);
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
    async attemptRequest(route, request, originalHeaders) {
        const headers = this.buildHeaders(route, originalHeaders);
        const body = this.buildRequestBody(request, route.config);
        const url = this.buildUrl(route.config);
        // Ensure stream is false for non-streaming
        body.stream = false;
        const timeout = this.configManager.getConfig().gateway.timeout * 1000;
        const controller = new AbortController();
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
        }
    }
    async *forwardStream(request, originalHeaders) {
        const chain = this.buildChain(request.model);
        const timeout = this.configManager.getConfig().gateway.timeout * 1000;
        let lastError = null;
        for (let i = 0; i < chain.length; i++) {
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
            const body = this.buildRequestBody(request, route.config);
            const url = this.buildUrl(route.config);
            body.stream = true;
            headers.Accept = 'text/event-stream';
            const controller = new AbortController();
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
                const errorText = await response.text();
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
            yield* this.streamBody(route, response, controller, timeout);
            return;
        }
        const message = lastError?.message ?? 'No usable model in fallback chain';
        yield this.formatErrorEvent(lastError?.errorType ?? 'internal_error', message);
    }
    async *streamBody(route, response, controller, timeoutMs) {
        if (!response.body) {
            this.usageTracker?.recordError(route.name);
            yield this.formatErrorEvent('internal_error', 'No response body');
            return;
        }
        const usage = { input: 0, output: 0 };
        let buffer = '';
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
                const chunk = typeof value === 'string' ? value : Buffer.from(value).toString('utf-8');
                buffer += chunk;
                // Process complete SSE events
                while (buffer.includes('\n\n')) {
                    const idx = buffer.indexOf('\n\n');
                    const event = buffer.slice(0, idx);
                    buffer = buffer.slice(idx + 2);
                    if (event.trim()) {
                        eventCount++;
                        this.accumulateStreamUsage(event, usage);
                        yield event + '\n\n';
                    }
                }
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
        const dataLine = event.split('\n').find((line) => line.startsWith('data:'));
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