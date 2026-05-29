// Deterministic id generation for the twin engine.
//
// Ids must be stable across runs so the event log is reproducible (the §6
// worked-example test compares logs byte-for-byte). We therefore back ids with
// a module-level counter that tests can reset via resetIds().

let counter = 0;

/**
 * Reset the id counter. Call at the start of a deterministic run/test.
 * @param {number} [seed=0] starting value for the counter
 */
export function resetIds(seed = 0) {
  counter = seed;
}

/**
 * Produce a stable, sequential id with the given prefix, e.g. "unit-7".
 * @param {string} prefix
 * @returns {string}
 */
export function newId(prefix) {
  counter += 1;
  return `${prefix}-${counter}`;
}
