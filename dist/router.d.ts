/**
 * Request routing and forwarding logic
 */
import type { ConfigManager } from './config.js';
import type { MessagesRequest, MessagesResponse, ErrorResponse, ModelConfig, RouteInfo } from './types.js';
export declare class RouterError extends Error {
    statusCode: number;
    errorType: string;
    constructor(message: string, statusCode?: number, errorType?: string);
    toErrorResponse(): ErrorResponse;
}
export declare class ModelRouter {
    private configManager;
    constructor(configManager: ConfigManager);
    resolveRoute(modelName: string): RouteInfo;
    buildHeaders(route: RouteInfo, originalHeaders: Record<string, string>): Record<string, string>;
    buildRequestBody(request: MessagesRequest, modelConfig: ModelConfig): Record<string, unknown>;
    buildUrl(modelConfig: ModelConfig, endpoint?: string): string;
    forwardRequest(request: MessagesRequest, originalHeaders: Record<string, string>): Promise<MessagesResponse>;
    forwardStream(request: MessagesRequest, originalHeaders: Record<string, string>): AsyncGenerator<string>;
}
//# sourceMappingURL=router.d.ts.map