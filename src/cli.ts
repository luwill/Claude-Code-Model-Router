#!/usr/bin/env node

/**
 * CLI for Claude Code Model Router
 */

import { InvalidArgumentError, program } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { ConfigManager, generateConfigFile, generateEnvFile } from './config.js';
import { persistDefaultModel } from './default-model.js';
import { checkModels } from './doctor.js';
import { ensureEnvIgnored } from './env-guard.js';
import { DEFAULT_SCAN_PORTS, discoverGateways, stopGateway } from './gateway-control.js';
import { checkGatewayModel, checkGatewaySource, ensureGatewayRunning } from './launcher.js';
import { ccmrHome } from './paths.js';
import { startServer } from './server.js';
import { VERSION } from './version.js';

program
  .name('ccmr')
  .description('Claude Code Model Router - A lightweight API gateway for multi-model switching')
  .version(VERSION);

// Start command
program
  .command('start')
  .description('Start the model router gateway')
  .option('-p, --port <port>', 'Port to listen on (defaults to config)', parsePort)
  .option('-c, --config <path>', 'Path to config file')
  .option(
    '--host <host>',
    'Host to bind to (defaults to config; non-loopback requires authentication)'
  )
  .option(
    '--allow-insecure-network',
    'Allow a non-loopback bind without inbound authentication (unsafe)'
  )
  .action((options) => {
    try {
      const configManager = new ConfigManager(options.config);

      // Override port if specified
      if (options.port !== undefined) {
        configManager.getConfig().gateway.port = options.port;
      }
      if (options.host !== undefined) {
        configManager.getConfig().gateway.host = options.host;
      }

      startServer(configManager, { allowInsecureNetwork: options.allowInsecureNetwork });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  });

// Init command
program
  .command('init')
  .description('Initialize configuration files (current directory, or ~/.ccmr with --global)')
  .option('-f, --force', 'Overwrite existing files')
  .option('-g, --global', 'Write to ~/.ccmr so every directory can use the same config')
  .action((options) => {
    const targetDir = options.global ? ccmrHome() : process.cwd();
    if (options.global) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const configPath = path.join(targetDir, 'models.yaml');
    const envPath = path.join(targetDir, '.env');

    console.log('');
    console.log(`Initializing Claude Code Model Router in ${targetDir}...`);
    console.log('');

    // Create config file
    if (fs.existsSync(configPath) && !options.force) {
      console.log(`[SKIP] ${configPath} already exists (use --force to overwrite)`);
    } else {
      fs.writeFileSync(configPath, generateConfigFile());
      console.log(`[CREATE] ${configPath}`);
    }

    // Create .env file
    if (fs.existsSync(envPath) && !options.force) {
      console.log(`[SKIP] ${envPath} already exists (use --force to overwrite)`);
    } else {
      fs.writeFileSync(envPath, generateEnvFile());
      console.log(`[CREATE] ${envPath}`);
    }

    // .env holds plaintext API keys - keep it out of version control
    if (!options.global) {
      const guard = ensureEnvIgnored(targetDir);
      if (guard === 'added') {
        console.log('[GUARD] Added .env to .gitignore (API keys must never be committed)');
      } else if (guard === 'no-git') {
        console.log('[WARN] Not a git repository - keep .env out of any version control');
      }
    }

    console.log('');
    console.log('Next steps:');
    console.log('  1. Edit .env and add your API keys');
    console.log('  2. (Optional) Verify connectivity: npx claude-code-model-router doctor');
    console.log('  3. Start Claude Code (the gateway auto-starts if needed):');
    console.log('');
    console.log('     # For third-party models (gateway mode):');
    console.log('     npx claude-code-model-router claude');
    console.log('');
    console.log('     # For official subscription (default mode):');
    console.log('     claude');
    console.log('');
  });

// Models command
program
  .command('models')
  .description('List available models')
  .option('-c, --config <path>', 'Path to config file')
  .action((options) => {
    try {
      const configManager = new ConfigManager(options.config);
      const models = configManager.listModels();

      console.log('');
      console.log('Available models:');
      console.log('');

      const modelEntries = Object.entries(models);
      const nameWidth = Math.max(28, ...modelEntries.map(([name]) => name.length + 2));
      const displayWidth = Math.max(
        26,
        ...modelEntries.map(([, info]) => info.displayName.length + 2)
      );
      const providerWidth = Math.max(
        24,
        ...modelEntries.map(([, info]) => {
          const provider = info.variant ? `${info.provider}/${info.variant}` : info.provider;
          return provider.length + 2;
        })
      );

      for (const [name, info] of modelEntries) {
        const status = info.available
          ? '\x1b[32m[Ready]\x1b[0m'
          : '\x1b[33m[No API Key]\x1b[0m';
        const provider = info.variant ? `${info.provider}/${info.variant}` : info.provider;
        console.log(
          `  ${name.padEnd(nameWidth)} ${info.displayName.padEnd(displayWidth)} ${provider.padEnd(providerWidth)} ${status}`
        );
      }

      console.log('');
      console.log('Aliases:');
      const config = configManager.getConfig();
      for (const [alias, target] of Object.entries(config.aliases)) {
        console.log(`  ${alias} -> ${target}`);
      }
      console.log('');
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

function parsePort(value: string): number {
  if (!/^\d+$/.test(value.trim())) {
    throw new InvalidArgumentError('Port must be an integer from 1 to 65535.');
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new InvalidArgumentError('Port must be an integer from 1 to 65535.');
  }
  return port;
}

function parsePositiveInteger(value: string): number {
  if (!/^\d+$/.test(value.trim()) || Number(value) < 1) {
    throw new InvalidArgumentError('Value must be a positive integer.');
  }
  return Number(value);
}

function parsePortList(value: string): number[] {
  const rawPorts = value.split(',').map((item) => item.trim());
  if (rawPorts.length === 0 || rawPorts.some((item) => item.length === 0)) {
    throw new InvalidArgumentError('Ports must be a comma-separated list.');
  }
  return [...new Set(rawPorts.map(parsePort))];
}

function clientAuthToken(): string | undefined {
  return process.env.CCMR_AUTH_TOKEN || process.env.CCMR_REQUIRED_AUTH_TOKEN || undefined;
}

// Status command - find gateways running on this machine
program
  .command('status')
  .description('List running ccmr gateways (including ones auto-started by `ccmr claude`)')
  .option('--ports <ports>', 'Comma-separated ports to scan (default: 8080-8099)', parsePortList)
  .action(async (options) => {
    const ports: number[] = options.ports ?? DEFAULT_SCAN_PORTS;
    const gateways = await discoverGateways(ports);

    console.log('');
    if (gateways.length === 0) {
      console.log(`No ccmr gateway found on ports ${ports[0]}-${ports[ports.length - 1]}.`);
      console.log('');
      return;
    }

    for (const gateway of gateways) {
      const keys = `${gateway.modelsReady}/${gateway.modelsTotal} models ready`;
      const health = gateway.modelsReady === 0 ? '\x1b[33m' + keys + '\x1b[0m' : keys;
      console.log(`Gateway on port ${gateway.port}`);
      console.log(`  PID:           ${gateway.pid ?? '(unknown - gateway older than 1.8.2)'}`);
      console.log(`  Version:       ${gateway.version ?? 'unknown'}`);
      console.log(`  Default model: ${gateway.default_model ?? 'unknown'}`);
      console.log(`  Config file:   ${gateway.config_file ?? 'built-in defaults (no config file)'}`);
      console.log(`  API keys:      ${health}`);
      console.log('');
    }

    console.log(`Stop one with: ccmr stop --port <port>`);
    console.log('');
  });

// Stop command - shut a gateway down without hunting for its pid
program
  .command('stop')
  .description('Stop a running ccmr gateway')
  .option('-p, --port <port>', 'Gateway port (defaults to config)', parsePort)
  .option('--all', 'Stop every ccmr gateway found on the default port range')
  .option('--force', 'Escalate to SIGKILL if the gateway ignores SIGTERM')
  .action(async (options) => {
    const configuredPort =
      options.all || options.port !== undefined
        ? undefined
        : new ConfigManager().getConfig().gateway.port;
    const ports: number[] = options.all
      ? (await discoverGateways()).map((gateway) => gateway.port)
      : [options.port ?? configuredPort!];

    if (options.all && ports.length === 0) {
      console.log('');
      console.log('No ccmr gateway is running.');
      console.log('');
      return;
    }

    let failed = false;
    console.log('');
    for (const port of ports) {
      const result = await stopGateway(port, { force: options.force });

      switch (result.status) {
        case 'stopped':
          console.log(`\x1b[32m[OK]\x1b[0m Stopped gateway on port ${port} (pid ${result.pid})`);
          break;
        case 'not_running':
          console.log(`No ccmr gateway is listening on port ${port}.`);
          break;
        case 'unknown_process':
          // Refusing here is the whole point: never signal a stranger's process.
          failed = true;
          console.error(
            `\x1b[31m[ERROR]\x1b[0m Port ${port} is in use by something that is not a ccmr gateway.` +
              ' Refusing to stop it.'
          );
          break;
        case 'no_pid':
          failed = true;
          console.error(
            `\x1b[31m[ERROR]\x1b[0m The gateway on port ${port} (v${result.version}) is too old to` +
              ' report its pid.'
          );
          console.error(`  Stop it with: pkill -f "cli.js start --port ${port}"`);
          break;
        case 'unverified_gateway':
          failed = true;
          console.error(
            `\x1b[31m[ERROR]\x1b[0m Gateway on port ${port} has no matching local identity record.`
          );
          console.error('  Refusing to trust a PID supplied only through HTTP.');
          console.error('  Restart this gateway with the current ccmr version, then retry.');
          break;
        case 'still_running':
          failed = true;
          console.error(
            `\x1b[31m[ERROR]\x1b[0m Gateway on port ${port} (pid ${result.pid}) ignored SIGTERM.`
          );
          console.error('  Retry with: ccmr stop --port ' + port + ' --force');
          break;
      }
    }
    console.log('');

    if (failed) {
      process.exit(1);
    }
  });

// Use command - persist the default model without hand-editing YAML
program
  .command('use')
  .description('Set the default model (persisted to the active models.yaml)')
  .argument('<model>', 'Model name or alias (see: ccmr models)')
  .option('-c, --config <path>', 'Path to config file')
  .action((modelName: string, options) => {
    try {
      const configManager = new ConfigManager(options.config);
      const model = configManager.getModel(modelName);
      if (!model) {
        console.error(`Model '${modelName}' not found. Run 'ccmr models' to list available models.`);
        process.exit(1);
      }

      const resolved = configManager.resolveModelName(modelName);
      let target = configManager.getConfigFilePath();
      if (!target) {
        // No config file anywhere yet - persist the preference globally
        fs.mkdirSync(ccmrHome(), { recursive: true });
        target = path.join(ccmrHome(), 'models.yaml');
      }
      persistDefaultModel(target, resolved);

      console.log('');
      console.log(`Default model set to: ${resolved} (${model.display_name})`);
      console.log(`Updated: ${target}`);
      console.log('A running gateway using this config picks the change up automatically.');
      console.log('');
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

// Doctor command - real connectivity check per model
program
  .command('doctor')
  .description('Check model connectivity (sends one tiny real request per configured model)')
  .argument('[models...]', 'Specific models or aliases to check (default: all)')
  .option('-c, --config <path>', 'Path to config file')
  .option('--timeout <seconds>', 'Per-check timeout in seconds', parsePositiveInteger, 30)
  .action(async (models: string[], options) => {
    try {
      const configManager = new ConfigManager(options.config);
      console.log('');
      console.log('Checking model connectivity (one tiny request per model)...');
      console.log('');

      const results = await checkModels(configManager, {
        models: models.length > 0 ? models : undefined,
        timeout: options.timeout,
      });

      const nameWidth = Math.max(24, ...results.map((r) => r.model.length + 2));
      for (const r of results) {
        const status =
          r.status === 'ok'
            ? '\x1b[32m[OK]  \x1b[0m'
            : r.status === 'fail'
              ? '\x1b[31m[FAIL]\x1b[0m'
              : '\x1b[33m[SKIP]\x1b[0m';
        const latency = r.latencyMs !== undefined ? `${(r.latencyMs / 1000).toFixed(2)}s` : '-';
        console.log(
          `  ${r.model.padEnd(nameWidth)} ${status} ${latency.padEnd(8)} ${r.detail ?? ''}`
        );
      }

      const counts = {
        ok: results.filter((r) => r.status === 'ok').length,
        fail: results.filter((r) => r.status === 'fail').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
      };
      console.log('');
      console.log(`${counts.ok} ok, ${counts.fail} failed, ${counts.skipped} skipped (no API key)`);
      console.log('');

      if (counts.fail > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

// Stats command - show per-model usage from the running gateway
program
  .command('stats')
  .description('Show per-model usage counters from the running gateway')
  .option('--gateway-port <port>', 'Gateway port (defaults to config)', parsePort)
  .action(async (options) => {
    try {
      // Always construct the manager so .env authentication is loaded even
      // when the caller supplies an explicit port.
      const configManager = new ConfigManager();
      const gatewayPort = options.gatewayPort ?? configManager.getConfig().gateway.port;
      const headers: Record<string, string> = {};
      const authToken = clientAuthToken();
      if (authToken) {
        headers['x-api-key'] = authToken;
      }
      const res = await fetch(`http://127.0.0.1:${gatewayPort}/usage`, { headers });
      if (!res.ok) {
        console.error(`Gateway returned ${res.status} - is CCMR_AUTH_TOKEN required?`);
        process.exit(1);
      }
      const usage = (await res.json()) as {
        since: string;
        totals: { requests: number; errors: number; input_tokens: number; output_tokens: number };
        models: Record<
          string,
          { requests: number; errors: number; input_tokens: number; output_tokens: number }
        >;
      };

      console.log('');
      console.log(`Usage since ${usage.since}:`);
      console.log('');
      const entries = Object.entries(usage.models);
      if (entries.length === 0) {
        console.log('  (no requests yet)');
      } else {
        const nameWidth = Math.max(24, ...entries.map(([name]) => name.length + 2));
        console.log(
          `  ${'Model'.padEnd(nameWidth)} ${'Requests'.padStart(9)} ${'Errors'.padStart(7)} ${'Input'.padStart(12)} ${'Output'.padStart(12)}`
        );
        for (const [name, m] of entries) {
          console.log(
            `  ${name.padEnd(nameWidth)} ${String(m.requests).padStart(9)} ${String(m.errors).padStart(7)} ${String(m.input_tokens).padStart(12)} ${String(m.output_tokens).padStart(12)}`
          );
        }
        console.log(
          `  ${'TOTAL'.padEnd(nameWidth)} ${String(usage.totals.requests).padStart(9)} ${String(usage.totals.errors).padStart(7)} ${String(usage.totals.input_tokens).padStart(12)} ${String(usage.totals.output_tokens).padStart(12)}`
        );
      }
      console.log('');
    } catch {
      const gatewayPort = options.gatewayPort ?? 'the configured port';
      console.error(`Could not reach the gateway on port ${gatewayPort}.`);
      console.error('Start it with: ccmr start');
      process.exit(1);
    }
  });

// Claude command - launches Claude Code connected to the gateway
// Supports all Claude Code native arguments
program
  .command('claude')
  .description('Launch Claude Code connected to the gateway (for third-party models)')
  .argument('[prompt]', 'Your prompt (optional)')
  .option('--gateway-port <port>', 'Gateway port (defaults to config)', parsePort)
  // Session options
  .option('-c, --continue', 'Continue the most recent conversation')
  .option('-r, --resume [value]', 'Resume a conversation by session ID, or open interactive picker')
  .option('--fork-session', 'When resuming, create a new session ID instead of reusing the original')
  // Permission options
  .option('--dangerously-skip-permissions', 'Bypass all permission checks (YOLO mode)')
  .option('--permission-mode <mode>', 'Permission mode: acceptEdits, bypassPermissions, default, dontAsk, plan')
  // Output options
  .option('-p, --print', 'Print response and exit (useful for pipes)')
  .option('--output-format <format>', 'Output format: text, json, stream-json')
  .option('--input-format <format>', 'Input format: text, stream-json')
  // Tool options
  .option('--allowedTools, --allowed-tools <tools...>', 'Comma or space-separated list of tool names to allow')
  .option('--disallowedTools, --disallowed-tools <tools...>', 'Comma or space-separated list of tool names to deny')
  // Other options
  .option('--model <model>', 'Model for the current session (overrides gateway routing)')
  .option('--system-prompt <prompt>', 'System prompt to use for the session')
  .option('--append-system-prompt <prompt>', 'Append a system prompt to the default')
  .option('--add-dir <directories...>', 'Additional directories to allow tool access to')
  .option('-d, --debug [filter]', 'Enable debug mode')
  .option('--verbose', 'Enable verbose mode')
  .option('--ide', 'Automatically connect to IDE on startup')
  .allowUnknownOption(true)  // Allow any other Claude Code options
  .action(async (prompt, options, command) => {
    const { spawn } = await import('node:child_process');
    const os = await import('node:os');

    const homeDir = os.homedir();
    const configManager = new ConfigManager();
    const gatewayPort = options.gatewayPort ?? configManager.getConfig().gateway.port;
    const defaultModel = options.model || configManager.getConfig().default_model;

    // Make sure a gateway is listening; auto-start a detached one if not.
    const gateway = await ensureGatewayRunning(gatewayPort, __filename);
    if (!gateway) {
      console.error(`Gateway is not reachable on port ${gatewayPort} and auto-start failed.`);
      console.error('Check ~/.ccmr/gateway.log or start it manually: ccmr start --port ' + gatewayPort);
      process.exit(1);
    }
    if (gateway.autoStarted) {
      console.error(
        `Gateway auto-started on port ${gatewayPort} (pid ${gateway.pid}, log: ${gateway.logFile})`
      );
      // It is detached: closing this window leaves it running on purpose.
      console.error(`It keeps running after this session ends. Stop it with: ccmr stop`);
    } else if (gateway.health.version && gateway.health.version !== VERSION) {
      console.error(
        `\x1b[33m[WARNING]\x1b[0m Gateway is v${gateway.health.version} but this CLI is v${VERSION}.` +
          ' Restart the gateway to pick up the new version.'
      );
    }

    const sourceCheck = checkGatewaySource(gateway.health, configManager.getSourceId());
    if (!sourceCheck.ok) {
      const source = gateway.health.config_file ?? 'unknown (gateway is too old to report it)';
      console.error('');
      console.error(
        `\x1b[31m[ERROR]\x1b[0m The gateway on port ${gatewayPort} belongs to a different config source.`
      );
      console.error(`  Current config: ${configManager.getConfigFilePath() ?? 'built-in defaults'}`);
      console.error(`  Gateway config: ${source}`);
      console.error('');
      console.error('  Keep the existing gateway and choose another port:');
      console.error(`    ccmr claude --gateway-port ${Number(gatewayPort) + 1}`);
      console.error('  Or stop it first if no other session is using it:');
      console.error(`    ccmr stop --port ${gatewayPort}`);
      console.error('');
      process.exit(1);
    }

    // The gateway may be reachable yet unable to serve this model (e.g. it
    // started before any config existed). Fail here, with the gateway's own
    // config source, instead of letting Claude Code surface a bare 401.
    const launchModelKey = configManager.resolveModelName(defaultModel);
    const readiness = checkGatewayModel(gateway.health, launchModelKey);
    if (!readiness.ok) {
      const source = gateway.health.config_file ?? 'built-in defaults (no config file)';
      console.error('');
      console.error(
        `\x1b[31m[ERROR]\x1b[0m The gateway on port ${gatewayPort} cannot serve '${launchModelKey}'.`
      );
      console.error(
        readiness.reason === 'unknown_model'
          ? `  It does not know that model at all.`
          : `  It has no API key for that model.`
      );
      console.error(`  Gateway config source: ${source}`);
      if (gateway.health.ccmr_home) {
        console.error(`  Gateway CCMR_HOME:     ${gateway.health.ccmr_home}`);
      }
      console.error('');
      console.error('  This usually means an old gateway is still running. Fix it with:');
      console.error(`    ccmr stop --port ${gatewayPort}`);
      console.error(`    ccmr init --global    # if you have no ~/.ccmr/models.yaml yet`);
      console.error(`    ccmr doctor ${launchModelKey}`);
      console.error('');
      process.exit(1);
    }

    // Auto-size Claude Code's auto-compaction window to the launch model's context
    // window, unless the user already set it. Behind a custom base URL Claude Code
    // otherwise assumes ~200k, clipping larger windows (e.g. Seed/Kimi 256K, DeepSeek 1M).
    const launchModel = configManager.getModel(defaultModel);
    const autoCompactWindow =
      process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW === undefined && launchModel?.context_window
        ? { CLAUDE_CODE_AUTO_COMPACT_WINDOW: String(launchModel.context_window) }
        : {};

    // Set up environment for gateway
    const env = {
      ...process.env,
      ...autoCompactWindow,
      CLAUDE_CONFIG_DIR: path.join(homeDir, '.claude-gateway'),
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${gatewayPort}`,
      ANTHROPIC_AUTH_TOKEN: clientAuthToken() || 'ccmr-local-gateway',
      ANTHROPIC_MODEL: defaultModel,
      ANTHROPIC_DEFAULT_SONNET_MODEL: defaultModel,
      ANTHROPIC_DEFAULT_OPUS_MODEL: defaultModel,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: defaultModel,
    };

    // Build Claude Code arguments
    const claudeArgs: string[] = [];

    // Add prompt if provided
    if (prompt) {
      claudeArgs.push(prompt);
    }

    // Session options
    if (options.continue) claudeArgs.push('--continue');
    if (options.resume !== undefined) {
      if (options.resume === true) {
        claudeArgs.push('--resume');
      } else {
        claudeArgs.push('--resume', options.resume);
      }
    }
    if (options.forkSession) claudeArgs.push('--fork-session');

    // Permission options
    if (options.dangerouslySkipPermissions) claudeArgs.push('--dangerously-skip-permissions');
    if (options.permissionMode) claudeArgs.push('--permission-mode', options.permissionMode);

    // Output options
    if (options.print) claudeArgs.push('--print');
    if (options.outputFormat) claudeArgs.push('--output-format', options.outputFormat);
    if (options.inputFormat) claudeArgs.push('--input-format', options.inputFormat);

    // Tool options
    if (options.allowedTools) claudeArgs.push('--allowed-tools', ...options.allowedTools);
    if (options.disallowedTools) claudeArgs.push('--disallowed-tools', ...options.disallowedTools);

    // Other options
    if (options.model) claudeArgs.push('--model', options.model);
    if (options.systemPrompt) claudeArgs.push('--system-prompt', options.systemPrompt);
    if (options.appendSystemPrompt) claudeArgs.push('--append-system-prompt', options.appendSystemPrompt);
    if (options.addDir) claudeArgs.push('--add-dir', ...options.addDir);
    if (options.debug !== undefined) {
      if (options.debug === true) {
        claudeArgs.push('--debug');
      } else {
        claudeArgs.push('--debug', options.debug);
      }
    }
    if (options.verbose) claudeArgs.push('--verbose');
    if (options.ide) claudeArgs.push('--ide');

    // Pass through any unknown options (collected by allowUnknownOption)
    const unknownArgs = command.args.slice(prompt ? 1 : 0);
    claudeArgs.push(...unknownArgs);

    // Show startup info (unless in print mode)
    if (!options.print) {
      console.log('');
      console.log('========================================');
      console.log('Starting Claude Code (Third-party Models)');
      console.log('Configuration: ' + env.CLAUDE_CONFIG_DIR);
      console.log('Gateway: ' + env.ANTHROPIC_BASE_URL);
      console.log('Model: ' + defaultModel);
      if (env.CLAUDE_CODE_AUTO_COMPACT_WINDOW) {
        console.log('Auto-compact window: ' + env.CLAUDE_CODE_AUTO_COMPACT_WINDOW + ' tokens');
      }
      if (claudeArgs.length > 0) {
        console.log('Arguments: ' + claudeArgs.join(' '));
      }
      console.log('========================================');
      console.log('');
    }

    const child = spawn('claude', claudeArgs, {
      stdio: 'inherit',
      env,
      shell: process.platform === 'win32',
    });

    child.on('error', (error) => {
      console.error('Failed to start Claude Code:', error.message);
      console.error('');
      console.error('Make sure Claude Code is installed:');
      console.error('  npm install -g @anthropic-ai/claude-code');
      process.exit(1);
    });

    child.on('exit', (code) => {
      process.exit(code ?? 0);
    });
  });

// Parse arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  console.log('');
  console.log('Claude Code Model Router v' + VERSION);
  console.log('');
  console.log('Quick Start:');
  console.log('  1. npx claude-code-model-router init     # Create config files');
  console.log('  2. Edit .env with your API keys');
  console.log('  3. npx claude-code-model-router start    # Start gateway');
  console.log('');
  console.log('Commands:');
  console.log('  init      Create configuration files (--global for ~/.ccmr)');
  console.log('  start     Start the gateway server (foreground)');
  console.log('  status    List running gateways (port, pid, config source)');
  console.log('  stop      Stop a running gateway');
  console.log('  models    List available models');
  console.log('  use       Set the default model');
  console.log('  doctor    Check model connectivity (real 1-token requests)');
  console.log('  stats     Show per-model usage from the running gateway');
  console.log('  claude    Launch Claude Code with gateway (auto-starts it)');
  console.log('');
  console.log('Use --help for more information.');
  console.log('');
}
