/**
 * Streaming half of the OpenAI Chat Completions -> Anthropic translation.
 *
 * Feed it each upstream SSE event block; it returns Anthropic SSE events
 * (message_start, content_block_start/delta/stop, message_delta,
 * message_stop) in the order Claude Code expects. The state machine follows
 * cc-switch-cli's streaming converter:
 *  - reasoning_content and content each open their own block, closing the
 *    previous non-tool block when the kind changes;
 *  - tool calls are keyed by the OpenAI `index`; a tool block starts only
 *    once both id and name are known, buffering argument fragments until then;
 *  - message_delta is held back until usage arrives ([DONE] or stream end),
 *    because OpenAI sends the usage chunk AFTER the finish_reason chunk.
 */
export declare class OpenAIChatStreamTranslator {
    private readonly fallbackModel;
    private started;
    private finished;
    private messageId;
    private model;
    private nextBlockIndex;
    private openTextKind;
    private openTextIndex;
    private readonly tools;
    private stopReason;
    private usage;
    constructor(fallbackModel: string);
    /** Translate one upstream SSE event block into zero or more Anthropic events. */
    push(event: string): string[];
    /** Close the message. Idempotent; called on [DONE] or when the upstream body ends. */
    finish(): string[];
    private ensureStarted;
    private textDelta;
    private closeTextBlock;
    private toolDelta;
    private startTool;
    private argsDelta;
    /** Close the text block, start any tool that never got an id/name, then close all tools. */
    private closeAllBlocks;
}
//# sourceMappingURL=openai-chat-stream.d.ts.map