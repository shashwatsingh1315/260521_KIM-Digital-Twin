// aggregator.js — order completion counting + live readouts (§7.4, §8.1.7).
//
// procesExits: consumes exitedUnits, updates order counters.
// computeSummary: final metrics for a completed run.
// liveMetrics: per-step snapshot of peopleRequired, amrFleet, carrier utilization,
//              buffer fullness — all values sourced from derive.js.

import { ORDER_STATUS } from '../domain/order.js';
import { peopleRequired, amrFleet, poolThroughput, roundTripTime } from './derive.js';

/**
 * Process all pending exits, updating order status.
 * Clears flowState.exitedUnits as a side-effect.
 * Returns events array of {type, unitId, exitId, time}.
 */
export function procesExits(flowState, orders, govState) {
  const events = [];
  const exited = [...flowState.exitedUnits];
  flowState.exitedUnits = [];

  const orderMap = new Map(orders.map((o) => [o.id, o]));

  for (const { unit, exit_id, time } of exited) {
    const order = orderMap.get(unit.order_id);

    if (exit_id === 'scrap' || isScrapExit(exit_id, flowState._config)) {
      if (order) order.scrap++;
      govState.wipCount = Math.max(0, govState.wipCount - 1);
      events.push({ type: 'scrapped', unit_id: unit.id, exit_id, timestamp: time });
    } else {
      if (order) order.units_completed++;
      govState.wipCount = Math.max(0, govState.wipCount - 1);
      events.push({ type: 'unit_exited', unit_id: unit.id, exit_id, timestamp: time });
    }
  }

  // Update order statuses.
  for (const order of orders) {
    if (order.status === 'completed' || order.status === 'short') continue;
    if (order.units_completed >= order.quantity) {
      order.status = ORDER_STATUS.COMPLETED;
    } else if (order.units_created >= order.quantity &&
               order.units_completed + order.scrap >= order.units_created) {
      order.status = ORDER_STATUS.SHORT;
    }
  }

  return events;
}

function isScrapExit(exitId, config) {
  if (!config) return exitId === 'scrap';
  const exit = config.exits.find((e) => e.id === exitId);
  return exit && exit.kind === 'scrap';
}

/**
 * Compute summary metrics from final state.
 */
export function computeSummary(config, orders, finalTime) {
  return {
    final_time: finalTime,
    orders_completed: orders.filter((o) => o.status === ORDER_STATUS.COMPLETED).length,
    orders_short: orders.filter((o) => o.status === ORDER_STATUS.SHORT).length,
    total_orders: orders.length,
    units_shipped: orders.reduce((s, o) => s + o.units_completed, 0),
    units_scrapped: orders.reduce((s, o) => s + o.scrap, 0),
  };
}

/**
 * Per-step live metrics snapshot (§7.4, §8.1.7).
 * All values sourced from derive.js; nothing recomputed inline.
 *
 * @param {object} config           FactoryConfig
 * @param {object} flowState        flow runtime state
 * @param {object} carrierState     carrier runtime state
 * @param {string} [shiftId]        shift to compute peopleRequired for
 * @returns {{ peopleRequired, amrFleet, carrierUtilization, bufferFullness }}
 */
export function liveMetrics(config, flowState, carrierState, shiftId) {
  const shift = shiftId || config.shifts?.[0]?.id;
  return {
    peopleRequired: peopleRequired(config, shift),
    amrFleet: amrFleet(config),
    carrierUtilization: computeCarrierUtilization(config, carrierState),
    bufferFullness: computeBufferFullness(config, flowState),
  };
}

function computeCarrierUtilization(config, carrierState) {
  const result = {};
  for (const [, entry] of carrierState.pools.entries()) {
    const { pool, seg, carriers } = entry;
    const rtt = roundTripTime(
      seg.length_m,
      pool.load_unload_seconds,
      pool.speed_loaded_m_per_min,
      pool.speed_empty_m_per_min,
    );
    const maxThroughput = poolThroughput(pool.count, pool.units_per_trip, rtt);
    // Instantaneous utilization: fraction of carriers busy (loaded, returning, or held).
    const busy = carriers.filter((c) => c.state !== 'idle').length;
    const utilization = pool.count > 0 ? busy / pool.count : 0;
    result[seg.id] = { utilization, maxThroughput };
  }
  return result;
}

function computeBufferFullness(config, flowState) {
  const result = {};
  for (const station of config.stations) {
    const buf = flowState.stationBuffers.get(station.id);
    const count = buf?.length ?? 0;
    result[station.id] = station.entry_buffer_capacity > 0
      ? count / station.entry_buffer_capacity
      : 0;
  }
  return result;
}
