/**
 * Discover and stop running gateways (`ccmr status`, `ccmr stop`).
 *
 * A gateway auto-started by `ccmr claude` is detached and reparented to init,
 * so it survives the terminal that spawned it. Without these commands the only
 * way to find or stop one is a `pkill` pattern nobody remembers.
 *
 * Safety: a process is only ever signalled when it self-identifies as a ccmr
 * gateway through /health and reports its own pid. A stranger listening on the
 * port is reported, never killed. This also keeps the implementation free of
 * platform-specific `lsof` / `netstat` parsing.
 */
/** CLI default (8080), VSCode extension default (8088) and its fallback range. */
export declare const DEFAULT_SCAN_PORTS: number[];
export interface GatewayInfo {
    port: number;
    pid?: number;
    version?: string;
    default_model?: string;
    config_file?: string | null;
    ccmr_home?: string;
    modelsReady: number;
    modelsTotal: number;
}
export type StopResult = {
    status: 'stopped';
    pid: number;
} | {
    status: 'still_running';
    pid: number;
} | {
    status: 'not_running';
} | {
    status: 'unknown_process';
} | {
    status: 'no_pid';
    version?: string;
};
export interface StopOptions {
    /** Injectable for tests; defaults to signalling the real process. */
    kill?: (pid: number, signal: NodeJS.Signals) => void;
    /** How long to wait for the port to free up after SIGTERM. */
    waitMs?: number;
    /** Escalate to SIGKILL if the process ignores SIGTERM. */
    force?: boolean;
}
export declare function discoverGateways(ports?: number[], timeoutMs?: number): Promise<GatewayInfo[]>;
export declare function stopGateway(port: number, options?: StopOptions): Promise<StopResult>;
//# sourceMappingURL=gateway-control.d.ts.map