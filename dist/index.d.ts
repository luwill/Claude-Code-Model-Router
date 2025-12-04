/**
 * Claude Code Model Router
 *
 * A lightweight API gateway for routing Claude Code requests to multiple AI models.
 *
 * @packageDocumentation
 */
export { ConfigManager, generateConfigFile, generateEnvFile } from './config.js';
export { ModelRouter, RouterError } from './router.js';
export { createServer, startServer } from './server.js';
export type { ModelConfig, GatewayConfig, RouterConfig, MessagesRequest, MessagesResponse, ErrorResponse, Message, ContentBlock, Tool, Usage, RouteInfo, } from './types.js';
//# sourceMappingURL=index.d.ts.map