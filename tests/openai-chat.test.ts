/**
 * api_format: openai_chat — Anthropic Messages <-> OpenAI Chat Completions.
 * Converter units plus end-to-end runs through ModelRouter against a local
 * fake OpenAI upstream (no network, fake env var names only).
 */

import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigManager } from '../src/config.js';
import { ModelRouter, RouterError } from '../src/router.js';
import {
  anthropicToOpenAIChat,
  openAIChatToAnthropic,
  openAIChatUrl,
} from '../src/openai-chat.js';
import { OpenAIChatStreamTranslator } from '../src/openai-chat-stream.js';

type Json = Record<string, any>;

/** Parse Anthropic SSE text into [{event, data}] pairs. */
function parseSse(text: string): { event: string; data: Json }[] {
  return text
    .split('\n\n')
    .filter((block) => block.trim())
    .map((block) => {
      const event = /^event: (.+)$/m.exec(block)?.[1] ?? '';
      const data = JSON.parse(/^data: (.+)$/m.exec(block)?.[1] ?? '{}');
      return { event, data };
    });
}

function openAIChunk(delta: Json, finish: string | null = null, extra: Json = {}): string {
  return `data: ${JSON.stringify({
    id: 'chatcmpl-1',
    model: 'up-model',
    choices: [{ index: 0, delta, finish_reason: finish }],
    ...extra,
  })}\n\n`;
}

describe('openAIChatUrl', () => {
  it('appends /chat/completions to a versioned base_url (OpenAI SDK convention)', () => {
    expect(openAIChatUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1/chat/completions');
    expect(openAIChatUrl('https://open.bigmodel.cn/api/paas/v4/')).toBe(
      'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    );
  });

  it('uses a full /chat/completions URL verbatim', () => {
    expect(openAIChatUrl('https://x.example.com/v1/chat/completions')).toBe(
      'https://x.example.com/v1/chat/completions'
    );
  });
});

describe('anthropicToOpenAIChat (request)', () => {
  it('maps system, text, tool_use, tool_result, and thinking', () => {
    const out = anthropicToOpenAIChat({
      model: 'deepseek-chat',
      max_tokens: 1000,
      stream: true,
      metadata: { user_id: 'session-x' },
      thinking: { type: 'adaptive' },
      system: [
        { type: 'text', text: 'x-anthropic-billing-header: cc_version=1\nYou are Claude Code.' },
        { type: 'text', text: 'Be brief.', cache_control: { type: 'ephemeral' } },
      ],
      messages: [
        { role: 'user', content: 'list files' },
        {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'need ls', signature: 's' },
            { type: 'text', text: 'Running ls.' },
            { type: 'tool_use', id: 'call_1', name: 'Bash', input: { command: 'ls' } },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'call_1', content: [{ type: 'text', text: 'a.txt' }] },
            { type: 'text', text: 'thanks' },
          ],
        },
      ],
      tools: [{ name: 'Bash', description: 'run', input_schema: { type: 'object', properties: {} } }],
      tool_choice: { type: 'any', disable_parallel_tool_use: true },
    });

    expect(out.metadata).toBeUndefined();
    expect(out.thinking).toBeUndefined();
    expect(out.max_tokens).toBe(1000);
    expect(out.stream_options).toEqual({ include_usage: true });
    expect(out.tool_choice).toBe('required');
    expect(out.parallel_tool_calls).toBe(false);
    expect(out.tools).toEqual([
      { type: 'function', function: { name: 'Bash', description: 'run', parameters: { type: 'object', properties: {} } } },
    ]);
    expect(out.messages).toEqual([
      { role: 'system', content: 'You are Claude Code.\nBe brief.' },
      { role: 'user', content: 'list files' },
      {
        role: 'assistant',
        content: 'Running ls.',
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'Bash', arguments: '{"command":"ls"}' } }],
        reasoning_content: 'need ls',
      },
      { role: 'tool', tool_call_id: 'call_1', content: 'a.txt' },
      { role: 'user', content: 'thanks' },
    ]);
  });

  it('turns base64 images into data URLs, incl. images returned by tools', () => {
    const image = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } };
    const out = anthropicToOpenAIChat({
      model: 'm',
      messages: [
        { role: 'user', content: [image, { type: 'text', text: 'what is this?' }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: [image] }] },
      ],
    });
    const url = { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } };
    expect(out.messages).toEqual([
      { role: 'user', content: [url, { type: 'text', text: 'what is this?' }] },
      { role: 'tool', tool_call_id: 't', content: '' },
      { role: 'user', content: [url] },
    ]);
  });

  it('uses max_completion_tokens + reasoning_effort for OpenAI reasoning models', () => {
    const out = anthropicToOpenAIChat({
      model: 'gpt-5.2',
      max_tokens: 500,
      thinking: { type: 'enabled', budget_tokens: 8000 },
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(out.max_tokens).toBeUndefined();
    expect(out.max_completion_tokens).toBe(500);
    expect(out.reasoning_effort).toBe('medium');
  });

  it('never sends reasoning_effort to non-OpenAI models', () => {
    const out = anthropicToOpenAIChat({
      model: 'qwen-max',
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(out.reasoning_effort).toBeUndefined();
  });
});

describe('openAIChatToAnthropic (non-streaming response)', () => {
  it('maps reasoning, text, tool calls, finish_reason, and cached usage', () => {
    const out = openAIChatToAnthropic(
      {
        id: 'chatcmpl-9',
        model: 'up-model',
        choices: [
          {
            message: {
              reasoning_content: 'think',
              content: 'Checking.',
              tool_calls: [{ id: 'call_7', type: 'function', function: { name: 'Read', arguments: '{"path":"a"}' } }],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 60 } },
      },
      'fallback'
    );
    expect(out.content).toEqual([
      { type: 'thinking', thinking: 'think', signature: '' },
      { type: 'text', text: 'Checking.' },
      { type: 'tool_use', id: 'call_7', name: 'Read', input: { path: 'a' } },
    ]);
    expect(out.stop_reason).toBe('tool_use');
    expect(out.usage).toEqual({ input_tokens: 40, output_tokens: 20, cache_read_input_tokens: 60 });
  });

  it('maps length -> max_tokens and tolerates empty choices', () => {
    expect(
      openAIChatToAnthropic({ choices: [{ message: { content: 'x' }, finish_reason: 'length' }] }, 'm').stop_reason
    ).toBe('max_tokens');
    const empty = openAIChatToAnthropic({ choices: [], usage: { prompt_tokens: 3 } }, 'm');
    expect(empty.content).toEqual([]);
    expect(empty.stop_reason).toBe('end_turn');
    expect(empty.model).toBe('m');
  });
});

describe('OpenAIChatStreamTranslator', () => {
  const run = (chunks: string[]): { event: string; data: Json }[] => {
    const t = new OpenAIChatStreamTranslator('fallback');
    const out = chunks.flatMap((chunk) => t.push(chunk));
    out.push(...t.finish());
    return parseSse(out.join(''));
  };

  it('emits a well-formed Anthropic sequence for thinking -> text -> tool call', () => {
    const events = run([
      openAIChunk({ role: 'assistant', reasoning_content: 'hmm' }),
      openAIChunk({ content: 'Let me look.' }),
      openAIChunk({ tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'Bash', arguments: '' } }] }),
      openAIChunk({ tool_calls: [{ index: 0, function: { arguments: '{"command":' } }] }),
      openAIChunk({ tool_calls: [{ index: 0, function: { arguments: '"ls"}' } }] }),
      openAIChunk({}, 'tool_calls'),
      `data: ${JSON.stringify({ id: 'chatcmpl-1', choices: [], usage: { prompt_tokens: 50, completion_tokens: 9 } })}\n\n`,
      'data: [DONE]\n\n',
    ]);

    expect(events.map((e) => e.event)).toEqual([
      'message_start',
      'content_block_start', // 0 thinking
      'content_block_delta',
      'content_block_stop',
      'content_block_start', // 1 text
      'content_block_delta',
      'content_block_stop',
      'content_block_start', // 2 tool_use
      'content_block_delta',
      'content_block_delta',
      'content_block_stop',
      'message_delta',
      'message_stop',
    ]);
    expect(events[1].data.content_block.type).toBe('thinking');
    expect(events[7].data.content_block).toEqual({ type: 'tool_use', id: 'call_1', name: 'Bash', input: {} });
    const args = events
      .filter((e) => e.data.delta?.type === 'input_json_delta')
      .map((e) => e.data.delta.partial_json)
      .join('');
    expect(JSON.parse(args)).toEqual({ command: 'ls' });
    const delta = events[11].data;
    expect(delta.delta.stop_reason).toBe('tool_use');
    // usage arrives in the tail chunk AFTER finish_reason and must still land
    expect(delta.usage).toEqual({ input_tokens: 50, output_tokens: 9 });
  });

  it('buffers tool arguments that arrive before the tool name', () => {
    const events = run([
      openAIChunk({ tool_calls: [{ index: 0, id: 'c', function: { arguments: '{"a":' } }] }),
      openAIChunk({ tool_calls: [{ index: 0, function: { name: 'T', arguments: '1}' } }] }),
      openAIChunk({}, 'tool_calls'),
    ]);
    const start = events.find((e) => e.event === 'content_block_start');
    expect(start?.data.content_block.name).toBe('T');
    const args = events
      .filter((e) => e.data.delta?.type === 'input_json_delta')
      .map((e) => e.data.delta.partial_json)
      .join('');
    expect(args).toBe('{"a":1}');
  });

  it('reads usage attached to the finishing choice (Moonshot style)', () => {
    const chunk = `data: ${JSON.stringify({
      id: 'x',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop', usage: { prompt_tokens: 76, completion_tokens: 5, cached_tokens: 76, prompt_tokens_details: { cached_tokens: 76 } } }],
    })}\n\n`;
    const events = run([openAIChunk({ content: 'hi' }), chunk]);
    expect(events.at(-2)?.data.usage).toEqual({ input_tokens: 0, output_tokens: 5, cache_read_input_tokens: 76 });
  });

  it('still closes the message when the upstream ends without [DONE]', () => {
    const events = run([openAIChunk({ content: 'hi' }), openAIChunk({}, 'stop')]);
    expect(events.at(-2)?.event).toBe('message_delta');
    expect(events.at(-2)?.data.delta.stop_reason).toBe('end_turn');
    expect(events.at(-1)?.event).toBe('message_stop');
  });

  it('turns an in-stream error chunk into an Anthropic error event', () => {
    const t = new OpenAIChatStreamTranslator('m');
    const out = parseSse(t.push(`data: ${JSON.stringify({ error: { message: 'quota exceeded' } })}\n\n`).join(''));
    expect(out).toEqual([{ event: 'error', data: { type: 'error', error: { type: 'api_error', message: 'quota exceeded' } } }]);
    expect(t.finish()).toEqual([]);
  });
});

describe('ConfigManager api_format', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });
  const load = (apiFormat: string): ConfigManager => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccmr-oai-cfg-'));
    dirs.push(dir);
    const file = path.join(dir, 'models.yaml');
    fs.writeFileSync(
      file,
      `providers:\n  oai:\n    provider: openai-compat\n    base_url: https://api.example.com/v1\n    api_key_env: OAI_FAKE_KEY\n    api_format: ${apiFormat}\n    variants:\n      m:\n        display_name: M\n        model_id: m-1\n`
    );
    return new ConfigManager(file);
  };

  it('propagates provider api_format to expanded models', () => {
    expect(load('openai_chat').getModel('oai-m')?.api_format).toBe('openai_chat');
  });

  it('rejects unknown api_format values', () => {
    expect(() => load('openai_responses')).toThrow(/api_format must be anthropic or openai_chat/);
  });

  it('leaves built-in providers on the anthropic format', () => {
    expect(new ConfigManager(null).getModel('deepseek-flash')?.api_format).toBeUndefined();
  });
});

describe('ModelRouter with api_format: openai_chat (end-to-end)', () => {
  const dirs: string[] = [];
  const saved = process.env.OAI_E2E_KEY;
  let upstream: http.Server | undefined;
  const seen: { url?: string; auth?: string; body?: Json } = {};

  afterEach(async () => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
    if (saved === undefined) delete process.env.OAI_E2E_KEY;
    else process.env.OAI_E2E_KEY = saved;
    await new Promise((resolve) => (upstream ? upstream.close(() => resolve(null)) : resolve(null)));
    upstream = undefined;
    delete seen.url;
    delete seen.auth;
    delete seen.body;
  });

  const start = async (handler: (body: Json, res: http.ServerResponse) => void): Promise<ModelRouter> => {
    upstream = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        seen.url = req.url;
        seen.auth = req.headers.authorization;
        seen.body = JSON.parse(raw);
        handler(seen.body!, res);
      });
    });
    const port = await new Promise<number>((resolve) =>
      upstream!.listen(0, '127.0.0.1', () => resolve((upstream!.address() as AddressInfo).port))
    );
    process.env.OAI_E2E_KEY = 'sk-oai-fake';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccmr-oai-e2e-'));
    dirs.push(dir);
    const file = path.join(dir, 'models.yaml');
    fs.writeFileSync(
      file,
      `default_model: oai-m
providers:
  oai:
    provider: openai-compat
    base_url: http://127.0.0.1:${port}/v1
    api_key_env: OAI_E2E_KEY
    api_format: openai_chat
    default_variant: m
    variants:
      m:
        display_name: OAI M
        model_id: up-model
        max_tokens: 4096
`
    );
    return new ModelRouter(new ConfigManager(file));
  };

  it('posts Chat Completions with Bearer auth and returns an Anthropic message', async () => {
    const router = await start((_body, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          id: 'chatcmpl-x',
          model: 'up-model',
          choices: [{ message: { content: 'pong' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 1 },
        })
      );
    });
    const response = await router.forwardRequest(
      { model: 'oai-m', max_tokens: 10_000, messages: [{ role: 'user', content: 'ping' }] },
      {}
    );
    expect(seen.url).toBe('/v1/chat/completions');
    expect(seen.auth).toBe('Bearer sk-oai-fake');
    expect(seen.body).toMatchObject({ model: 'up-model', max_tokens: 4096, stream: false });
    expect(response).toMatchObject({
      type: 'message',
      content: [{ type: 'text', text: 'pong' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 5, output_tokens: 1 },
    });
  });

  it('streams translated Anthropic SSE', async () => {
    const router = await start((_body, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write(openAIChunk({ content: 'po' }));
      res.write(openAIChunk({ content: 'ng' }));
      res.write(openAIChunk({}, 'stop', { usage: { prompt_tokens: 7, completion_tokens: 2 } }));
      res.end('data: [DONE]\n\n');
    });
    let text = '';
    for await (const chunk of router.forwardStream(
      { model: 'oai-m', stream: true, max_tokens: 100, messages: [{ role: 'user', content: 'ping' }] },
      {}
    )) {
      text += chunk;
    }
    expect(seen.body).toMatchObject({ stream: true, stream_options: { include_usage: true } });
    const events = parseSse(text);
    expect(events[0].event).toBe('message_start');
    expect(
      events.filter((e) => e.data.delta?.type === 'text_delta').map((e) => e.data.delta.text).join('')
    ).toBe('pong');
    expect(events.at(-1)?.event).toBe('message_stop');
    expect(events.at(-2)?.data.usage).toEqual({ input_tokens: 7, output_tokens: 2 });
  });

  it('surfaces OpenAI-shaped upstream errors verbatim', async () => {
    const router = await start((_body, res) => {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Model Not Exist', type: 'invalid_request_error' } }));
    });
    await expect(
      router.forwardRequest({ model: 'oai-m', messages: [{ role: 'user', content: 'x' }] }, {})
    ).rejects.toThrow(/Model Not Exist/);
  });

  it('answers count_tokens with a 404 instead of calling a non-existent endpoint', async () => {
    const router = await start(() => undefined);
    await expect(
      router.forwardCountTokens({ model: 'oai-m', messages: [{ role: 'user', content: 'x' }] }, {})
    ).rejects.toMatchObject({ statusCode: 404 } satisfies Partial<RouterError>);
    expect(seen.url).toBeUndefined();
  });
});
