#!/usr/bin/env node
"use strict";
/**
 * CLI for Claude Code Model Router
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const config_js_1 = require("./config.js");
const server_js_1 = require("./server.js");
const VERSION = '1.0.0';
commander_1.program
    .name('ccmr')
    .description('Claude Code Model Router - A lightweight API gateway for multi-model switching')
    .version(VERSION);
// Start command
commander_1.program
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
        const configManager = new config_js_1.ConfigManager(options.config);
        // Override port if specified
        if (options.port) {
            configManager.getConfig().gateway.port = parseInt(options.port, 10);
        }
        if (options.host) {
            configManager.getConfig().gateway.host = options.host;
        }
        (0, server_js_1.startServer)(configManager);
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
});
// Init command
commander_1.program
    .command('init')
    .description('Initialize configuration files in current directory')
    .option('-f, --force', 'Overwrite existing files')
    .action((options) => {
    const configPath = node_path_1.default.join(process.cwd(), 'models.yaml');
    const envPath = node_path_1.default.join(process.cwd(), '.env');
    console.log('');
    console.log('Initializing Claude Code Model Router...');
    console.log('');
    // Create config file
    if (node_fs_1.default.existsSync(configPath) && !options.force) {
        console.log(`[SKIP] ${configPath} already exists (use --force to overwrite)`);
    }
    else {
        node_fs_1.default.writeFileSync(configPath, (0, config_js_1.generateConfigFile)());
        console.log(`[CREATE] ${configPath}`);
    }
    // Create .env file
    if (node_fs_1.default.existsSync(envPath) && !options.force) {
        console.log(`[SKIP] ${envPath} already exists (use --force to overwrite)`);
    }
    else {
        node_fs_1.default.writeFileSync(envPath, (0, config_js_1.generateEnvFile)());
        console.log(`[CREATE] ${envPath}`);
    }
    console.log('');
    console.log('Next steps:');
    console.log('  1. Edit .env and add your API keys');
    console.log('  2. Run: npx claude-code-model-router start');
    console.log('  3. In a new terminal, start Claude Code:');
    console.log('');
    console.log('     # For third-party models (gateway mode):');
    console.log('     npx claude-code-model-router claude');
    console.log('');
    console.log('     # For official subscription (default mode):');
    console.log('     claude');
    console.log('');
});
// Models command
commander_1.program
    .command('models')
    .description('List available models')
    .option('-c, --config <path>', 'Path to config file')
    .action((options) => {
    try {
        const configManager = new config_js_1.ConfigManager(options.config);
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
    }
    catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
});
// Claude command - launches Claude Code connected to the gateway
commander_1.program
    .command('claude')
    .description('Launch Claude Code connected to the gateway (for third-party models)')
    .option('-p, --port <port>', 'Gateway port', '8080')
    .action(async (options) => {
    const { spawn } = await import('node:child_process');
    const os = await import('node:os');
    const homeDir = os.homedir();
    // Set up environment for gateway
    const env = {
        ...process.env,
        CLAUDE_CONFIG_DIR: node_path_1.default.join(homeDir, '.claude-gateway'),
        ANTHROPIC_BASE_URL: `http://localhost:${options.port}`,
    };
    console.log('');
    console.log('========================================');
    console.log('Starting Claude Code (Third-party Models)');
    console.log('Configuration: ' + env.CLAUDE_CONFIG_DIR);
    console.log('Gateway: ' + env.ANTHROPIC_BASE_URL);
    console.log('========================================');
    console.log('');
    console.log('NOTE: Make sure the gateway is running first!');
    console.log('Run: npx claude-code-model-router start');
    console.log('');
    console.log('TIP: For official Claude subscription, just use: claude');
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
commander_1.program.parse();
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
//# sourceMappingURL=cli.js.map