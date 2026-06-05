import { describe, test, expect } from 'vitest';
import { buildTopology, inferLine, stationInputId, defaultLink } from './lineTopology.js';
import { buildAndValidate, toDraft } from '../configDraft.js';
import { makeLinearLineFixture } from '../../fixtures/linearLine.js';
import { makeAssemblyLineFixture } from '../../fixtures/assemblyLine.js';

// ── helpers ───────────────────────────────────────────────────────────────

// Compose a full, compilable draft from a list of station descriptors.
// Each descriptor: { id, name, procId, kind, takt, extra }.
// One material + one process per station is enough to exercise topology.
function draftFromLine(stationDescs, { links, shipLink, scrapLink } = {}) {
  const processes = stationDescs.map((d) => ({
    id: d.procId ?? `proc_${d.id}`,
    name: d.name ?? d.id,
    kind: d.kind ?? 'transform',
    output_material: 'MAT',
    pass_rate: d.kind === 'inspect' ? 0.9 : undefined,
    dwell_seconds: 60,
    slots: 1,
    bom: {},
    adds_enrichments: [],
  }));

  const stations = stationDescs.map((d) => ({
    id: d.id,
    name: d.name ?? d.id,
    node_id: stationInputId(d.id),
    entry_buffer_capacity: 10,
    processes: [{
      process_id: d.procId ?? `proc_${d.id}`,
      parallel_slots: 1,
      takt_seconds: d.takt ?? 30,
      operators_per_slot: 1,
      automation_level: 0,
    }],
  }));

  const stationsForTopo = stationDescs.map((d) => ({ id: d.id, name: d.name ?? d.id, inspect: d.kind === 'inspect' }));
  const linksArg = links ?? stationDescs.map(() => defaultLink());
  const topo = buildTopology(stationsForTopo, linksArg, { shipLink, scrapLink });

  // The first transform process must produce the material the order requests.
  const material = { id: 'MAT', allowed_processes: processes.map((p) => p.id), properties: {} };

  // An order routed through the full sequence (only transform/inspect kinds route here).
  const order = {
    id: 'ord_1',
    material_type: 'MAT',
    quantity: 5,
    process_sequence: processes.map((p) => p.id),
    arrival_time: 0,
  };

  return {
    seed: 0,
    materials: [material],
    processes,
    stations,
    nodes: topo.nodes,
    segments: topo.segments,
    exits: topo.exits,
    carrierPools: topo.carrierPools,
    shifts: [{ id: 'day', name: 'Day', start_time: '07:00', duration_hours: 8, days: ['mon'], staffing: {} }],
    orders: [order],
    _topo: topo,
  };
}

// ── buildTopology validity ──────────────────────────────────────────────────

describe('buildTopology — produces valid configs', () => {
  test('3-station passive line validates clean', () => {
    const draft = draftFromLine([
      { id: 's1' }, { id: 's2' }, { id: 's3' },
    ]);
    const { errors } = buildAndValidate(draft);
    expect(errors).toEqual([]);
  });

  test('single-station line validates clean', () => {
    const draft = draftFromLine([{ id: 'only' }]);
    const { errors } = buildAndValidate(draft);
    expect(errors).toEqual([]);
    // intake → only_input → ship  ==> 2 segments
    expect(draft.segments.length).toBe(2);
  });

  test('inspect line auto-creates a scrap exit + branch and validates', () => {
    const draft = draftFromLine([
      { id: 's1' },
      { id: 'qc', kind: 'inspect' },
    ]);
    const { errors } = buildAndValidate(draft);
    expect(errors).toEqual([]);
    expect(draft.exits.some((e) => e.kind === 'scrap')).toBe(true);
    expect(draft.segments.some((s) => s.from_node_id === stationInputId('qc') && s.to_node_id === 'scrap')).toBe(true);
  });

  test('removing the auto scrap exit makes the inspect line invalid (proves it is load-bearing)', () => {
    const draft = draftFromLine([{ id: 's1' }, { id: 'qc', kind: 'inspect' }]);
    draft.exits = draft.exits.filter((e) => e.kind !== 'scrap');
    draft.segments = draft.segments.filter((s) => s.to_node_id !== 'scrap');
    const { errors } = buildAndValidate(draft);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('no-inspect line has no scrap exit and still validates', () => {
    const draft = draftFromLine([{ id: 's1' }, { id: 's2' }]);
    expect(draft.exits.some((e) => e.kind === 'scrap')).toBe(false);
    const { errors } = buildAndValidate(draft);
    expect(errors).toEqual([]);
  });

  test('carrier link creates exactly one dedicated pool per link', () => {
    const links = [
      defaultLink(),
      { length_m: 20, capacity: 10, transport: { class: 'carrier', pool: { carrier_kind: 'amr', count: 2 } } },
      { length_m: 20, capacity: 10, transport: { class: 'carrier', pool: { carrier_kind: 'forklift', count: 1 } } },
    ];
    const draft = draftFromLine([{ id: 's1' }, { id: 's2' }, { id: 's3' }], { links });
    expect(draft.carrierPools.length).toBe(2);
    const ids = draft.carrierPools.map((p) => p.id);
    expect(new Set(ids).size).toBe(2); // distinct
    const { errors } = buildAndValidate(draft);
    expect(errors).toEqual([]); // no exclusivity error
  });

  test('node_id convention holds and reachability is actually exercised', () => {
    const draft = draftFromLine([{ id: 'a' }, { id: 'b' }]);
    for (const s of draft.stations) {
      expect(s.node_id).toBe(stationInputId(s.id));
    }
    // Drop the terminal ship segment → the last station becomes unreachable.
    draft.segments = draft.segments.filter((s) => s.to_node_id !== 'ship');
    const { errors } = buildAndValidate(draft);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('rejects empty and duplicate-id station lists', () => {
    expect(() => buildTopology([], [])).toThrow();
    expect(() => buildTopology(
      [{ id: 'x' }, { id: 'x' }],
      [defaultLink(), defaultLink()],
    )).toThrow();
  });

  test('deterministic ids for identical inputs', () => {
    const a = buildTopology([{ id: 's1' }, { id: 's2' }], [defaultLink(), defaultLink()]);
    const b = buildTopology([{ id: 's1' }, { id: 's2' }], [defaultLink(), defaultLink()]);
    expect(a.segments.map((s) => s.id)).toEqual(b.segments.map((s) => s.id));
    expect(a.nodes.map((n) => n.id)).toEqual(b.nodes.map((n) => n.id));
  });
});

// ── inferLine round-trip + rejection ─────────────────────────────────────────

describe('inferLine — reverse of buildTopology', () => {
  test('round-trips a mixed line (passive + carrier + inspect)', () => {
    const links = [
      defaultLink(),
      { length_m: 20, capacity: 8, transport: { class: 'carrier', pool: { carrier_kind: 'amr', count: 2 } } },
      defaultLink(),
    ];
    const draft = draftFromLine([
      { id: 's1' },
      { id: 's2' },
      { id: 'qc', kind: 'inspect' },
    ], { links });

    const res = inferLine(draft);
    expect(res.ok).toBe(true);
    expect(res.stationsInOrder.map((s) => s.id)).toEqual(['s1', 's2', 'qc']);
    expect(res.stationsInOrder[2].inspect).toBe(true);
    // carrier link resolved back with its pool spec
    expect(res.links[1].transport.class).toBe('carrier');
    expect(res.links[1].transport.pool.carrier_kind).toBe('amr');
    expect(res.links[1].transport.pool.count).toBe(2);
    expect(res.links[1].length_m).toBe(20);
    // passive link properties preserved
    expect(res.links[0].transport.class).toBe('passive');
    expect(res.shipLink).toBeTruthy();
  });

  test('rebuilding from inferLine output reproduces the same graph', () => {
    const draft = draftFromLine([{ id: 's1' }, { id: 's2' }, { id: 'qc', kind: 'inspect' }]);
    const res = inferLine(draft);
    const rebuilt = buildTopology(res.stationsInOrder, res.links, { shipLink: res.shipLink });
    expect(rebuilt.segments.map((s) => s.id).sort()).toEqual(draft.segments.map((s) => s.id).sort());
    expect(rebuilt.nodes.map((n) => n.id).sort()).toEqual(draft.nodes.map((n) => n.id).sort());
  });

  test('rejects the assemblyLine fixture (two intakes / fan-in)', () => {
    const res = inferLine(toDraft(makeAssemblyLineFixture()));
    expect(res.ok).toBe(false);
    expect(typeof res.reason).toBe('string');
  });

  test('rejects the linearLine fixture (not a simple line)', () => {
    const res = inferLine(toDraft(makeLinearLineFixture()));
    expect(res.ok).toBe(false);
  });

  test('rejects a config that breaks the _input convention', () => {
    const draft = draftFromLine([{ id: 's1' }, { id: 's2' }]);
    draft.stations[0].node_id = 'something_else';
    const res = inferLine(draft);
    expect(res.ok).toBe(false);
  });
});
