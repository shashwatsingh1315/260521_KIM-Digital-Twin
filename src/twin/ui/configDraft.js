// configDraft.js — convert a FactoryConfig to an editable plain-object draft
// and back, then validate. The ConfigPanel edits the draft; on Apply we rebuild
// a real FactoryConfig through the make* factories (which enforce field rules)
// and run validateFactoryConfig (which enforces graph/routing rules).

import { makeMaterial } from '../domain/material.js';
import { makeProcess, KIND } from '../domain/process.js';
import { makeOrder } from '../domain/order.js';
import { makeShift } from '../domain/shift.js';
import { makeStation } from '../network/station.js';
import { makeTrackNode } from '../network/trackNode.js';
import { makeTrackSegment, TRANSPORT_MODE } from '../network/trackSegment.js';
import { makeExitNode } from '../network/exitNode.js';
import { makeCarrierPool, CARRIER_KIND } from '../network/carrierPool.js';
import { makeFactoryConfig } from '../network/factoryConfig.js';
import { validateFactoryConfig } from '../engine/validator.js';

export const PROCESS_KINDS = Object.values(KIND);
export const NODE_TYPES = ['intake', 'junction', 'buffer', 'station_input'];
export const EXIT_KINDS = ['ship', 'scrap'];
export const CARRIER_KINDS = Object.values(CARRIER_KIND);
export const TRANSPORT_MODES = Object.values(TRANSPORT_MODE);

// ---- config → draft (deep clone into editable plain objects) ----

export function toDraft(config) {
  return {
    seed: 0,
    materials: (config.materials ?? []).map((m) => ({
      id: m.id,
      allowed_processes: [...(m.allowed_processes ?? [])],
      properties: { ...(m.properties ?? {}) },
    })),
    processes: (config.processes ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      output_material: p.output_material ?? '',
      pass_rate: p.pass_rate ?? 0.9,
      dwell_seconds: p.dwell_seconds ?? 60,
      slots: p.slots ?? 1,
      bom: { ...(p.bom ?? {}) },
      adds_enrichments: [...(p.adds_enrichments ?? [])],
    })),
    stations: (config.stations ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      node_id: s.node_id,
      entry_buffer_capacity: s.entry_buffer_capacity,
      processes: (s.processes ?? []).map((sp) => ({
        process_id: sp.process_id,
        parallel_slots: sp.parallel_slots,
        takt_seconds: sp.takt_seconds,
        operators_per_slot: sp.operators_per_slot,
        automation_level: sp.automation_level ?? 0,
      })),
    })),
    nodes: (config.nodes ?? []).map((n) => ({ id: n.id, type: n.type, name: n.name ?? '' })),
    segments: (config.segments ?? []).map((sg) => ({
      id: sg.id,
      from_node_id: sg.from_node_id,
      to_node_id: sg.to_node_id,
      length_m: sg.length_m,
      capacity: sg.capacity,
      class: sg.transport.class,
      mode: sg.transport.mode ?? TRANSPORT_MODE.CONVEYOR,
      speed_m_per_min: sg.transport.speed_m_per_min ?? 60,
      pool_id: sg.transport.pool_id ?? '',
    })),
    exits: (config.exits ?? []).map((e) => ({ id: e.id, kind: e.kind, name: e.name ?? '' })),
    carrierPools: (config.carrierPools ?? []).map((p) => ({
      id: p.id,
      carrier_kind: p.carrier_kind,
      count: p.count,
      units_per_trip: p.units_per_trip,
      speed_loaded_m_per_min: p.speed_loaded_m_per_min,
      speed_empty_m_per_min: p.speed_empty_m_per_min,
      load_unload_seconds: p.load_unload_seconds,
    })),
    shifts: (config.shifts ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      start_time: s.start_time,
      duration_hours: s.duration_hours,
      days: [...(s.days ?? [])],
      staffing: { ...(s.staffing ?? {}) },
    })),
    orders: (config.orders ?? []).map((o) => ({
      id: o.id,
      material_type: o.material_type,
      quantity: o.quantity,
      process_sequence: [...(o.process_sequence ?? [])],
      arrival_time: o.arrival_time ?? 0,
    })),
    // Measured node coordinates (metres), keyed by node id. Carried through the
    // draft so engineering-drawing positions survive edits, import, and reload.
    layout_overrides: Object.fromEntries(
      Object.entries(config.layout_overrides ?? {}).map(([id, p]) => [
        id, { x: p?.x ?? 0, y: p?.y ?? 0, z: p?.z ?? 0 },
      ]),
    ),
  };
}

// ---- coercion helpers ----
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const int = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };

function buildProcess(d) {
  const base = { id: d.id, name: d.name, kind: d.kind };
  switch (d.kind) {
    case KIND.TRANSFORM:
      return makeProcess({ ...base, output_material: d.output_material });
    case KIND.ASSEMBLY: {
      const bom = {};
      for (const [k, v] of Object.entries(d.bom ?? {})) if (k) bom[k] = int(v, 1);
      return makeProcess({ ...base, output_material: d.output_material, bom });
    }
    case KIND.INSPECT:
      return makeProcess({ ...base, pass_rate: num(d.pass_rate, 0.9) });
    case KIND.LABEL:
    case KIND.SEAL:
      return makeProcess({ ...base, adds_enrichments: (d.adds_enrichments ?? []).filter(Boolean) });
    case KIND.HOLD:
      return makeProcess({ ...base, dwell_seconds: num(d.dwell_seconds, 60), slots: int(d.slots, 1) });
    case KIND.STORE:
      return makeProcess({ ...base, slots: int(d.slots, 1) });
    case KIND.INTAKE:
      return makeProcess({ ...base, ...(d.output_material ? { output_material: d.output_material } : {}) });
    default:
      return makeProcess(base);
  }
}

function buildSegment(d) {
  const transport = d.class === 'carrier'
    ? { class: 'carrier', pool_id: d.pool_id }
    : { class: 'passive', mode: d.mode, speed_m_per_min: num(d.speed_m_per_min, 60) };
  return makeTrackSegment({
    id: d.id,
    from_node_id: d.from_node_id,
    to_node_id: d.to_node_id,
    length_m: num(d.length_m, 1),
    capacity: int(d.capacity, 1),
    transport,
  });
}

// ---- draft → FactoryConfig (throws on any factory-level invariant) ----

export function buildConfig(draft) {
  const materials = draft.materials.map((m) =>
    makeMaterial({ id: m.id, allowed_processes: m.allowed_processes.filter(Boolean), properties: m.properties }));

  const processes = draft.processes.map(buildProcess);

  const stations = draft.stations.map((s) =>
    makeStation({
      id: s.id,
      name: s.name,
      node_id: s.node_id,
      entry_buffer_capacity: int(s.entry_buffer_capacity, 10),
      processes: s.processes.map((sp) => ({
        process_id: sp.process_id,
        parallel_slots: int(sp.parallel_slots, 1),
        takt_seconds: num(sp.takt_seconds, 1),
        operators_per_slot: num(sp.operators_per_slot, 0),
        automation_level: num(sp.automation_level, 0),
      })),
    }));

  const nodes = draft.nodes.map((n) => makeTrackNode({ id: n.id, type: n.type, name: n.name }));
  const segments = draft.segments.map(buildSegment);
  const exits = draft.exits.map((e) => makeExitNode({ id: e.id, kind: e.kind, name: e.name }));

  const carrierPools = draft.carrierPools.map((p) =>
    makeCarrierPool({
      id: p.id,
      carrier_kind: p.carrier_kind,
      count: int(p.count, 1),
      units_per_trip: int(p.units_per_trip, 1),
      speed_loaded_m_per_min: num(p.speed_loaded_m_per_min, 60),
      speed_empty_m_per_min: num(p.speed_empty_m_per_min, 120),
      load_unload_seconds: num(p.load_unload_seconds, 30),
    }));

  const shifts = draft.shifts.map((s) => {
    const staffing = {};
    for (const [k, v] of Object.entries(s.staffing ?? {})) if (k) staffing[k] = int(v, 0);
    return makeShift({
      id: s.id,
      name: s.name,
      start_time: s.start_time,
      duration_hours: num(s.duration_hours, 7),
      days: (s.days ?? []).filter(Boolean),
      staffing,
    });
  });

  const orders = draft.orders.map((o) =>
    makeOrder({
      id: o.id,
      material_type: o.material_type,
      quantity: int(o.quantity, 1),
      process_sequence: (o.process_sequence ?? []).filter(Boolean),
      arrival_time: num(o.arrival_time, 0),
    }));

  return makeFactoryConfig({
    materials, processes, stations, segments, nodes, exits, carrierPools, shifts, orders,
    layout_overrides: draft.layout_overrides ?? {},
  });
}

// ---- combined build + validate; never throws ----

export function buildAndValidate(draft) {
  try {
    const config = buildConfig(draft);
    const v = validateFactoryConfig(config);
    return { config, errors: v.errors, warnings: v.warnings };
  } catch (err) {
    return { config: null, errors: [err.message], warnings: [] };
  }
}
