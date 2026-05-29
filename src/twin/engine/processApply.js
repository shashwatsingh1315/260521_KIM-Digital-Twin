// processApply — pure per-kind effect on process completion (§4.4.1).
//
// Returns { outputUnits, scrap, enrichments } — never mutates in place.
// The engine integrates the result into state.

import { newId } from '../util/ids.js';
import { LOCATION_TYPE } from '../domain/unit.js';

/**
 * Apply a process to a completed unit.
 *
 * @param {object} args
 * @param {object} args.unit         the unit that just completed
 * @param {object} args.process      the Process definition
 * @param {object} args.order        the parent Order
 * @param {object[]} args.allOrders  all orders (needed for assembly product order lookup)
 * @param {Function} args.rng        seeded rng () => [0,1) for inspect pass/fail
 * @returns {{ keep: object|null, scrap: boolean, newUnit: object|null }}
 *   keep: updated unit to continue (null if scrapped or consumed by assembly)
 *   scrap: true if unit should go to scrap exit
 *   newUnit: newly born product unit (assembly only)
 */
export function applyProcess({ unit, process, order, allOrders, rng }) {
  const kind = process.kind;

  if (kind === 'transform') {
    const updated = {
      ...unit,
      material: process.output_material,
      enrichments: mergeEnrichments(unit.enrichments, process.adds_enrichments),
    };
    return { keep: updated, scrap: false, newUnit: null };
  }

  if (kind === 'label' || kind === 'seal') {
    const updated = {
      ...unit,
      enrichments: mergeEnrichments(unit.enrichments, process.adds_enrichments),
    };
    return { keep: updated, scrap: false, newUnit: null };
  }

  if (kind === 'inspect') {
    const roll = rng();
    if (roll < process.pass_rate) {
      return { keep: { ...unit }, scrap: false, newUnit: null };
    }
    return { keep: null, scrap: true, newUnit: null };
  }

  if (kind === 'hold' || kind === 'store') {
    return { keep: { ...unit }, scrap: false, newUnit: null };
  }

  if (kind === 'offload') {
    return { keep: { ...unit }, scrap: false, newUnit: null };
  }

  // Assembly is handled separately in the engine (needs kit check).
  // intake is handled by the release governor.
  throw new Error(`[twin] applyProcess: unhandled kind "${kind}"`);
}

/**
 * Check if an assembly station's input buffer holds a complete kit for the given bom.
 * Returns { complete: bool, kitUnits: Unit[] (the matched component units) }
 * kitUnits is empty if kit is incomplete.
 */
export function checkAssemblyKit(inputBuffer, bom) {
  const remaining = { ...bom };
  const kit = [];

  for (const unit of inputBuffer) {
    const mat = unit.material;
    if (remaining[mat] && remaining[mat] > 0) {
      kit.push(unit);
      remaining[mat]--;
    }
  }

  const complete = Object.values(remaining).every((qty) => qty === 0);
  return { complete, kitUnits: complete ? kit : [] };
}

/**
 * Produce the assembled product unit from a complete kit.
 * Consumes the kit (caller removes those units from the buffer).
 */
export function assembleUnit({ process, kitUnits, productOrder, now }) {
  const enrichments = process.enrichment_inherit === 'union'
    ? kitUnits.reduce((acc, u) => ({ ...acc, ...u.enrichments }), {})
    : {};
  const withAdded = mergeEnrichments(enrichments, process.adds_enrichments);

  return {
    kind_of: 'unit',
    id: newId('unit'),
    material: process.output_material,
    order_id: productOrder.id,
    unit_number: (productOrder.units_created || 0) + 1,
    next_process: null,
    location: { type: LOCATION_TYPE.STATION_PROCESSING },
    enrichments: withAdded,
    lifecycle: { created_at: now, completed_at: null, events: [] },
  };
}

function mergeEnrichments(existing, adds) {
  if (!adds || adds.length === 0) return existing;
  const result = { ...existing };
  for (const key of adds) {
    result[key] = true;
  }
  return result;
}
