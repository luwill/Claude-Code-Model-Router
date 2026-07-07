/**
 * Baseline tests for ModelRouter: URL building, auth headers,
 * request body normalization, and route resolution errors.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { ConfigManager } from '../src/config.js';
import { ModelRouter, RouterError } from '../src/router.js';
import type { MessagesRequest, ModelConfig } from '../src/types.js';

function makeModelConfig(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    display_name: 'Test Model',
    provider: 'custom',
    model_id: 'test-model-001',
    base_url: 'https://api.example.com',
    api_key_env: 'TEST_KEY',
    ...overrides,
  };
}

function makeRequest(overrides: Partial<MessagesRequest> = {}): MessagesRequest {
  return {
    model: 'test',
    messages: [{ role: 'user', content: 'hi' }],
    max_tokens: 100,
    ...overrides,
  };
}

const manager = new ConfigManager('/nonexistent/models.yaml');
const router = new ModelRouter(manager);

describe('ModelRouter.buildUrl', () => {
  it('appends /v1/messages for /anthropic-style base URLs', () => {
    expect(router.buildUrl(makeModelConfig({ base_url: 'https://api.deepseek.com/anthropic' })))
      .toBe('https://api.deepseek.com/anthropic/v1/messages');
    expect(router.buildUrl(makeModelConfig({ base_url: 'https://api.z.ai/api/anthropic' })))
      .toBe('https://api.z.ai/api/anthropic/v1/messages');
  });

  it('appends /v1/messages for /coding base URLs (Volcengine coding plan)', () => {
    expect(
      router.buildUrl(makeModelConfig({ base_url: 'https://ark.cn-beijing.volces.com/api/coding' }))
    ).toBe('https://ark.cn-beijing.volces.com/api/coding/v1/messages');
  });

  it('appends the endpoint for plain base URLs (compatible/plan endpoints)', () => {
    expect(
      router.buildUrl(
        makeModelConfig({ base_url: 'https://ark.cn-beijing.volces.com/api/compatible' })
      )
    ).toBe('https://ark.cn-beijing.volces.com/api/compatible/v1/messages');
    expect(
      router.buildUrl(makeModelConfig({ base_url: 'https://ark.cn-beijing.volces.com/api/plan' }))
    ).toBe('https://ark.cn-beijing.volces.com/api/plan/v1/messages');
  });

  it('strips trailing slashes before joining', () => {
    expect(router.buildUrl(makeModelConfig({ base_url: 'https://api.example.com/anthropic/' })))
      .toBe('https://api.example.com/anthropic/v1/messages');
  });
});

describe('ModelRouter.buildHeaders', () => {
  const route = (config: ModelConfig) => ({ name: 'test', config, apiKey: 'sk-test' });

  it('uses x-api-key with raw key by default', () => {
    const headers = router.buildHeaders(route(makeModelConfig()), {});
    expect(headers['x-api-key']).toBe('sk-test');
  });

  it('uses Bearer prefix for authorization header auth', () => {
    const headers = router.buildHeaders(
      route(makeModelConfig({ auth_header: 'Authorization', auth_type: 'bearer' })),
      {}
    );
    expect(headers['Authorization']).toBe('Bearer sk-test');
  });

  it('infers bearer when auth_header is Authorization without explicit auth_type', () => {
    const headers = router.buildHeaders(
      route(makeModelConfig({ auth_header: 'Authorization' })),
      {}
    );
    expect(headers['Authorization']).toBe('Bearer sk-test');
  });

  it('adds anthropic-version only for the anthropic provider', () => {
    const anthropicHeaders = router.buildHeaders(
      route(makeModelConfig({ provider: 'anthropic' })),
      { 'anthropic-beta': 'beta-flag' }
    );
    expect(anthropicHeaders['anthropic-version']).toBe('2023-06-01');
    expect(anthropicHeaders['anthropic-beta']).toBe('beta-flag');

    const otherHeaders = router.buildHeaders(route(makeModelConfig()), {
      'anthropic-beta': 'beta-flag',
    });
    expect(otherHeaders['anthropic-version']).toBeUndefined();
  });
});

describe('ModelRouter.buildRequestBody', () => {
  it('replaces the model name with the provider model_id', () => {
    const body = router.buildRequestBody(makeRequest(), makeModelConfig());
    expect(body.model).toBe('test-model-001');
  });

  it('caps max_tokens at the model limit', () => {
    const body = router.buildRequestBody(
      makeRequest({ max_tokens: 999999 }),
      makeModelConfig({ max_tokens: 32768 })
    );
    expect(body.max_tokens).toBe(32768);
  });

  it('leaves max_tokens alone when under the limit', () => {
    const body = router.buildRequestBody(
      makeRequest({ max_tokens: 1000 }),
      makeModelConfig({ max_tokens: 32768 })
    );
    expect(body.max_tokens).toBe(1000);
  });

  it('strips metadata and user_id for deepseek', () => {
    const body = router.buildRequestBody(
      makeRequest({ metadata: { user_id: 'session-x' }, user_id: 'session-x' }),
      makeModelConfig({ provider: 'deepseek' })
    );
    expect(body.metadata).toBeUndefined();
    expect(body.user_id).toBeUndefined();
  });

  it('keeps metadata for other providers', () => {
    const body = router.buildRequestBody(
      makeRequest({ metadata: { user_id: 'session-x' } }),
      makeModelConfig({ provider: 'moonshot' })
    );
    expect(body.metadata).toEqual({ user_id: 'session-x' });
  });

  it('does not mutate the original request', () => {
    const request = makeRequest({ max_tokens: 999999 });
    router.buildRequestBody(request, makeModelConfig({ max_tokens: 32768 }));
    expect(request.max_tokens).toBe(999999);
  });
});

describe('ModelRouter.resolveRoute', () => {
  // The repo may have a local .env loaded by dotenv at import time,
  // so key-related tests snapshot and restore the ambient value.
  const originalKimiKey = process.env.KIMI_API_KEY;

  afterEach(() => {
    if (originalKimiKey === undefined) {
      delete process.env.KIMI_API_KEY;
    } else {
      process.env.KIMI_API_KEY = originalKimiKey;
    }
  });

  it('throws 400 invalid_model for unknown models', () => {
    try {
      router.resolveRoute('no-such-model');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RouterError);
      expect((error as RouterError).statusCode).toBe(400);
      expect((error as RouterError).errorType).toBe('invalid_model');
      expect((error as RouterError).message).toContain('no-such-model');
    }
  });

  it('throws 401 with the env var name when the API key is missing', () => {
    delete process.env.KIMI_API_KEY;
    const localRouter = new ModelRouter(new ConfigManager('/nonexistent/models.yaml'));
    try {
      localRouter.resolveRoute('kimi-k2.6');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RouterError);
      expect((error as RouterError).statusCode).toBe(401);
      expect((error as RouterError).message).toContain('KIMI_API_KEY');
    }
  });

  it('resolves aliases end-to-end when the key is present', () => {
    process.env.KIMI_API_KEY = 'sk-live';
    const localManager = new ConfigManager('/nonexistent/models.yaml');
    const localRouter = new ModelRouter(localManager);
    const route = localRouter.resolveRoute('kimi-code');
    expect(route.name).toBe('kimi-k2.7-code');
    expect(route.config.model_id).toBe('kimi-k2.7-code');
    expect(route.apiKey).toBe('sk-live');
  });
});
