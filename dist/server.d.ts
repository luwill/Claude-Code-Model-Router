/**
 * Express server for Claude Code Model Router
 */
import { ConfigManager } from './config.js';
export interface CreateServerOptions {
    instanceId?: string;
}
export declare function createServer(configManager: ConfigManager, options?: CreateServerOptions): import("express-serve-static-core").Express;
export interface StartServerOptions {
    /** Explicit escape hatch for trusted isolated networks. */
    allowInsecureNetwork?: boolean;
}
export declare function startServer(configManager: ConfigManager, options?: StartServerOptions): void;
//# sourceMappingURL=server.d.ts.map