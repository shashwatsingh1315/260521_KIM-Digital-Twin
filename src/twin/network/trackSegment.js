// TrackSegment — connection between nodes (§7.2).
//
// A segment carries units passively (conveyor belt) or via a dedicated carrier pool.
// Transport is a discriminated union: passive {class, mode, speed} | carrier {class, pool_id}.
// Capacity limits the buffer at the segment's destination.

import { invariant } from '../util/assert.js';

export const TRANSPORT_MODE = Object.freeze({
  CONVEYOR: 'conveyor',
  GRAVITY: 'gravity',
  MANUAL: 'manual',
});

/**
 * @param {object} args
 * @param {string} args.id
 * @param {string} args.from_node_id
 * @param {string} args.to_node_id
 * @param {number} args.length_m             segment length in meters
 * @param {number} [args.capacity=10]        buffer capacity (units)
 * @param {object} args.transport            discriminated union
 * @param {string} args.transport.class      'passive' | 'carrier'
 * @param {string} [args.transport.mode]     TRANSPORT_MODE (if passive)
 * @param {number} [args.transport.speed_m_per_min] (if passive)
 * @param {string} [args.transport.pool_id]  carrier pool id (if carrier)
 */
export function makeTrackSegment({ id, from_node_id, to_node_id, length_m, capacity = 10, transport }) {
  invariant(typeof id === 'string' && id.length > 0, 'trackSegment.id is required');
  invariant(typeof from_node_id === 'string' && from_node_id.length > 0, 'trackSegment.from_node_id is required');
  invariant(typeof to_node_id === 'string' && to_node_id.length > 0, 'trackSegment.to_node_id is required');
  invariant(Number.isFinite(length_m) && length_m > 0, `trackSegment.length_m must be > 0 (${id})`);
  invariant(Number.isInteger(capacity) && capacity > 0, `trackSegment.capacity must be > 0 (${id})`);
  invariant(transport && typeof transport === 'object', 'trackSegment.transport is required');
  invariant(['passive', 'carrier'].includes(transport.class), `trackSegment.transport.class must be 'passive' or 'carrier' (${id})`);

  if (transport.class === 'passive') {
    invariant(Object.values(TRANSPORT_MODE).includes(transport.mode), `trackSegment.transport.mode must be one of ${Object.values(TRANSPORT_MODE).join(', ')} (${id})`);
    invariant(Number.isFinite(transport.speed_m_per_min) && transport.speed_m_per_min > 0, `trackSegment.transport.speed_m_per_min must be > 0 (${id})`);
    invariant(transport.pool_id === undefined, `trackSegment.transport must not set field "pool_id" for passive class (${id})`);
  } else if (transport.class === 'carrier') {
    invariant(typeof transport.pool_id === 'string' && transport.pool_id.length > 0, `trackSegment.transport.pool_id is required for carrier class (${id})`);
    invariant(transport.mode === undefined && transport.speed_m_per_min === undefined, `trackSegment.transport must not set mode/speed_m_per_min for carrier class (${id})`);
  }

  return Object.freeze({
    kind_of: 'track_segment',
    id,
    from_node_id,
    to_node_id,
    length_m,
    capacity,
    transport: Object.freeze({ ...transport }),
  });
}
