// Unit — dynamic instance, the thing that flows (§4.3).
//
// A single independently-flowing item. Created lazily by the release governor.
// Carries mutable runtime location/enrichments/lifecycle, so it is NOT frozen.

import { invariant } from '../util/assert.js';
import { newId } from '../util/ids.js';

export const LOCATION_TYPE = Object.freeze({
  PENDING: 'pending',
  TRACK: 'track',
  STATION_INPUT: 'station_input',
  STATION_PROCESSING: 'station_processing',
  STATION_OUTPUT: 'station_output',
  EXIT: 'exit',
});

/**
 * @param {object} args
 * @param {string} args.material        material id this unit currently is
 * @param {string} args.order_id        parent order
 * @param {number} args.unit_number     1..N within the order
 * @param {string} [args.next_process]  next process id (from order sequence)
 * @param {number} [args.created_at=0]
 */
export function makeUnit({ material, order_id, unit_number, next_process = null, created_at = 0 }) {
  invariant(typeof material === 'string', 'unit.material (id) is required');
  invariant(typeof order_id === 'string', 'unit.order_id is required');
  invariant(Number.isInteger(unit_number) && unit_number >= 1, 'unit.unit_number must be >= 1');
  return {
    kind_of: 'unit',
    id: newId('unit'),
    material,
    order_id,
    unit_number,
    next_process,
    location: { type: LOCATION_TYPE.PENDING },
    enrichments: {},
    lifecycle: { created_at, completed_at: null, events: [] },
  };
}
