/**
 * The "[1m]" model-name suffix.
 *
 * Claude Code opens its 1M context window only when the model name it was
 * given carries this suffix, and it strips the suffix before calling the API.
 * The suffix is therefore a client-side marker: it never belongs in an
 * upstream model id (Kimi answers `k3[1m]` with 401 "model id does not
 * exist"), and the gateway must be able to take it back off again.
 */
/** Remove a trailing "[1m]" so the name can be resolved as a model or alias. */
export declare function stripContextSuffix(name: string): string;
/**
 * Add "[1m]" when the model's context window is at least 1M, so Claude Code
 * uses the full window instead of assuming ~200k. Already-suffixed and
 * smaller-window names are returned unchanged.
 */
export declare function withContextSuffix(name: string, contextWindow?: number): string;
//# sourceMappingURL=model-suffix.d.ts.map