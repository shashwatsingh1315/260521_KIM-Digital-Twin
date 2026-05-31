import { describe, test, expect } from 'vitest';
import { makeTrackNode, NODE_TYPE } from './trackNode.js';
import { makeTrackSegment, TRANSPORT_MODE } from './trackSegment.js';
import { makeStation, AUTOMATION_LEVEL } from './station.js';
import { makeCarrierPool, CARRIER_KIND } from './carrierPool.js';
import { makeExitNode, EXIT_KIND } from './exitNode.js';
import { makeFactoryConfig } from './factoryConfig.js';
import { makeMaterial } from '../domain/material.js';
import { makeProcess, KIND } from '../domain/process.js';
import { makeOrder } from '../domain/order.js';
import { makeShift } from '../domain/shift.js';

describe('makeTrackNode', () => {
  test('builds a frozen node', () => {
    const n = makeTrackNode({ id: 'intake1', type: NODE_TYPE.INTAKE, name: 'Main Intake' });
    expect(n.id).toBe('intake1');
    expect(n.type).toBe('intake');
    expect(Object.isFrozen(n)).toBe(true);
  });
  test('rejects invalid type', () => {
    expect(() => makeTrackNode({ id: 'n', type: 'invalid' })).toThrow(/must be one of/);
  });
});

describe('makeTrackSegment', () => {
  test('accepts passive conveyor transport', () => {
    const seg = makeTrackSegment({
      id: 's1',
      from_node_id: 'n1',
      to_node_id: 'n2',
      length_m: 50,
      capacity: 5,
      transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
    });
    expect(seg.transport.class).toBe('passive');
    expect(seg.transport.speed_m_per_min).toBe(60);
    expect(Object.isFrozen(seg)).toBe(true);
  });
  test('rejects passive with pool_id', () => {
    expect(() =>
      makeTrackSegment({
        id: 's1',
        from_node_id: 'n1',
        to_node_id: 'n2',
        length_m: 50,
        transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60, pool_id: 'p1' },
      }),
    ).toThrow(/must not set field "pool_id"/);
  });
  test('accepts carrier transport', () => {
    const seg = makeTrackSegment({
      id: 's2',
      from_node_id: 'n2',
      to_node_id: 'n3',
      length_m: 100,
      transport: { class: 'carrier', pool_id: 'amr_pool' },
    });
    expect(seg.transport.class).toBe('carrier');
    expect(seg.transport.pool_id).toBe('amr_pool');
  });
  test('rejects carrier with mode/speed', () => {
    expect(() =>
      makeTrackSegment({
        id: 's2',
        from_node_id: 'n2',
        to_node_id: 'n3',
        length_m: 100,
        transport: { class: 'carrier', pool_id: 'p', mode: TRANSPORT_MODE.CONVEYOR },
      }),
    ).toThrow(/must not set mode\/speed_m_per_min/);
  });
  test('defaults capacity to 10', () => {
    const seg = makeTrackSegment({
      id: 's',
      from_node_id: 'n1',
      to_node_id: 'n2',
      length_m: 20,
      transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
    });
    expect(seg.capacity).toBe(10);
  });
});

describe('makeStation', () => {
  test('builds a station with processes', () => {
    const st = makeStation({
      id: 'heat', name: 'Heating Station', node_id: 'n_heat',
      processes: [{ process_id: 'heat_proc', parallel_slots: 1, takt_seconds: 30, operators_per_slot: 1 }],
    });
    expect(st.id).toBe('heat');
    expect(st.node_id).toBe('n_heat');
    expect(st.processes[0].process_id).toBe('heat_proc');
    expect(st.processes[0].parallel_slots).toBe(1);
    expect(Object.isFrozen(st)).toBe(true);
  });
  test('defaults operators_per_slot to 0 (fully automated)', () => {
    const st = makeStation({
      id: 'auto', name: 'Auto', node_id: 'n_auto',
      processes: [{ process_id: 'p1', parallel_slots: 2, takt_seconds: 10 }],
    });
    expect(st.processes[0].operators_per_slot).toBe(0);
  });
  test('defaults automation_level to 0', () => {
    const st = makeStation({
      id: 's', name: 'S', node_id: 'n_s',
      processes: [{ process_id: 'p', parallel_slots: 1, takt_seconds: 10 }],
    });
    expect(st.processes[0].automation_level).toBe(0);
  });
  test('rejects parallel_slots < 1', () => {
    expect(() =>
      makeStation({
        id: 's', name: 'S', node_id: 'n_s',
        processes: [{ process_id: 'p', parallel_slots: 0, takt_seconds: 10 }],
      }),
    ).toThrow(/parallel_slots must be >= 1/);
  });
  test('rejects missing node_id', () => {
    expect(() =>
      makeStation({ id: 's', name: 'S', processes: [] }),
    ).toThrow(/node_id is required/);
  });
});

describe('makeCarrierPool', () => {
  test('person defaults counts_as_labor and shift_gated to true', () => {
    const p = makeCarrierPool({ id: 'people', carrier_kind: CARRIER_KIND.PERSON, count: 3 });
    expect(p.counts_as_labor).toBe(true);
    expect(p.shift_gated).toBe(true);
  });
  test('amr defaults both to false', () => {
    const p = makeCarrierPool({ id: 'amrs', carrier_kind: CARRIER_KIND.AMR, count: 2 });
    expect(p.counts_as_labor).toBe(false);
    expect(p.shift_gated).toBe(false);
  });
  test('forklift defaults both to true', () => {
    const p = makeCarrierPool({ id: 'forks', carrier_kind: CARRIER_KIND.FORKLIFT, count: 1 });
    expect(p.counts_as_labor).toBe(true);
    expect(p.shift_gated).toBe(true);
  });
  test('allows override of defaults', () => {
    const p = makeCarrierPool({ id: 'amr_manual', carrier_kind: CARRIER_KIND.AMR, count: 1, counts_as_labor: true });
    expect(p.counts_as_labor).toBe(true);
    expect(p.shift_gated).toBe(false);
  });
  test('defaults speeds and load_unload', () => {
    const p = makeCarrierPool({ id: 'p', carrier_kind: CARRIER_KIND.AMR, count: 1 });
    expect(p.speed_loaded_m_per_min).toBe(60);
    expect(p.speed_empty_m_per_min).toBe(120);
    expect(p.load_unload_seconds).toBe(30);
    expect(p.units_per_trip).toBe(1);
  });
});

describe('makeExitNode', () => {
  test('builds a ship exit', () => {
    const e = makeExitNode({ id: 'shipping', kind: EXIT_KIND.SHIP, name: 'Shipping Bay' });
    expect(e.kind).toBe('ship');
    expect(Object.isFrozen(e)).toBe(true);
  });
  test('builds a scrap exit', () => {
    const e = makeExitNode({ id: 'scrap', kind: EXIT_KIND.SCRAP });
    expect(e.kind).toBe('scrap');
  });
});

describe('makeFactoryConfig', () => {
  test('assembles a valid config', () => {
    const mat = makeMaterial({ id: 'STEEL', properties: {}, allowed_processes: ['heat'] });
    const proc = makeProcess({ id: 'heat', name: 'Heat', kind: KIND.TRANSFORM, output_material: 'STEEL' });
    const shift = makeShift({ id: 'day', name: 'Day', duration_hours: 8 });
    const order = makeOrder({ id: 'ORD1', material_type: 'STEEL', quantity: 5, process_sequence: ['heat'] });

    const config = makeFactoryConfig({
      materials: [mat],
      processes: [proc],
      stations: [],
      segments: [],
      nodes: [],
      exits: [],
      carrierPools: [],
      shifts: [shift],
      orders: [order],
    });
    expect(config.materials).toHaveLength(1);
    expect(config.orders).toHaveLength(1);
    expect(Object.isFrozen(config)).toBe(true);
  });
  test('rejects duplicate material ids', () => {
    const m1 = makeMaterial({ id: 'M', properties: {}, allowed_processes: [] });
    const m2 = makeMaterial({ id: 'M', properties: {}, allowed_processes: [] });
    expect(() => makeFactoryConfig({ materials: [m1, m2] })).toThrow(/duplicated/);
  });
  test('rejects order referencing unknown material', () => {
    const order = makeOrder({ id: 'O', material_type: 'UNKNOWN', quantity: 1, process_sequence: ['p'] });
    expect(() => makeFactoryConfig({ orders: [order] })).toThrow(/unknown material/);
  });
  test('rejects order referencing unknown process', () => {
    const mat = makeMaterial({ id: 'M', properties: {}, allowed_processes: [] });
    const order = makeOrder({ id: 'O', material_type: 'M', quantity: 1, process_sequence: ['UNKNOWN'] });
    expect(() => makeFactoryConfig({ materials: [mat], orders: [order] })).toThrow(/unknown process/);
  });
  test('rejects station referencing unknown process', () => {
    const n = makeTrackNode({ id: 'n_s', type: NODE_TYPE.STATION_INPUT });
    const st = makeStation({ id: 's', name: 'S', node_id: 'n_s', processes: [{ process_id: 'UNKNOWN', parallel_slots: 1, takt_seconds: 10 }] });
    expect(() => makeFactoryConfig({ nodes: [n], stations: [st] })).toThrow(/unknown process/);
  });
});
