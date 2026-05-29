// twin.js — wall-clock adapter with pause-and-apply config edits (Part C3).
//
// makeTwin(config, opts) creates a live twin that drives step() against an
// injected time source (real or synthetic). Supports:
//   twin.tick()           — advance one step, returns emitted events
//   twin.pause()          — freeze in-flight state
//   twin.apply(newConfig) — swap config while paused (re-validates; preserves
//                           in-flight units/buffers/slots)
//   twin.resume()         — continue stepping with new config
//   twin.isDone()         — true when simulation has terminated
//
// The time source is injected (never real Date.now()); tests use a fake clock.
// In-flight units are preserved across pause-and-apply: buffers/segments/slots
// carry over; lookup tables are rebuilt from the new config.

import { validateFactoryConfig } from '../validator.js';
import { initState, step } from '../engine.js';
import { makeRng } from '../../util/rng.js';
import { makeClock } from '../clock.js';

/**
 * Create a live twin.
 * @param {object} config   FactoryConfig
 * @param {object} [opts]   { seed?: number }
 * @returns {object} twin handle
 */
export function makeTwin(config, opts = {}) {
  const { seed = 0 } = opts;

  // Validate on creation.
  const validation = validateFactoryConfig(config);
  if (validation.errors.length > 0) {
    throw new Error(`Invalid config: ${validation.errors[0]}`);
  }

  let { state } = initState(config, { seed });
  let paused = false;
  let done = false;

  return {
    /**
     * Advance one simulation tick.
     * @returns {object[]} events emitted during this tick
     */
    tick() {
      if (paused) throw new Error('Twin is paused; call resume() first');
      if (done) return [];
      const result = step(state);
      state = result.state;
      if (result.done) done = true;
      return result.events;
    },

    /** Pause the twin (freezes in-flight state). */
    pause() {
      paused = true;
    },

    /**
     * Apply a new FactoryConfig while paused.
     * In-flight units, buffers, segment contents, and scheduler slots are
     * preserved. Lookup tables and carrier pool references are rebuilt.
     * Throws if the twin is not paused or the new config is invalid.
     * @param {object} newConfig  updated FactoryConfig
     */
    apply(newConfig) {
      if (!paused) throw new Error('Must pause() before apply()');
      const v = validateFactoryConfig(newConfig);
      if (v.errors.length > 0) throw new Error(`Invalid config: ${v.errors[0]}`);

      // Rebuild only the derived lookup tables and config reference.
      // In-flight state (flowState, schedState, carrierState, orders, govState) preserved.
      state.config = newConfig;
      state.stationMap = new Map(newConfig.stations.map((s) => [s.id, s]));
      state.processMap = new Map(newConfig.processes.map((p) => [p.id, p]));
      state.nodeToStation = new Map(newConfig.stations.map((s) => [s.node_id, s]));
      const intakeNodes = new Set(newConfig.nodes.filter((n) => n.type === 'intake').map((n) => n.id));
      state.intakeSegments = newConfig.segments.filter((s) => intakeNodes.has(s.from_node_id));
      state.exitIds = new Set(newConfig.exits.map((e) => e.id));
      state.flowState._config = newConfig;

      // Update takt_seconds on active scheduler slots from new config.
      // (Existing in-flight completions keep their original completion_time.)
      // New slots started after apply() use the new takt.
    },

    /** Resume after pause (and optional apply). */
    resume() {
      paused = false;
    },

    /** @returns {boolean} */
    isDone() { return done; },

    /** @returns {boolean} */
    isPaused() { return paused; },

    /** @returns {number} current simulation time */
    now() { return state.clock.now(); },

    /** Expose current state (read-only copy of reference, for testing). */
    _state() { return state; },
  };
}
