/**
 * Anthropic Messages <-> OpenAI Chat Completions translation.
 *
 * Lets a provider declare `api_format: openai_chat` so Claude Code (which
 * only speaks Anthropic Messages) can use any OpenAI-compatible endpoint.
 * The mapping follows cc-switch-cli's proven converter: system blocks become
 * one system message, tool_use/tool_result become tool_calls/role:"tool",
 * thinking travels as `reasoning_content`, and usage is reported Anthropic
 * style (input_tokens excludes cache hits).
 */
import type { MessagesResponse, Usage } from './types.js';
type Json = Record<string, unknown>;
/** OpenAI o-series and gpt-5+ reject `max_tokens` and accept `reasoning_effort`. */
export declare function isOpenAIReasoningModel(model: string): boolean;
/**
 * Upstream URL for an OpenAI-compatible base_url, following the OpenAI SDK
 * convention: base_url already carries the version segment (…/v1,
 * …/api/paas/v4, …/compatible-mode/v1). A base_url that already ends in
 * /chat/completions is used verbatim.
 */
export declare function openAIChatUrl(baseUrl: string): string;
/**
 * Build an OpenAI Chat Completions body from an (already model-rewritten)
 * Anthropic Messages body. Unknown Anthropic-only fields (metadata,
 * thinking, cache_control, context_management…) are dropped on purpose:
 * strict OpenAI-compatible servers reject unknown parameters.
 */
export declare function anthropicToOpenAIChat(body: Json): Json;
/** OpenAI finish_reason -> Anthropic stop_reason. */
export declare function mapFinishReason(reason: string | null | undefined): string | null;
/**
 * OpenAI usage -> Anthropic usage. OpenAI prompt_tokens INCLUDES cache hits;
 * Anthropic input_tokens excludes them, so they are split out.
 */
export declare function openAIUsageToAnthropic(usage: unknown): Usage;
export declare function newMessageId(): string;
/** Non-streaming OpenAI Chat Completions response -> Anthropic Messages response. */
export declare function openAIChatToAnthropic(response: unknown, fallbackModel: string): MessagesResponse;
export {};
//# sourceMappingURL=openai-chat.d.ts.map