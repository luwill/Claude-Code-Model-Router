export interface GatewayIdentity {
    pid: number;
    port: number;
    instanceId: string;
}
export declare function newGatewayInstanceId(): string;
export declare function gatewayIdentityFile(port: number): string;
export declare function writeGatewayIdentity(port: number, instanceId: string): void;
export declare function readGatewayIdentity(port: number): GatewayIdentity | null;
//# sourceMappingURL=gateway-identity.d.ts.map