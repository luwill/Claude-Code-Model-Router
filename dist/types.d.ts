/**
 * Type definitions for Claude Code Model Router
 */
export interface ModelConfig {
    display_name: string;
    provider: string;
    model_id: string;
    base_url: string;
    api_key_env: string;
    auth_header?: string;
    supports_streaming?: boolean;
    supports_tools?: boolean;
    max_tokens?: number;
    context_window?: number;
}
export interface GatewayConfig {
    host: string;
    port: number;
    timeout: number;
    enable_logging: boolean;
    log_level: string;
}
export interface RouterConfig {
    default_model: string;
    models: Record<string, ModelConfig>;
    aliases: Record<string, string>;
    gateway: GatewayConfig;
}
export interface Message {
    role: 'user' | 'assistant';
    content: string | ContentBlock[];
}
export interface ContentBlock {
    type: string;
    text?: string;
    [key: string]: unknown;
}
export interface MessagesRequest {
    model: string;
    messages: Message[];
    max_tokens?: number;
    system?: string | ContentBlock[];
    temperature?: number;
    top_p?: number;
    top_k?: number;
    stop_sequences?: string[];
    stream?: boolean;
    tools?: Tool[];
    tool_choice?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
}
export interface Tool {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
}
export interface Usage {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
}
export interface MessagesResponse {
    id: string;
    type: 'message';
    role: 'assistant';
    content: ContentBlock[];
    model: string;
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: Usage;
}
export interface ErrorResponse {
    type: 'error';
    error: {
        type: string;
        message: string;
    };
}
export interface RouteInfo {
    name: string;
    config: ModelConfig;
    apiKey: string;
}
//# sourceMappingURL=types.d.ts.map