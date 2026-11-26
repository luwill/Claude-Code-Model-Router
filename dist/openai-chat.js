"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOpenAIReasoningModel = isOpenAIReasoningModel;
exports.openAIChatUrl = openAIChatUrl;
exports.anthropicToOpenAIChat = anthropicToOpenAIChat;
exports.mapFinishReason = mapFinishReason;
exports.openAIUsageToAnthropic = openAIUsageToAnthropic;
exports.newMessageId = newMessageId;
exports.openAIChatToAnthropic = openAIChatToAnthropic;
const node_crypto_1 = require("node:crypto");
const BILLING_HEADER_PREFIX = 'x-anthropic-billing-header:';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function asString(value) {
    return typeof value === 'string' ? value : undefined;
}
function asNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
/** OpenAI o-series and gpt-5+ reject `max_tokens` and accept `reasoning_effort`. */
function isOpenAIReasoningModel(model) {
    const lower = model.toLowerCase();
    if (/^o\d/.test(lower))
        return true;
    const match = /^gpt-(\d+)/.exec(lower);
    return match !== null && Number(match[1]) >= 5;
}
/**
 * Upstream URL for an OpenAI-compatible base_url, following the OpenAI SDK
 * convention: base_url already carries the version segment (…/v1,
 * …/api/paas/v4, …/compatible-mode/v1). A base_url that already ends in
 * /chat/completions is used verbatim.
 */
function openAIChatUrl(baseUrl) {
    const base = baseUrl.replace(/\/+$/, '');
    return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
}
/** Claude Code prepends a billing-header line to the system prompt; it means nothing upstream. */
function sanitizeSystemText(text) {
    if (!text.startsWith(BILLING_HEADER_PREFIX))
        return text;
    const newline = text.search(/\r?\n/);
    return newline === -1 ? '' : text.slice(newline).replace(/^(\r?\n)+/, '');
}
function systemToMessage(system) {
    if (typeof system === 'string') {
        const text = sanitizeSystemText(system);
        return text ? { role: 'system', content: text } : undefined;
    }
    if (!Array.isArray(system))
        return undefined;
    const parts = system
        .map((block) => (isRecord(block) ? asString(block.text) : undefined))
        .filter((text) => text !== undefined)
        .map(sanitizeSystemText)
        .filter((text) => text.length > 0);
    return parts.length > 0 ? { role: 'system', content: parts.join('\n') } : undefined;
}
/** Anthropic image block -> OpenAI image_url part (base64 becomes a data URL). */
function imagePart(block) {
    const source = block.source;
    if (!isRecord(source))
        return undefined;
    if (source.type === 'base64' && typeof source.data === 'string') {
        const mediaType = asString(source.media_type) ?? 'image/png';
        return { type: 'image_url', image_url: { url: `data:${mediaType};base64,${source.data}` } };
    }
    if (source.type === 'url' && typeof source.url === 'string') {
        return { type: 'image_url', image_url: { url: source.url } };
    }
    return undefined;
}
/** tool_result content -> plain text for the tool message, plus any images it carried. */
function toolResultContent(content) {
    if (content === undefined || content === null)
        return { text: '', images: [] };
    if (typeof content === 'string')
        return { text: content, images: [] };
    if (!Array.isArray(content))
        return { text: JSON.stringify(content), images: [] };
    const texts = [];
    const images = [];
    for (const part of content) {
        if (!isRecord(part))
            continue;
        if (part.type === 'text' && typeof part.text === 'string') {
            texts.push(part.text);
        }
        else if (part.type === 'image') {
            const image = imagePart(part);
            if (image)
                images.push(image);
        }
    }
    return { text: texts.join('\n'), images };
}
function collapseContent(parts) {
    if (parts.length === 0)
        return null;
    if (parts.length === 1 && parts[0].type === 'text')
        return parts[0].text;
    return parts;
}
/** One Anthropic message can fan out into several OpenAI messages (tool results). */
function convertMessage(message) {
    const role = asString(message.role) ?? 'user';
    const content = message.content;
    if (typeof content === 'string')
        return [{ role, content }];
    if (!Array.isArray(content))
        return [{ role, content: content ?? null }];
    const out = [];
    const parts = [];
    const toolCalls = [];
    const toolImages = [];
    const reasoning = [];
    for (const raw of content) {
        if (!isRecord(raw))
            continue;
        switch (raw.type) {
            case 'text':
                if (typeof raw.text === 'string')
                    parts.push({ type: 'text', text: raw.text });
                break;
            case 'image': {
                const image = imagePart(raw);
                if (image)
                    parts.push(image);
                break;
            }
            case 'tool_use':
                toolCalls.push({
                    id: asString(raw.id) ?? '',
                    type: 'function',
                    function: { name: asString(raw.name) ?? '', arguments: JSON.stringify(raw.input ?? {}) },
                });
                break;
            case 'tool_result': {
                const result = toolResultContent(raw.content);
                out.push({ role: 'tool', tool_call_id: asString(raw.tool_use_id) ?? '', content: result.text });
                toolImages.push(...result.images);
                break;
            }
            case 'thinking':
                if (typeof raw.thinking === 'string' && raw.thinking)
                    reasoning.push(raw.thinking);
                break;
            default:
                break; // redacted_thinking, server tools, etc. have no Chat equivalent
        }
    }
    // Tool messages cannot carry images: surface them in one user turn right
    // after the (adjacent) tool results.
    if (toolImages.length > 0) {
        out.push({ role: 'user', content: toolImages });
    }
    if (parts.length > 0 || toolCalls.length > 0) {
        const msg = { role, content: collapseContent(parts) };
        if (toolCalls.length > 0)
            msg.tool_calls = toolCalls;
        // Reasoning models (DeepSeek, Kimi, MiMo…) require their own reasoning
        // echoed back on tool-call turns; providers that never emit it never get it.
        if (role === 'assistant' && reasoning.length > 0)
            msg.reasoning_content = reasoning.join('\n');
        out.push(msg);
    }
    return out;
}
function convertTools(tools) {
    if (!Array.isArray(tools))
        return [];
    return tools
        .filter((tool) => isRecord(tool) && typeof tool.name === 'string')
        .filter((tool) => tool.type === undefined || tool.type === 'custom')
        .map((tool) => {
        const schema = isRecord(tool.input_schema) ? { ...tool.input_schema } : {};
        if (schema.type === undefined) {
            schema.type = 'object';
            if (schema.properties === undefined)
                schema.properties = {};
        }
        const fn = { name: tool.name, parameters: schema };
        if (typeof tool.description === 'string')
            fn.description = tool.description;
        return { type: 'function', function: fn };
    });
}
function convertToolChoice(choice) {
    if (!isRecord(choice))
        return undefined;
    switch (choice.type) {
        case 'any':
            return 'required';
        case 'auto':
            return 'auto';
        case 'none':
            return 'none';
        case 'tool':
            return { type: 'function', function: { name: asString(choice.name) ?? '' } };
        default:
            return undefined;
    }
}
/** Anthropic thinking/effort settings -> OpenAI reasoning_effort. */
function reasoningEffort(body) {
    const outputConfig = body.output_config;
    if (isRecord(outputConfig) && typeof outputConfig.effort === 'string') {
        const map = { low: 'low', medium: 'medium', high: 'high', max: 'high' };
        return map[outputConfig.effort];
    }
    const thinking = body.thinking;
    if (!isRecord(thinking))
        return undefined;
    if (thinking.type === 'adaptive')
        return 'high';
    if (thinking.type !== 'enabled')
        return undefined;
    const budget = asNumber(thinking.budget_tokens);
    if (budget === undefined)
        return 'high';
    if (budget < 4000)
        return 'low';
    return budget < 16000 ? 'medium' : 'high';
}
/**
 * Build an OpenAI Chat Completions body from an (already model-rewritten)
 * Anthropic Messages body. Unknown Anthropic-only fields (metadata,
 * thinking, cache_control, context_management…) are dropped on purpose:
 * strict OpenAI-compatible servers reject unknown parameters.
 */
function anthropicToOpenAIChat(body) {
    const model = asString(body.model) ?? '';
    const messages = [];
    const system = systemToMessage(body.system);
    if (system)
        messages.push(system);
    if (Array.isArray(body.messages)) {
        for (const message of body.messages) {
            if (isRecord(message))
                messages.push(...convertMessage(message));
        }
    }
    const reasoningModel = isOpenAIReasoningModel(model);
    const result = { model, messages };
    if (body.max_tokens !== undefined) {
        result[reasoningModel ? 'max_completion_tokens' : 'max_tokens'] = body.max_tokens;
    }
    if (body.temperature !== undefined)
        result.temperature = body.temperature;
    if (body.top_p !== undefined)
        result.top_p = body.top_p;
    if (Array.isArray(body.stop_sequences) && body.stop_sequences.length > 0) {
        result.stop = body.stop_sequences;
    }
    if (body.stream === true) {
        result.stream = true;
        // Without this, OpenAI-compatible streams carry no usage at all.
        result.stream_options = { include_usage: true };
    }
    else if (body.stream === false) {
        result.stream = false;
    }
    const tools = convertTools(body.tools);
    if (tools.length > 0) {
        result.tools = tools;
        const toolChoice = convertToolChoice(body.tool_choice);
        if (toolChoice !== undefined)
            result.tool_choice = toolChoice;
        if (isRecord(body.tool_choice) && body.tool_choice.disable_parallel_tool_use === true) {
            result.parallel_tool_calls = false;
        }
    }
    if (reasoningModel) {
        const effort = reasoningEffort(body);
        if (effort)
            result.reasoning_effort = effort;
    }
    return result;
}
/** OpenAI finish_reason -> Anthropic stop_reason. */
function mapFinishReason(reason) {
    if (reason === null || reason === undefined)
        return null;
    switch (reason) {
        case 'tool_calls':
        case 'function_call':
            return 'tool_use';
        case 'length':
            return 'max_tokens';
        default:
            return 'end_turn'; // stop, content_filter, vendor-specific values
    }
}
/**
 * OpenAI usage -> Anthropic usage. OpenAI prompt_tokens INCLUDES cache hits;
 * Anthropic input_tokens excludes them, so they are split out.
 */
function openAIUsageToAnthropic(usage) {
    if (!isRecord(usage))
        return { input_tokens: 0, output_tokens: 0 };
    const details = isRecord(usage.prompt_tokens_details) ? usage.prompt_tokens_details : {};
    const cached = asNumber(usage.cache_read_input_tokens) ??
        asNumber(details.cached_tokens) ??
        asNumber(usage.prompt_cache_hit_tokens) ?? // DeepSeek
        0;
    const prompt = asNumber(usage.prompt_tokens) ?? 0;
    const result = {
        input_tokens: Math.max(0, prompt - cached),
        output_tokens: asNumber(usage.completion_tokens) ?? 0,
    };
    if (cached > 0)
        result.cache_read_input_tokens = cached;
    return result;
}
function newMessageId() {
    return `msg_${(0, node_crypto_1.randomUUID)().replace(/-/g, '')}`;
}
function parseArguments(raw) {
    if (isRecord(raw))
        return raw;
    if (typeof raw !== 'string' || raw.trim() === '')
        return {};
    try {
        const parsed = JSON.parse(raw);
        return isRecord(parsed) ? parsed : {};
    }
    catch {
        return {};
    }
}
/** Non-streaming OpenAI Chat Completions response -> Anthropic Messages response. */
function openAIChatToAnthropic(response, fallbackModel) {
    const body = isRecord(response) ? response : {};
    const id = asString(body.id) || newMessageId();
    const model = asString(body.model) || fallbackModel;
    const usage = openAIUsageToAnthropic(body.usage);
    const choices = Array.isArray(body.choices) ? body.choices : [];
    const choice = isRecord(choices[0]) ? choices[0] : undefined;
    const message = choice && isRecord(choice.message) ? choice.message : {};
    const content = [];
    const reasoning = asString(message.reasoning_content) ?? asString(message.reasoning);
    if (reasoning)
        content.push({ type: 'thinking', thinking: reasoning, signature: '' });
    if (typeof message.content === 'string' && message.content) {
        content.push({ type: 'text', text: message.content });
    }
    else if (Array.isArray(message.content)) {
        for (const part of message.content) {
            if (isRecord(part) && typeof part.text === 'string' && part.text) {
                content.push({ type: 'text', text: part.text });
            }
        }
    }
    if (typeof message.refusal === 'string' && message.refusal) {
        content.push({ type: 'text', text: message.refusal });
    }
    const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    toolCalls.forEach((call, index) => {
        if (!isRecord(call))
            return;
        const fn = isRecord(call.function) ? call.function : {};
        content.push({
            type: 'tool_use',
            id: asString(call.id) || `toolu_${index}_${(0, node_crypto_1.randomUUID)().slice(0, 8)}`,
            name: asString(fn.name) ?? '',
            input: parseArguments(fn.arguments),
        });
    });
    const hasToolUse = content.some((block) => block.type === 'tool_use');
    const stopReason = mapFinishReason(choice ? (asString(choice.finish_reason) ?? null) : null) ??
        (hasToolUse ? 'tool_use' : 'end_turn');
    return {
        id,
        type: 'message',
        role: 'assistant',
        content,
        model,
        stop_reason: stopReason,
        stop_sequence: null,
        usage,
    };
}
//# sourceMappingURL=openai-chat.js.map