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
// Supports all Claude Code native arguments
commander_1.program
    .command('claude')
    .description('Launch Claude Code connected to the gateway (for third-party models)')
    .argument('[prompt]', 'Your prompt (optional)')
    .option('--gateway-port <port>', 'Gateway port (default: 8080)', '8080')
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
    .allowUnknownOption(true) // Allow any other Claude Code options
    .action(async (prompt, options, command) => {
    const { spawn } = await import('node:child_process');
    const os = await import('node:os');
    const homeDir = os.homedir();
    const gatewayPort = options.gatewayPort || '8080';
    // Set up environment for gateway
    const env = {
        ...process.env,
        CLAUDE_CONFIG_DIR: node_path_1.default.join(homeDir, '.claude-gateway'),
        ANTHROPIC_BASE_URL: `http://localhost:${gatewayPort}`,
    };
    // Build Claude Code arguments
    const claudeArgs = [];
    // Add prompt if provided
    if (prompt) {
        claudeArgs.push(prompt);
    }
    // Session options
    if (options.continue)
        claudeArgs.push('--continue');
    if (options.resume !== undefined) {
        if (options.resume === true) {
            claudeArgs.push('--resume');
        }
        else {
            claudeArgs.push('--resume', options.resume);
        }
    }
    if (options.forkSession)
        claudeArgs.push('--fork-session');
    // Permission options
    if (options.dangerouslySkipPermissions)
        claudeArgs.push('--dangerously-skip-permissions');
    if (options.permissionMode)
        claudeArgs.push('--permission-mode', options.permissionMode);
    // Output options
    if (options.print)
        claudeArgs.push('--print');
    if (options.outputFormat)
        claudeArgs.push('--output-format', options.outputFormat);
    if (options.inputFormat)
        claudeArgs.push('--input-format', options.inputFormat);
    // Tool options
    if (options.allowedTools)
        claudeArgs.push('--allowed-tools', ...options.allowedTools);
    if (options.disallowedTools)
        claudeArgs.push('--disallowed-tools', ...options.disallowedTools);
    // Other options
    if (options.model)
        claudeArgs.push('--model', options.model);
    if (options.systemPrompt)
        claudeArgs.push('--system-prompt', options.systemPrompt);
    if (options.appendSystemPrompt)
        claudeArgs.push('--append-system-prompt', options.appendSystemPrompt);
    if (options.addDir)
        claudeArgs.push('--add-dir', ...options.addDir);
    if (options.debug !== undefined) {
        if (options.debug === true) {
            claudeArgs.push('--debug');
        }
        else {
            claudeArgs.push('--debug', options.debug);
        }
    }
    if (options.verbose)
        claudeArgs.push('--verbose');
    if (options.ide)
        claudeArgs.push('--ide');
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
        if (claudeArgs.length > 0) {
            console.log('Arguments: ' + claudeArgs.join(' '));
        }
        console.log('========================================');
        console.log('');
    }
    const child = spawn('claude', claudeArgs, {
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