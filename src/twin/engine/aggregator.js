// aggregator.js — order completion counting at exits (§7.4, §8.1.7).
//
// Consumes exitedUnits from flowState, updates order counters,
// marks orders completed or short.

import { ORDER_STATUS } from '../domain/order.js';

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
