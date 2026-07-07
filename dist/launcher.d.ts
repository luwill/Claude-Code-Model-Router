/**
 * Gateway process helpers for `ccmr claude`: probe /health, wait for
 * readiness, and auto-start a detached gateway when none is running.
 */
export interface GatewayHealth {
    status?: string;
    version?: string;
    default_model?: string;
}
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