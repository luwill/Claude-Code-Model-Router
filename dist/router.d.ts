/**
 * Request routing and forwarding logic
 */
import type { ConfigManager } from './config.js';
import type { UsageTracker } from './usage.js';
import type { MessagesRequest, MessagesResponse, CountTokensResponse, ErrorResponse, ModelConfig, RouteInfo } from './types.js';
export declare class RouterError extends Error {
    statusCode: number;
    errorType: string;
    constructor(message: string, statusCode?: number, errorType?: string);
    toErrorResponse(): ErrorResponse;
}
export declare class ModelRouter {
    private configManager;
    private usageTracker?;
    constructor(configManager: ConfigManager, usageTracker?: UsageTracker);
    private isLoggingEnabled;
    resolveRoute(modelName: string): RouteInfo;
    /**
     * The primary model followed by its configured fallbacks (aliases
     * resolved, duplicates removed). Fallbacks are one level deep by design:
     * a fallback's own fallback list is ignored, so chains cannot cycle.
     */
    buildChain(modelName: string): string[];
    buildHeaders(route: RouteInfo, originalHeaders: Record<string, string>): Record<string, string>;
    buildRequestBody(request: MessagesRequest, modelConfig: ModelConfig): Record<string, unknown>;
    private validateCapabilities;
    private normalizeProviderRequestBody;
    private normalizeDeepSeekRequestBody;
    buildUrl(modelConfig: ModelConfig, endpoint?: string): string;
    forwardRequest(request: MessagesRequest, originalHeaders: Record<string, string>, signal?: AbortSignal, onRoute?: (route: RouteInfo) => void): Promise<MessagesResponse>;
    private attemptRequest;
    forwardCountTokens(request: MessagesRequest, originalHeaders: Record<string, string>, signal?: AbortSignal): Promise<CountTokensResponse>;
    forwardStream(request: MessagesRequest, originalHeaders: Record<string, string>, signal?: AbortSignal): AsyncGenerator<string>;
    private streamBody;
    /** Pull token counts out of message_start / message_delta SSE events. */
    private accumulateStreamUsage;
    private logFailover;
    private formatErrorEvent;
}
//# sourceMappingURL=router.d.ts.map