// fork.js — sealed one-way fork from a snapshot (Part C4).
//
// makeFork(token, config, opts) creates an isolated simulation branch:
//   - cloned from the snapshot token (not from a live twin)
//   - one-way: the fork never mutates the original token or any live twin
//   - can diverge via a different seed or config edit
//
// Usage:
//   const token = snapshot(twin._state());
//   const fork  = makeFork(token, cfg, { seed: 99 });
//   fork.tick();  // diverges from the twin's future

import { restore } from './snapshot.js';
import { step } from '../engine.js';
import { makeRng } from '../../util/rng.js';

/**
 * Create a one-way fork from a snapshot token.
 * @param {object} token   from snapshot()
 * @param {object} config  FactoryConfig
 * @param {object} [opts]  { seed?: number } — overrides the snapshotted rng seed
 * @returns {object} fork handle
 */
export function makeFork(token, config, opts = {}) {
  // restore() deep-clones the token — the fork owns independent copies of all state.
  let state = restore(token, config);

  // Optionally override the rng seed so the fork can diverge via different randomness.
  if (opts.seed !== undefined) {
    state.rng = makeRng(opts.seed);
  }

  let done = false;

  return {
    /**
     * Advance one simulation tick.
     * @returns {object[]} events emitted during this tick
     */
    tick() {
      if (done) return [];
      const result = step(state);
      state = result.state;
      if (result.done) done = true;
      return result.events;
    },

    /** @returns {boolean} */
    isDone() { return done; },

    /** @returns {number} current simulation time */
    now() { return state.clock.now(); },

    /** Expose state for testing (read-only intent). */
    _state() { return state; },
  };
}
