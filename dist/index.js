"use strict";
/**
 * Claude Code Model Router
 *
 * A lightweight API gateway for routing Claude Code requests to multiple AI models.
 *
 * @packageDocumentation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = exports.createServer = exports.RouterError = exports.ModelRouter = exports.generateEnvFile = exports.generateConfigFile = exports.ConfigManager = void 0;
var config_js_1 = require("./config.js");
Object.defineProperty(exports, "ConfigManager", { enumerable: true, get: function () { return config_js_1.ConfigManager; } });
Object.defineProperty(exports, "generateConfigFile", { enumerable: true, get: function () { return config_js_1.generateConfigFile; } });
Object.defineProperty(exports, "generateEnvFile", { enumerable: true, get: function () { return config_js_1.generateEnvFile; } });
var router_js_1 = require("./router.js");
Object.defineProperty(exports, "ModelRouter", { enumerable: true, get: function () { return router_js_1.ModelRouter; } });
Object.defineProperty(exports, "RouterError", { enumerable: true, get: function () { return router_js_1.RouterError; } });
var server_js_1 = require("./server.js");
Object.defineProperty(exports, "createServer", { enumerable: true, get: function () { return server_js_1.createServer; } });
Object.defineProperty(exports, "startServer", { enumerable: true, get: function () { return server_js_1.startServer; } });
//# sourceMappingURL=index.js.map