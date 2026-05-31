// Invariant helper for config validation and factory-function guards.

/**
 * Throw an Error with `msg` when `cond` is falsy. Used by domain/network
 * factories to reject malformed input, and by the validator for precise,
 * actionable error messages.
 * @param {*} cond
 * @param {string} msg
 */
export function invariant(cond, msg) {
  if (!cond) {
    throw new Error(`[twin] ${msg}`);
  }
}
