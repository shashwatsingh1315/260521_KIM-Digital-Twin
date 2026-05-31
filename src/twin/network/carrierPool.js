// CarrierPool — fleet of mobile units (§7.1).
//
// A pool of carriers (person, AMR, forklift) moves units between segments.
// counts_as_labor and shift_gated default from carrier_kind but can be overridden.
// Each carrier makes round trips: load → traverse loaded → unload → empty return.

import { invariant } from '../util/assert.js';

export const CARRIER_KIND = Object.freeze({
  PERSON: 'person',
  AMR: 'amr',
  FORKLIFT: 'forklift',
});

const CARRIER_DEFAULTS = {
  person: { counts_as_labor: true, shift_gated: true },
  amr: { counts_as_labor: false, shift_gated: false },
  forklift: { counts_as_labor: true, shift_gated: true },
};

/**
 * @param {object} args
 * @param {string} args.id
 * @param {string} args.carrier_kind         CARRIER_KIND value
 * @param {number} args.count                fleet size
 * @param {boolean} [args.counts_as_labor]   defaults from carrier_kind
 * @param {boolean} [args.shift_gated]       defaults from carrier_kind
 * @param {number} [args.units_per_trip=1]
 * @param {number} [args.speed_loaded_m_per_min=60]
 * @param {number} [args.speed_empty_m_per_min=120]
 * @param {number} [args.load_unload_seconds=30]
 */
export function makeCarrierPool({
  id,
  carrier_kind,
  count,
  counts_as_labor,
  shift_gated,
  units_per_trip = 1,
  speed_loaded_m_per_min = 60,
  speed_empty_m_per_min = 120,
  load_unload_seconds = 30,
}) {
  invariant(typeof id === 'string' && id.length > 0, 'carrierPool.id is required');
  invariant(Object.values(CARRIER_KIND).includes(carrier_kind), `carrierPool.carrier_kind "${carrier_kind}" must be one of ${Object.values(CARRIER_KIND).join(', ')}`);
  invariant(Number.isInteger(count) && count >= 1, 'carrierPool.count must be >= 1');
  invariant(Number.isInteger(units_per_trip) && units_per_trip >= 1, 'carrierPool.units_per_trip must be >= 1');
  invariant(Number.isFinite(speed_loaded_m_per_min) && speed_loaded_m_per_min > 0, 'carrierPool.speed_loaded_m_per_min must be > 0');
  invariant(Number.isFinite(speed_empty_m_per_min) && speed_empty_m_per_min > 0, 'carrierPool.speed_empty_m_per_min must be > 0');
  invariant(Number.isFinite(load_unload_seconds) && load_unload_seconds >= 0, 'carrierPool.load_unload_seconds must be >= 0');

  const defaults = CARRIER_DEFAULTS[carrier_kind];
  const ctal = counts_as_labor !== undefined ? counts_as_labor : defaults.counts_as_labor;
  const sg = shift_gated !== undefined ? shift_gated : defaults.shift_gated;
  invariant(typeof ctal === 'boolean', 'carrierPool.counts_as_labor must be boolean');
  invariant(typeof sg === 'boolean', 'carrierPool.shift_gated must be boolean');

  return Object.freeze({
    kind_of: 'carrier_pool',
    id,
    carrier_kind,
    count,
    counts_as_labor: ctal,
    shift_gated: sg,
    units_per_trip,
    speed_loaded_m_per_min,
    speed_empty_m_per_min,
    load_unload_seconds,
  });
}
