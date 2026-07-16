"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isInfoLoggingEnabled = isInfoLoggingEnabled;
const INFO_LEVELS = new Set(['DEBUG', 'INFO']);
/** Whether routine request/completion logs should be emitted. */
function isInfoLoggingEnabled(config) {
    return config.enable_logging && INFO_LEVELS.has(config.log_level.toUpperCase());
}
//# sourceMappingURL=logging.js.map