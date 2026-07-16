/**
 * Claude Code Model Router
 *
 * A lightweight API gateway for routing Claude Code requests to multiple AI models.
 *
 * @packageDocumentation
 */
export { ConfigManager, generateConfigFile, generateEnvFile } from './config.js';
export { discoverGateways, stopGateway, DEFAULT_SCAN_PORTS } from './gateway-control.js';
export type { GatewayInfo, StopResult } from './gateway-control.js';
export { ModelRouter, RouterError } from './router.js';
export { createServer, startServer } from './server.js';
export type { CreateServerOptions, StartServerOptions } from './server.js';
export type { ModelConfig, ProviderConfig, ModelVariantConfig, AuthType, GatewayConfig, RouterConfig, MessagesRequest, MessagesResponse, CountTokensResponse, ErrorResponse, Message, ContentBlock, Tool, Usage, RouteInfo, } from './types.js';
//# sourceMappingURL=index.d.ts.map