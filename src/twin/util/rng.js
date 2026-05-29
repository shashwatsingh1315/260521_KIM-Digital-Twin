// Deterministic PRNG (mulberry32) for reproducible simulation.
// Only inspect pass/fail consumes this in the current engine.

/**
 * Create a seeded PRNG. Returns a function () => number in [0, 1).
 * @param {number} seed  32-bit unsigned integer
 */
export function makeRng(seed) {
  let s = seed >>> 0;
  return function next() {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
