/**
 * Express server for Claude Code Model Router
 */

import express, { Request, Response, NextFunction } from 'express';
import { ConfigManager } from './config.js';
import { ModelRouter, RouterError } from './router.js';
import type { MessagesRequest } from './types.js';

export function createServer(configManager: ConfigManager) {
  const app = express();
  const router = new ModelRouter(configManager);
  const config = configManager.getConfig();

  // Middleware
  app.use(express.json({ limit: '50mb' }));

  // Logging middleware
  if (config.gateway.enable_logging) {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      if (req.path !== '/health') {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      }
      next();
    });
  }

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    const models: Record<string, string> = {};
    for (const [name] of Object.entries(config.models)) {
      models[name] = configManager.getApiKey(name) ? 'available' : 'no_api_key';
    }

    res.json({
      status: 'healthy',
      version: '1.0.0',
      default_model: config.default_model,
      models,
    });
  });

  // List models
  app.get('/v1/models', (_req: Request, res: Response) => {
    const data = Object.entries(config.models).map(([id, model]) => ({
      id,
      object: 'model',
      display_name: model.display_name,
      provider: model.provider,
      model_id: model.model_id,
      available: !!configManager.getApiKey(id),
    }));

    res.json({ object: 'list', data });
  });

  // Messages endpoint
  app.post('/v1/messages', async (req: Request, res: Response) => {
    try {
      const body = req.body as MessagesRequest;

      // Use default model if not specified
      if (!body.model) {
        body.model = config.default_model;
      }

      // Get original headers for forwarding
      const originalHeaders: Record<string, string> = {};
      if (req.headers['anthropic-beta']) {
        originalHeaders['anthropic-beta'] = req.headers['anthropic-beta'] as string;
      }
      if (req.headers['anthropic-version']) {
        originalHeaders['anthropic-version'] = req.headers['anthropic-version'] as string;
      }

      // Check if streaming
      if (body.stream) {
        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Model-Router', body.model);

        // Stream the response
        for await (const chunk of router.forwardStream(body, originalHeaders)) {
          res.write(chunk);
        }
        res.end();
      } else {
        // Non-streaming response
        const response = await router.forwardRequest(body, originalHeaders);

        if (config.gateway.enable_logging) {
          res.setHeader('X-Model-Router', body.model);
        }

        res.json(response);
      }
    } catch (error) {
      if (error instanceof RouterError) {
        res.status(error.statusCode).json(error.toErrorResponse());
      } else {
        console.error('Unexpected error:', error);
        res.status(500).json({
          type: 'error',
          error: {
            type: 'internal_error',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  });

  // Token counting (not implemented)
  app.post('/v1/messages/count_tokens', (_req: Request, res: Response) => {
    res.status(501).json({
      type: 'error',
      error: {
        type: 'not_implemented',
        message: 'Token counting is not yet implemented',
      },
    });
  });

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      type: 'error',
      error: {
        type: 'not_found',
        message: 'Endpoint not found',
      },
    });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({
      type: 'error',
      error: {
        type: 'internal_error',
        message: err.message,
      },
    });
  });

  return app;
}

export function startServer(configManager: ConfigManager): void {
  const app = createServer(configManager);
  const config = configManager.getConfig();
  const { host, port } = config.gateway;

  app.listen(port, host, () => {
    console.log('');
    console.log('============================================================');
    console.log('  Claude Code Model Router');
    console.log('============================================================');
    console.log('');
    console.log(`Gateway running at: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    console.log(`Default model: ${config.default_model}`);
    console.log('');
    console.log('Available models:');

    for (const [name, model] of Object.entries(config.models)) {
      const hasKey = !!configManager.getApiKey(name);
      const status = hasKey ? '\x1b[32m[Ready]\x1b[0m' : '\x1b[33m[No API Key]\x1b[0m';
      console.log(`  - ${name}: ${model.display_name} ${status}`);
    }

    console.log('');
    console.log('Press Ctrl+C to stop the gateway.');
    console.log('============================================================');
    console.log('');
  });
}
