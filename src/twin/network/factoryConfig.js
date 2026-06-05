// FactoryConfig — the complete factory specification (§7).
//
// Bundles all static entities: materials, processes, stations, network topology,
// carrier pools, shifts, and orders. Validated by the engine before run.
// This is the single document the simulation consumes.

import { invariant } from '../util/assert.js';

/**
 * @param {object} args
 * @param {Array} args.materials            Material[]
 * @param {Array} args.processes            Process[]
 * @param {Array} args.stations             Station[]
 * @param {Array} args.segments             TrackSegment[]
 * @param {Array} args.nodes                TrackNode[]
 * @param {Array} args.exits                ExitNode[]
 * @param {Array} args.carrierPools         CarrierPool[]
 * @param {Array} args.shifts               Shift[]
 * @param {Array} args.orders               Order[]
 */
export function makeFactoryConfig({
  materials = [],
  processes = [],
  stations = [],
  segments = [],
  nodes = [],
  exits = [],
  carrierPools = [],
  shifts = [],
  orders = [],
  layout_overrides = {},
}) {
  invariant(Array.isArray(materials), 'factoryConfig.materials must be an array');
  invariant(Array.isArray(processes), 'factoryConfig.processes must be an array');
  invariant(Array.isArray(stations), 'factoryConfig.stations must be an array');
  invariant(Array.isArray(segments), 'factoryConfig.segments must be an array');
  invariant(Array.isArray(nodes), 'factoryConfig.nodes must be an array');
  invariant(Array.isArray(exits), 'factoryConfig.exits must be an array');
  invariant(Array.isArray(carrierPools), 'factoryConfig.carrierPools must be an array');
  invariant(Array.isArray(shifts), 'factoryConfig.shifts must be an array');
  invariant(Array.isArray(orders), 'factoryConfig.orders must be an array');

  // Build lookup maps first (before validating references).
  const matIds = new Set();
  const procIds = new Set();
  const stationIds = new Set();
  const segmentIds = new Set();
  const nodeIds = new Set();
  const exitIds = new Set();
  const poolIds = new Set();
  const shiftIds = new Set();
  const orderIds = new Set();

  // First pass: build all lookup sets.
  materials.forEach((m) => {
    invariant(m.kind_of === 'material', 'materials[] must contain Material objects');
    invariant(!matIds.has(m.id), `material id "${m.id}" is duplicated`);
    matIds.add(m.id);
  });

  processes.forEach((p) => {
    invariant(p.kind_of === 'process', 'processes[] must contain Process objects');
    invariant(!procIds.has(p.id), `process id "${p.id}" is duplicated`);
    procIds.add(p.id);
  });

  nodes.forEach((n) => {
    invariant(n.kind_of === 'track_node', 'nodes[] must contain TrackNode objects');
    invariant(!nodeIds.has(n.id), `node id "${n.id}" is duplicated`);
    nodeIds.add(n.id);
  });

  exits.forEach((e) => {
    invariant(e.kind_of === 'exit_node', 'exits[] must contain ExitNode objects');
    invariant(!exitIds.has(e.id), `exit id "${e.id}" is duplicated`);
    exitIds.add(e.id);
  });

  carrierPools.forEach((p) => {
    invariant(p.kind_of === 'carrier_pool', 'carrierPools[] must contain CarrierPool objects');
    invariant(!poolIds.has(p.id), `pool id "${p.id}" is duplicated`);
    poolIds.add(p.id);
  });

  // Second pass: validate references using complete lookup sets.
  stations.forEach((s) => {
    invariant(s.kind_of === 'station', 'stations[] must contain Station objects');
    invariant(!stationIds.has(s.id), `station id "${s.id}" is duplicated`);
    stationIds.add(s.id);
    invariant(nodeIds.has(s.node_id), `station "${s.id}" references unknown node "${s.node_id}"`);
    s.processes.forEach((sp) => {
      invariant(procIds.has(sp.process_id), `station "${s.id}" references unknown process "${sp.process_id}"`);
    });
  });

  segments.forEach((seg) => {
    invariant(seg.kind_of === 'track_segment', 'segments[] must contain TrackSegment objects');
    invariant(!segmentIds.has(seg.id), `segment id "${seg.id}" is duplicated`);
    segmentIds.add(seg.id);
    invariant(nodeIds.has(seg.from_node_id), `segment "${seg.id}" references unknown node "${seg.from_node_id}"`);
    // to_node_id may be a network node OR an exit node.
    invariant(
      nodeIds.has(seg.to_node_id) || exitIds.has(seg.to_node_id),
      `segment "${seg.id}" references unknown destination "${seg.to_node_id}"`,
    );
    if (seg.transport.class === 'carrier') {
      invariant(poolIds.has(seg.transport.pool_id), `segment "${seg.id}" references unknown pool "${seg.transport.pool_id}"`);
    }
  });

  shifts.forEach((sh) => {
    invariant(sh.kind_of === 'shift', 'shifts[] must contain Shift objects');
    invariant(!shiftIds.has(sh.id), `shift id "${sh.id}" is duplicated`);
    shiftIds.add(sh.id);
  });

  orders.forEach((o) => {
    invariant(o.kind_of === 'order', 'orders[] must contain Order objects');
    invariant(!orderIds.has(o.id), `order id "${o.id}" is duplicated`);
    orderIds.add(o.id);
    invariant(matIds.has(o.material_type), `order "${o.id}" references unknown material "${o.material_type}"`);
    o.process_sequence.forEach((pid, idx) => {
      invariant(procIds.has(pid), `order "${o.id}" process_sequence[${idx}] references unknown process "${pid}"`);
    });
  });

  return Object.freeze({
    kind_of: 'factory_config',
    materials: Object.freeze([...materials]),
    processes: Object.freeze([...processes]),
    stations: Object.freeze([...stations]),
    segments: Object.freeze([...segments]),
    nodes: Object.freeze([...nodes]),
    exits: Object.freeze([...exits]),
    carrierPools: Object.freeze([...carrierPools]),
    shifts: Object.freeze([...shifts]),
    orders: Object.freeze([...orders]),
    layout_overrides: normalizeLayoutOverrides(layout_overrides),
  });
}

// Normalize manual coordinate overrides to frozen { x, y, z } in meters.
//
// Coordinates are real-world measured positions (metres) keyed by node id, so
// that a layout traced from an engineering drawing survives every config
// round-trip (draft edit, JSON import, DB load). Non-finite or partial entries
// are coerced to finite numbers (missing axes default to 0) and silently
// dropped if they carry no usable value, keeping the map clean.
export function normalizeLayoutOverrides(overrides) {
  const out = {};
  for (const [nodeId, raw] of Object.entries(overrides || {})) {
    if (!raw || typeof raw !== 'object') continue;
    const x = Number(raw.x);
    const y = Number(raw.y);
    const z = Number(raw.z);
    out[nodeId] = Object.freeze({
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      z: Number.isFinite(z) ? z : 0,
    });
  }
  return Object.freeze(out);
}
