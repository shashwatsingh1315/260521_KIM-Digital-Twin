// releaseGovernor.js — pull-gated lazy unit creation (§6).
//
// Admits a unit from a pending order only when WIP is below the derived cap.
// Cap = bottleneck.parallel_slots + bottleneck.entry_buffer_capacity.

import { makeUnit } from '../domain/unit.js';
import { bottleneck } from './derive.js';

/**
 * Try to admit the next unit from a pending/in-progress order.
 * Returns the created unit, or null if WIP cap hit or no orders ready.
 *
 * @param {object} govState   { wipCount: number }
 * @param {object} config
 * @param {object[]} orders   live order objects (mutable runtime counters)
 * @param {number} now
 */
export function tryAdmit(govState, config, orders, now) {
  const cap = derivedWipCap(config);

  if (govState.wipCount >= cap) return null;

  // Find the next arrived order that still needs units. Rotate the starting
  // point so one large order cannot fill the entire WIP cap and starve
  // component streams needed by downstream assembly.
  const start = govState.nextOrderIndex ?? 0;
  for (let offset = 0; offset < orders.length; offset++) {
    const idx = (start + offset) % orders.length;
    const order = orders[idx];
    if (order.arrival_time > now) continue;
    if (order.status === 'completed' || order.status === 'short') continue;
    if (order.units_created >= order.quantity) continue;
    // Skip product orders whose units are born at assembly (not at intake).
    // A product order's material_type matches the assembly process's output_material.
    const firstProcId = order.process_sequence[0];
    const firstProc = config.processes.find((p) => p.id === firstProcId);
    if (firstProc && firstProc.kind === 'assembly' && firstProc.output_material === order.material_type) continue;

    const unitNumber = order.units_created + 1;
    const nextProcess = order.process_sequence[0];

    const unit = makeUnit({
      material: order.material_type,
      order_id: order.id,
      unit_number: unitNumber,
      next_process: nextProcess,
      created_at: now,
    });

    order.units_created++;
    if (order.status === 'pending') order.status = 'in_progress';
    govState.wipCount++;
    govState.nextOrderIndex = (idx + 1) % orders.length;

    return unit;
  }

  return null;
}

/**
 * Derived WIP cap from bottleneck station.
 * Falls back to 10 if no stations configured.
 */
export function derivedWipCap(config) {
  const bn = bottleneck(config);
  if (!bn) return 10;
  const bnStation = config.stations.find((s) => s.id === bn.station_id);
  if (!bnStation) return 10;
  const bnProc = bnStation.processes.find((sp) => sp.process_id === bn.process_id);
  const slots = bnProc ? bnProc.parallel_slots : 1;
  return slots + bnStation.entry_buffer_capacity;
}
