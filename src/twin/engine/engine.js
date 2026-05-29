// Engine core — deterministic event-driven simulation (§5, §8).
//
// Pure function: config + initial state → event stream to completion.
// Handles time-stepping, unit flow, station scheduling, and event emission.

import { makeClock } from './clock.js';
import { sortEvents, unitCreated, stationStarted, stationCompleted, unitExited } from './events.js';

/**
 * Run a complete simulation from config to completion.
 * Returns {states, events, summary}.
 *
 * @param {FactoryConfig} config
 * @param {object} [options]
 * @param {number} [options.seed=0]
 * @param {number} [options.maxTime=Infinity]
 */
export function runTwin(config, options = {}) {
  const { seed = 0, maxTime = Infinity } = options;

  const clock = makeClock(0);
  const states = [];
  const events = [];

  // Initialize state
  const state = {
    time: 0,
    units: [],
    orders: config.orders.map((o) => ({
      ...o,
      units_created: 0,
      units_completed: 0,
      scrap: 0,
      status: o.status,
    })),
    station_work: new Map(), // station_id -> {process_id, unit_id, completion_time}
    buffers: new Map(), // node_id -> [unit_id, ...]
    next_station_completions: new Map(), // station_id -> time
  };

  // Initialize buffers
  for (const node of config.nodes) {
    state.buffers.set(node.id, []);
  }

  states.push(JSON.parse(JSON.stringify(state)));

  // Main event loop: advance time until all orders complete or timeout
  while (
    state.orders.some((o) => o.status === 'pending' || o.status === 'in_progress') &&
    state.time < maxTime
  ) {
    // Find next event time
    let nextTime = Infinity;

    // Check station completions
    for (const [_, time] of state.station_work) {
      if (time < nextTime) nextTime = time;
    }

    // Check carrier arrivals (not yet implemented)

    if (nextTime === Infinity) {
      // No more scheduled events
      break;
    }

    clock.setTime(nextTime);
    state.time = nextTime;

    // Process all completions at this time
    const justCompleted = [];
    for (const [stationId, work] of state.station_work.entries()) {
      if (work && work.completion_time === nextTime) {
        justCompleted.push({ station_id: stationId, work });
        state.station_work.delete(stationId);
      }
    }

    // Emit completion events
    for (const { station_id, work } of justCompleted) {
      events.push(
        stationCompleted(
          state.time,
          station_id,
          work.process_id,
          work.unit_id,
        ),
      );
    }

    // Capture state
    states.push(JSON.parse(JSON.stringify(state)));
  }

  // Finalize: mark completed orders
  for (const order of state.orders) {
    if (order.units_completed >= order.quantity) {
      order.status = 'completed';
    }
  }

  const sortedEvents = sortEvents(events);

  return Object.freeze({
    states,
    events: sortedEvents,
    summary: {
      final_time: state.time,
      orders_completed: state.orders.filter((o) => o.status === 'completed').length,
      total_orders: state.orders.length,
    },
  });
}
