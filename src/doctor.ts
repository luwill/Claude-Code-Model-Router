/**
 * Connectivity self-check for configured models (`ccmr doctor`).
 *
 * Sends a minimal real request through the exact same routing path the
 * gateway uses, so endpoint mistakes, auth problems, and account-side
 * blockers (e.g. Volcengine ModelNotOpen) surface at configuration time
 * instead of mid-session.
 */

import type { ConfigManager } from './config.js';
import { ModelRouter, RouterError } from './router.js';

export interface DoctorOptions {
  /** Specific model names/aliases to check; defaults to every configured model. */
  models?: string[];
  /** Per-check timeout in seconds (default 30). */
  timeout?: number;
}

export interface DoctorResult {
  model: string;
  displayName: string;
  provider: string;
  status: 'ok' | 'fail' | 'skipped';
  latencyMs?: number;
  detail?: string;
}

const DEFAULT_DOCTOR_TIMEOUT_SECONDS = 30;

export async function checkModels(
  configManager: ConfigManager,
  options: DoctorOptions = {}
): Promise<DoctorResult[]> {
  const config = configManager.getConfig();
  // Doctor owns this ConfigManager instance; shorten the forwarding timeout
  // so a hung provider does not stall the whole report, and silence the
  // router's per-request logging so the report stays clean.
  config.gateway.timeout = options.timeout ?? DEFAULT_DOCTOR_TIMEOUT_SECONDS;
  config.gateway.enable_logging = false;

  const router = new ModelRouter(configManager);
  const targets =
    options.models ??
    Object.entries(config.models)
      .filter(([name, model]) => !(model.provider_key && name === model.provider_key))
      .map(([name]) => name);

  return Promise.all(targets.map((name) => checkOne(configManager, router, name)));
}

async function checkOne(
  configManager: ConfigManager,
  router: ModelRouter,
  name: string
): Promise<DoctorResult> {
  const model = configManager.getModel(name);
  if (!model) {
    return {
      model: name,
      displayName: name,
      provider: 'unknown',
      status: 'fail',
      detail: `Model '${name}' not found`,
    };
  }

  const base: Omit<DoctorResult, 'status'> = {
    model: name,
    displayName: model.display_name,
    provider: model.provider,
  };

  if (!configManager.getApiKey(name)) {
    return { ...base, status: 'skipped', detail: `${model.api_key_env} not set` };
  }

  const started = Date.now();
  try {
    await router.forwardRequest(
      {
        model: name,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'hi' }],
      },
      {}
    );
    return { ...base, status: 'ok', latencyMs: Date.now() - started };
  } catch (error) {
    const detail =
      error instanceof RouterError
        ? `[${error.statusCode}] ${error.message}`
        : error instanceof Error
          ? error.message
          : 'Unknown error';
    return { ...base, status: 'fail', latencyMs: Date.now() - started, detail };
  }
}
