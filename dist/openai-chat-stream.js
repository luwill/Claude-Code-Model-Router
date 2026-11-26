"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIChatStreamTranslator = void 0;
const openai_chat_js_1 = require("./openai-chat.js");
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function sse(type, payload) {
    return `event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`;
}
/** The concatenated `data:` payload of one SSE event block, or undefined. */
function eventData(event) {
    const lines = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''));
    return lines.length > 0 ? lines.join('\n') : undefined;
}
class OpenAIChatStreamTranslator {
    fallbackModel;
    started = false;
    finished = false;
    messageId = '';
    model = '';
    nextBlockIndex = 0;
    openTextKind = null;
    openTextIndex = null;
    tools = new Map();
    stopReason = null;
    usage = null;
    constructor(fallbackModel) {
        this.fallbackModel = fallbackModel;
    }
    /** Translate one upstream SSE event block into zero or more Anthropic events. */
    push(event) {
        if (this.finished)
            return [];
        const data = eventData(event);
        if (data === undefined)
            return [];
        if (data.trim() === '[DONE]')
            return this.finish();
        let chunk;
        try {
            chunk = JSON.parse(data);
        }
        catch {
            return []; // keep-alive comments, vendor noise
        }
        if (!isRecord(chunk))
            return [];
        if (isRecord(chunk.error)) {
            this.finished = true;
            const message = typeof chunk.error.message === 'string' ? chunk.error.message : 'Upstream stream error';
            return [sse('error', { error: { type: 'api_error', message } })];
        }
        if (!this.messageId && typeof chunk.id === 'string' && chunk.id)
            this.messageId = chunk.id;
        if (!this.model && typeof chunk.model === 'string' && chunk.model)
            this.model = chunk.model;
        if (isRecord(chunk.usage))
            this.usage = (0, openai_chat_js_1.openAIUsageToAnthropic)(chunk.usage);
        const choice = Array.isArray(chunk.choices) && isRecord(chunk.choices[0]) ? chunk.choices[0] : undefined;
        if (!choice)
            return []; // usage-only tail chunk
        // Moonshot (and some others) also attach usage to the finishing choice.
        if (isRecord(choice.usage))
            this.usage = (0, openai_chat_js_1.openAIUsageToAnthropic)(choice.usage);
        const out = this.ensureStarted();
        const delta = isRecord(choice.delta) ? choice.delta : {};
        const reasoning = typeof delta.reasoning_content === 'string' ? delta.reasoning_content : delta.reasoning;
        if (typeof reasoning === 'string' && reasoning) {
            out.push(...this.textDelta('thinking', reasoning));
        }
        if (typeof delta.content === 'string' && delta.content) {
            out.push(...this.textDelta('text', delta.content));
        }
        if (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0) {
            out.push(...this.closeTextBlock());
            for (const call of delta.tool_calls) {
                if (isRecord(call))
                    out.push(...this.toolDelta(call));
            }
        }
        if (typeof choice.finish_reason === 'string' && choice.finish_reason) {
            out.push(...this.closeAllBlocks());
            this.stopReason ??= (0, openai_chat_js_1.mapFinishReason)(choice.finish_reason);
        }
        return out;
    }
    /** Close the message. Idempotent; called on [DONE] or when the upstream body ends. */
    finish() {
        if (this.finished)
            return [];
        const out = this.ensureStarted();
        out.push(...this.closeAllBlocks());
        this.finished = true;
        const usage = this.usage ?? { input_tokens: 0, output_tokens: 0 };
        out.push(sse('message_delta', {
            delta: { stop_reason: this.stopReason ?? 'end_turn', stop_sequence: null },
            usage,
        }));
        out.push(sse('message_stop', {}));
        return out;
    }
    ensureStarted() {
        if (this.started)
            return [];
        this.started = true;
        return [
            sse('message_start', {
                message: {
                    id: this.messageId || (0, openai_chat_js_1.newMessageId)(),
                    type: 'message',
                    role: 'assistant',
                    content: [],
                    model: this.model || this.fallbackModel,
                    stop_reason: null,
                    stop_sequence: null,
                    usage: this.usage ?? { input_tokens: 0, output_tokens: 0 },
                },
            }),
        ];
    }
    textDelta(kind, text) {
        const out = [];
        if (this.openTextKind !== kind) {
            out.push(...this.closeTextBlock());
            const index = this.nextBlockIndex++;
            this.openTextKind = kind;
            this.openTextIndex = index;
            const block = kind === 'text' ? { type: 'text', text: '' } : { type: 'thinking', thinking: '', signature: '' };
            out.push(sse('content_block_start', { index, content_block: block }));
        }
        const delta = kind === 'text' ? { type: 'text_delta', text } : { type: 'thinking_delta', thinking: text };
        out.push(sse('content_block_delta', { index: this.openTextIndex, delta }));
        return out;
    }
    closeTextBlock() {
        if (this.openTextIndex === null)
            return [];
        const index = this.openTextIndex;
        this.openTextIndex = null;
        this.openTextKind = null;
        return [sse('content_block_stop', { index })];
    }
    toolDelta(call) {
        const key = typeof call.index === 'number' ? call.index : this.tools.size;
        let state = this.tools.get(key);
        if (!state) {
            state = { blockIndex: this.nextBlockIndex++, id: '', name: '', started: false, pendingArgs: '' };
            this.tools.set(key, state);
        }
        if (typeof call.id === 'string' && call.id)
            state.id = call.id;
        const fn = isRecord(call.function) ? call.function : {};
        if (typeof fn.name === 'string' && fn.name)
            state.name = fn.name;
        const args = typeof fn.arguments === 'string' ? fn.arguments : '';
        const out = [];
        if (!state.started && state.id && state.name) {
            out.push(...this.startTool(state));
        }
        if (args) {
            if (state.started)
                out.push(this.argsDelta(state.blockIndex, args));
            else
                state.pendingArgs += args;
        }
        return out;
    }
    startTool(state) {
        state.started = true;
        const out = [
            sse('content_block_start', {
                index: state.blockIndex,
                content_block: { type: 'tool_use', id: state.id, name: state.name, input: {} },
            }),
        ];
        if (state.pendingArgs) {
            out.push(this.argsDelta(state.blockIndex, state.pendingArgs));
            state.pendingArgs = '';
        }
        return out;
    }
    argsDelta(index, partialJson) {
        return sse('content_block_delta', { index, delta: { type: 'input_json_delta', partial_json: partialJson } });
    }
    /** Close the text block, start any tool that never got an id/name, then close all tools. */
    closeAllBlocks() {
        const out = this.closeTextBlock();
        const tools = [...this.tools.entries()].sort((a, b) => a[1].blockIndex - b[1].blockIndex);
        for (const [key, state] of tools) {
            if (!state.started && (state.id || state.name || state.pendingArgs)) {
                state.id ||= `toolu_${key}_${(0, openai_chat_js_1.newMessageId)().slice(4, 12)}`;
                state.name ||= 'unknown_tool';
                out.push(...this.startTool(state));
            }
            if (state.started)
                out.push(sse('content_block_stop', { index: state.blockIndex }));
        }
        this.tools.clear();
        return out;
    }
}
exports.OpenAIChatStreamTranslator = OpenAIChatStreamTranslator;
//# sourceMappingURL=openai-chat-stream.js.map