// Material — static definition (§4.1).
// A material type with physical properties and the set of processes it may
// undergo. `allowed_processes` is an UNORDERED set of process ids; the actual
// sequence is decided per-order (Order.process_sequence).

import { invariant } from '../util/assert.js';

/**
 * @param {object} args
 * @param {string} args.id                e.g. "STEEL_COIL"
 * @param {object} [args.properties]      { weight_kg, dimensions:{l,w,h}, sku }
 * @param {string[]} [args.allowed_processes] process ids (unordered)
 */
export function makeMaterial({ id, properties = {}, allowed_processes = [] }) {
  invariant(typeof id === 'string' && id.length > 0, 'material.id is required');
  invariant(Array.isArray(allowed_processes), 'material.allowed_processes must be an array');
  return Object.freeze({
    kind_of: 'material',
    id,
    properties: Object.freeze({ ...properties }),
    allowed_processes: Object.freeze([...allowed_processes]),
  });
}
