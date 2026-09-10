/**
 * The "[1m]" model-name suffix.
 *
 * Claude Code opens its 1M context window only when the model name it was
 * given carries this suffix, and it strips the suffix before calling the API.
 * The suffix is therefore a client-side marker: it never belongs in an
 * upstream model id (Kimi answers `k3[1m]` with 401 "model id does not
 * exist"), and the gateway must be able to take it back off again.
 */

/** Context windows at or above this are advertised to Claude Code as 1M. */
const ONE_M_THRESHOLD = 1_000_000;

const ONE_M_SUFFIX = '[1m]';

/** Remove a trailing "[1m]" so the name can be resolved as a model or alias. */
export function stripContextSuffix(name: string): string {
  return name.endsWith(ONE_M_SUFFIX) ? name.slice(0, -ONE_M_SUFFIX.length) : name;
}

/**
 * Add "[1m]" when the model's context window is at least 1M, so Claude Code
 * uses the full window instead of assuming ~200k. Already-suffixed and
 * smaller-window names are returned unchanged.
 */
export function withContextSuffix(name: string, contextWindow?: number): string {
  if (name.endsWith(ONE_M_SUFFIX)) {
    return name;
  }
  return (contextWindow ?? 0) >= ONE_M_THRESHOLD ? `${name}${ONE_M_SUFFIX}` : name;
}
