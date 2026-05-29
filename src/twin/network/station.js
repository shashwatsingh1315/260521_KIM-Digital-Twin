// Station — factory workstation (§7.3).
//
// A station executes one or more processes sequentially. Each process has:
// - takt_seconds: time to complete one unit
// - parallel_slots: how many units can be worked in parallel
// - operators_per_slot: labor required per active slot
// - automation_level: optional metadata (0..1 fraction automated)
// Capacity_per_hour is derived, not stored (§15).

import { invariant } from '../util/assert.js';

export const AUTOMATION_LEVEL = Object.freeze({
  MANUAL: 0,
  SEMI_AUTOMATED: 0.5,
  FULLY_AUTOMATED: 1,
});

/**
 * @param {object} args
 * @param {string} args.id
 * @param {string} args.name
 * @param {string} args.node_id              network node this station sits at
 * @param {number} [args.entry_buffer_capacity=10]
 * @param {Array<{process_id:string, automation_level?:number, parallel_slots:number, takt_seconds:number, operators_per_slot?:number}>} args.processes
 */
export function makeStation({ id, name, node_id, entry_buffer_capacity = 10, processes = [] }) {
  invariant(typeof id === 'string' && id.length > 0, 'station.id is required');
  invariant(typeof name === 'string' && name.length > 0, `station.name is required (${id})`);
  invariant(typeof node_id === 'string' && node_id.length > 0, `station.node_id is required (${id})`);
  invariant(Number.isInteger(entry_buffer_capacity) && entry_buffer_capacity > 0, `station.entry_buffer_capacity must be > 0 (${id})`);
  invariant(Array.isArray(processes), `station.processes must be an array (${id})`);

  const normProcs = processes.map((p, idx) => {
    invariant(typeof p.process_id === 'string' && p.process_id.length > 0, `station process[${idx}].process_id is required (${id})`);
    invariant(Number.isInteger(p.parallel_slots) && p.parallel_slots >= 1, `station process[${idx}].parallel_slots must be >= 1 (${id})`);
    invariant(Number.isFinite(p.takt_seconds) && p.takt_seconds > 0, `station process[${idx}].takt_seconds must be > 0 (${id})`);
    const ops_per_slot = p.operators_per_slot ?? 0;
    invariant(Number.isFinite(ops_per_slot) && ops_per_slot >= 0, `station process[${idx}].operators_per_slot must be >= 0 (${id})`);
    const auto_level = p.automation_level ?? 0;
    invariant(Number.isFinite(auto_level) && auto_level >= 0 && auto_level <= 1, `station process[${idx}].automation_level must be 0..1 (${id})`);
    return Object.freeze({
      process_id: p.process_id,
      automation_level: auto_level,
      parallel_slots: p.parallel_slots,
      takt_seconds: p.takt_seconds,
      operators_per_slot: ops_per_slot,
    });
  });

  return Object.freeze({
    kind_of: 'station',
    id,
    name,
    node_id,
    entry_buffer_capacity,
    processes: Object.freeze(normProcs),
  });
}
