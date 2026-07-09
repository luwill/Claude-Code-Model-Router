/**
 * Gateway process helpers for `ccmr claude`: probe /health, wait for
 * readiness, and auto-start a detached gateway when none is running.
 */
export interface GatewayHealth {
    status?: string;
    version?: string;
    default_model?: string;
    config_file?: string | null;
    ccmr_home?: string;
    /** The gateway's own process id (absent on gateways older than 1.8.2). */
    pid?: number;
    /** model key -> 'available' | 'no_api_key' (absent on gateways older than 1.8.1) */
    models?: Record<string, string>;
}
export type GatewayModelCheck = {
    ok: true;
} | {
    ok: false;
    reason: 'unknown_model' | 'no_api_key';
};
/**
 * Guards against reusing a reachable-but-useless gateway. A gateway that
 * started before its config existed answers /health with 200 while holding
 * zero API keys; without this check the user only finds out via a 401
 * raised several layers down inside Claude Code.
 */
export declare function checkGatewayModel(health: GatewayHealth, modelKey: string): GatewayModelCheck;
export interface EnsureGatewayResult {
    health: GatewayHealth;
    autoStarted: boolean;
    pid?: number;
    logFile?: string;
}
export declare function probeGateway(port: string | number, timeoutMs?: number): Promise<GatewayHealth | null>;
export declare function waitForHealthy(port: string | number, timeoutMs?: number, intervalMs?: number): Promise<GatewayHealth | null>;
/**
 * Returns the running gateway's health, auto-starting a detached gateway
 * process (logs to ~/.ccmr/gateway.log) when none is reachable.
 * Returns null when auto-start failed to become healthy in time.
 */
export declare function ensureGatewayRunning(port: string | number, cliScript: string): Promise<EnsureGatewayResult | null>;
//# sourceMappingURL=launcher.d.ts.map