/**
 * Request routing and forwarding logic
 */

import type { ConfigManager } from './config.js';
import type {
  MessagesRequest,
  MessagesResponse,
  ErrorResponse,
  ModelConfig,
  RouteInfo,
} from './types.js';

export class RouterError extends Error {
  statusCode: number;
  errorType: string;

  constructor(message: string, statusCode = 500, errorType = 'router_error') {
    super(message);
    this.name = 'RouterError';
    this.statusCode = statusCode;
    this.errorType = errorType;
  }

  toErrorResponse(): ErrorResponse {
    return {
      type: 'error',
      error: {
        type: this.errorType,
        message: this.message,
      },
    };
  }
}

export class ModelRouter {
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  resolveRoute(modelName: string): RouteInfo {
    const resolvedName = this.configManager.resolveModelName(modelName);
    const modelConfig = this.configManager.getModel(resolvedName);

    if (!modelConfig) {
      const availableModels = Object.keys(this.configManager.getConfig().models).join(', ');
      throw new RouterError(
        `Model '${modelName}' not found. Available models: ${availableModels}`,
        400,
        'invalid_model'
      );
    }

    const apiKey = this.configManager.getApiKey(resolvedName);
    if (!apiKey) {
      throw new RouterError(
        `API key not configured for model '${modelConfig.display_name}'. ` +
          `Please set the ${modelConfig.api_key_env} environment variable.`,
        401,
        'authentication_error'
      );
    }

    return {
      name: resolvedName,
      config: modelConfig,
      apiKey,
    };
  }

  buildHeaders(route: RouteInfo, originalHeaders: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      [route.config.auth_header || 'x-api-key']: route.apiKey,
    };

    // Add Anthropic-specific headers for Anthropic provider
    if (route.config.provider === 'anthropic') {
      headers['anthropic-version'] = '2023-06-01';
      if (originalHeaders['anthropic-beta']) {
        headers['anthropic-beta'] = originalHeaders['anthropic-beta'];
      }
    }

    return headers;
  }

  buildRequestBody(request: MessagesRequest, modelConfig: ModelConfig): Record<string, unknown> {
    const body = { ...request };

    // Replace model name with actual model ID
    body.model = modelConfig.model_id;

    // Cap max_tokens if exceeds model limit
    const maxTokens = modelConfig.max_tokens || 8192;
    if (body.max_tokens && body.max_tokens > maxTokens) {
      body.max_tokens = maxTokens;
    }

    return body;
  }

  buildUrl(modelConfig: ModelConfig, endpoint = '/v1/messages'): string {
    let baseUrl = modelConfig.base_url.replace(/\/$/, '');

    // Handle different API structures
    if (modelConfig.provider === 'anthropic') {
      return `${baseUrl}${endpoint}`;
    }

    // For other providers with /anthropic or /coding in base URL
    if (
      baseUrl.includes('/anthropic') ||
      baseUrl.includes('/coding') ||
      baseUrl.includes('/apps/anthropic')
    ) {
      return `${baseUrl}/v1/messages`;
    }

    return `${baseUrl}${endpoint}`;
  }

  async forwardRequest(
    request: MessagesRequest,
    originalHeaders: Record<string, string>
  ): Promise<MessagesResponse> {
    const route = this.resolveRoute(request.model);
    const headers = this.buildHeaders(route, originalHeaders);
    const body = this.buildRequestBody(request, route.config);
    const url = this.buildUrl(route.config);

    // Ensure stream is false for non-streaming
    body.stream = false;

    const timeout = this.configManager.getConfig().gateway.timeout * 1000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorText;
        } catch {
          // Use raw text
        }

        throw new RouterError(
          `Upstream API error (${route.config.provider}): ${errorMessage}`,
          response.status,
          'api_error'
        );
      }

      const data = (await response.json()) as MessagesResponse;

      if (this.configManager.getConfig().gateway.enable_logging) {
        console.log(
          `[${route.name}] Request completed | ` +
            `Input: ${data.usage?.input_tokens ?? 'N/A'} | ` +
            `Output: ${data.usage?.output_tokens ?? 'N/A'}`
        );
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof RouterError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new RouterError(
            `Request timed out after ${timeout / 1000}s`,
            504,
            'timeout_error'
          );
        }
        throw new RouterError(
          `Connection error: ${error.message}`,
          502,
          'connection_error'
        );
      }

      throw new RouterError('Unknown error occurred', 500, 'internal_error');
    }
  }

  async *forwardStream(
    request: MessagesRequest,
    originalHeaders: Record<string, string>
  ): AsyncGenerator<string> {
    const route = this.resolveRoute(request.model);
    const headers = this.buildHeaders(route, originalHeaders);
    const body = this.buildRequestBody(request, route.config);
    const url = this.buildUrl(route.config);

    // Ensure stream is true
    body.stream = true;
    headers.Accept = 'text/event-stream';

    const timeout = this.configManager.getConfig().gateway.timeout * 1000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorText;
        } catch {
          // Use raw text
        }

        const errorEvent = {
          type: 'error',
          error: { type: 'api_error', message: errorMessage },
        };
        yield `event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`;
        return;
      }

      if (!response.body) {
        throw new RouterError('No response body', 500, 'internal_error');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let eventCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete SSE events
        while (buffer.includes('\n\n')) {
          const idx = buffer.indexOf('\n\n');
          const event = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (event.trim()) {
            eventCount++;
            yield event + '\n\n';
          }
        }
      }

      // Don't forget remaining data
      if (buffer.trim()) {
        eventCount++;
        yield buffer + '\n\n';
      }

      console.log(`[${route.name}] Yielded ${eventCount} events`);

      if (this.configManager.getConfig().gateway.enable_logging) {
        console.log(`[${route.name}] Stream completed`);
      }
    } catch (error) {
      clearTimeout(timeoutId);

      let errorMessage = 'Unknown error';
      let errorType = 'internal_error';

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = `Request timed out after ${timeout / 1000}s`;
          errorType = 'timeout_error';
        } else {
          errorMessage = error.message;
        }
      }

      const errorEvent = {
        type: 'error',
        error: { type: errorType, message: errorMessage },
      };
      yield `event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`;
    }
  }
}
