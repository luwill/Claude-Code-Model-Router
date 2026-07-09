/**
 * Runtime smoke test for the built dist/, using only Node built-ins and
 * production dependencies.
 *
 * Exists because the test runner (vitest 4) requires Node >=20.19 while the
 * package supports Node >=18. Without this, the engines floor is an unverified
 * claim — exactly how an ESM-only node-fetch once shipped and crashed users on
 * Node 18/20 while passing locally on 24.
 *
 * Covers: module loading (ERR_REQUIRE_ESM), config discovery, /health,
 * non-streaming forwarding, and SSE passthrough (built-in fetch returns a Web
 * ReadableStream, whose async iteration differs from the old node-fetch stream).
 *
 * Usage: node scripts/smoke.mjs
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GATEWAY_PORT = 8099;

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  \x1b[32mok\x1b[0m   ${name}`);
  } else {
    failures++;
    console.log(`  \x1b[31mFAIL\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function waitFor(fn, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

// 1. The published entry point must load under CJS require() on this Node version.
const require = createRequire(import.meta.url);
const pkg = require(path.join(repoRoot, 'dist', 'index.js'));
check('dist/index.js loads via require()', typeof pkg.createServer === 'function');
check('ConfigManager is exported', typeof pkg.ConfigManager === 'function');

// 2. Scratch config pointing at a local fake upstream, so no real key is used.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccmr-smoke-'));
const configPath = path.join(tmpDir, 'models.yaml');

const upstream = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : {};
    if (body.stream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(
        'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":3,"output_tokens":0}}}\n\n'
      );
      res.write(
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"pong"}}\n\n'
      );
      res.write('event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":2}}\n\n');
      res.end();
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          id: 'msg_smoke',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'pong' }],
          model: 'smoke-001',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 3, output_tokens: 2 },
        })
      );
    }
  });
});

let gateway;
try {
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const upstreamPort = upstream.address().port;

  fs.writeFileSync(
    configPath,
    `default_model: smoke-v1
providers:
  smoke:
    display_name: Smoke Upstream
    provider: custom
    base_url: http://127.0.0.1:${upstreamPort}
    api_key_env: SMOKE_TEST_KEY
    auth_header: Authorization
    auth_type: bearer
    default_variant: v1
    variants:
      v1:
        display_name: "Smoke Model V1"
        model_id: smoke-001
        max_tokens: 4096
        context_window: 128000
`
  );

  // 3. Start the gateway from the committed dist, isolated from any real config.
  gateway = spawn(
    process.execPath,
    [path.join(repoRoot, 'dist', 'cli.js'), 'start', '-p', String(GATEWAY_PORT), '-c', configPath],
    {
      env: { ...process.env, SMOKE_TEST_KEY: 'sk-smoke', CCMR_HOME: tmpDir },
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: tmpDir,
    }
  );
  let gatewayOutput = '';
  gateway.stdout.on('data', (d) => (gatewayOutput += d));
  gateway.stderr.on('data', (d) => (gatewayOutput += d));

  const base = `http://127.0.0.1:${GATEWAY_PORT}`;
  const up = await waitFor(async () => {
    try {
      return (await fetch(`${base}/health`)).ok;
    } catch {
      return false;
    }
  });
  check('gateway starts and answers /health', up, gatewayOutput.slice(-400));
  if (!up) throw new Error('gateway never became healthy');

  const health = await (await fetch(`${base}/health`)).json();
  check('/health reports the loaded config file', health.config_file === configPath);
  check('/health reports the model as available', health.models['smoke-v1'] === 'available');

  // 4. Non-streaming forwarding.
  const jsonRes = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'smoke-v1',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  });
  const json = await jsonRes.json();
  check('non-streaming request forwards and returns content', json?.content?.[0]?.text === 'pong');

  // 5. SSE passthrough — the built-in-fetch ReadableStream path.
  const streamRes = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'smoke-v1',
      max_tokens: 16,
      stream: true,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  });
  const sse = await streamRes.text();
  check('SSE stream passes message_start through', sse.includes('message_start'));
  check('SSE stream passes text deltas through', sse.includes('"text":"pong"'));
  check('SSE stream passes message_delta through', sse.includes('message_delta'));

  // 6. Usage accounting parsed the stream.
  const usage = await (await fetch(`${base}/usage`)).json();
  check('usage counts both requests', usage.totals.requests === 2, JSON.stringify(usage.totals));
} finally {
  if (gateway) gateway.kill();
  upstream.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log('');
if (failures > 0) {
  console.error(`Smoke test FAILED on Node ${process.version} (${failures} check(s))`);
  process.exit(1);
}
console.log(`Smoke test passed on Node ${process.version}`);
