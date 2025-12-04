#!/usr/bin/env node

/**
 * CLI for Claude Code Model Router
 */

import { program } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { ConfigManager, generateConfigFile, generateEnvFile } from './config.js';
import { startServer } from './server.js';

const VERSION = '1.0.0';

program
  .name('ccmr')
  .description('Claude Code Model Router - A lightweight API gateway for multi-model switching')
  .version(VERSION);

// Start command
program
  .command('start')
  .description('Start the model router gateway')
  .option('-p, --port <port>', 'Port to listen on', '8080')
  .option('-c, --config <path>', 'Path to config file')
  .option('--host <host>', 'Host to bind to', '0.0.0.0')
  .action((options) => {
    // Set port from option
    if (options.port) {
      process.env.GATEWAY_PORT = options.port;
    }

    try {
      const configManager = new ConfigManager(options.config);

      // Override port if specified
      if (options.port) {
        configManager.getConfig().gateway.port = parseInt(options.port, 10);
      }
      if (options.host) {
        configManager.getConfig().gateway.host = options.host;
      }

      startServer(configManager);
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  });

// Init command
program
  .command('init')
  .description('Initialize configuration files in current directory')
  .option('-f, --force', 'Overwrite existing files')
  .action((options) => {
    const configPath = path.join(process.cwd(), 'models.yaml');
    const envPath = path.join(process.cwd(), '.env');

    console.log('');
    console.log('Initializing Claude Code Model Router...');
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

    console.log('');
    console.log('Next steps:');
    console.log('  1. Edit .env and add your API keys');
    console.log('  2. Run: npx claude-code-model-router start');
    console.log('  3. In a new terminal, set environment and start Claude Code:');
    console.log('');
    console.log('     # Linux/macOS:');
    console.log('     export ANTHROPIC_BASE_URL=http://localhost:8080');
    console.log('     claude');
    console.log('');
    console.log('     # Windows (CMD):');
    console.log('     set ANTHROPIC_BASE_URL=http://localhost:8080');
    console.log('     claude');
    console.log('');
    console.log('     # Windows (PowerShell):');
    console.log('     $env:ANTHROPIC_BASE_URL="http://localhost:8080"');
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

      for (const [name, info] of Object.entries(models)) {
        const status = info.available
          ? '\x1b[32m[Ready]\x1b[0m'
          : '\x1b[33m[No API Key]\x1b[0m';
        console.log(`  ${name.padEnd(12)} ${info.displayName.padEnd(20)} ${status}`);
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

// Claude command - launches Claude Code with the right environment
program
  .command('claude')
  .description('Launch Claude Code connected to the local gateway')
  .option('-p, --port <port>', 'Gateway port', '8080')
  .action(async (options) => {
    const { spawn } = await import('node:child_process');

    const env = {
      ...process.env,
      ANTHROPIC_BASE_URL: `http://localhost:${options.port}`,
    };

    console.log('');
    console.log('Launching Claude Code with ANTHROPIC_BASE_URL=http://localhost:' + options.port);
    console.log('');

    const child = spawn('claude', [], {
      stdio: 'inherit',
      env,
      shell: true,
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
  console.log('  init      Create configuration files');
  console.log('  start     Start the gateway server');
  console.log('  models    List available models');
  console.log('  claude    Launch Claude Code with gateway');
  console.log('');
  console.log('Use --help for more information.');
  console.log('');
}
