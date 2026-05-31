// Order — top-level request (§4.2).
//
// Orders arrive and are queued for the release governor. Unlike the static
// config types, an Order carries RUNTIME counters (status / units_created /
// units_completed / scrap) that the engine mutates — specifically the
// aggregator (§8.1.7). It is therefore NOT frozen.

import { invariant } from '../util/assert.js';

export const ORDER_STATUS = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  SHORT: 'short', // finished but good units < quantity due to scrap
});

/**
 * @param {object} args
 * @param {string} args.id
 * @param {string} args.material_type        material id
 * @param {number} args.quantity             units to produce (N)
 * @param {string[]} args.process_sequence   ordered process ids
 * @param {number} [args.arrival_time=0]     seconds; when it becomes available
 */
export function makeOrder({ id, material_type, quantity, process_sequence, arrival_time = 0 }) {
  invariant(typeof id === 'string' && id.length > 0, 'order.id is required');
  invariant(typeof material_type === 'string', `order.material_type is required (${id})`);
  invariant(Number.isInteger(quantity) && quantity > 0, `order.quantity must be a positive integer (${id})`);
  invariant(
    Array.isArray(process_sequence) && process_sequence.length > 0,
    `order.process_sequence must be non-empty (${id})`,
  );
  return {
    kind_of: 'order',
    id,
    material_type,
    quantity,
    process_sequence: [...process_sequence],
    arrival_time,
    // runtime counters (mutated by the aggregator only)
    status: ORDER_STATUS.PENDING,
    units_created: 0,
    units_completed: 0,
    scrap: 0,
  };
}
