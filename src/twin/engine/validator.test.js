import { describe, test, expect } from 'vitest';
import { validateFactoryConfig } from './validator.js';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';
import { makeAssemblyLineFixture } from '../fixtures/assemblyLine.js';
import { makeMaterial } from '../domain/material.js';
import { makeProcess, KIND } from '../domain/process.js';
import { makeOrder } from '../domain/order.js';
import { makeShift } from '../domain/shift.js';
import { makeTrackNode, NODE_TYPE } from '../network/trackNode.js';
import { makeTrackSegment, TRANSPORT_MODE } from '../network/trackSegment.js';
import { makeStation } from '../network/station.js';
import { makeExitNode, EXIT_KIND } from '../network/exitNode.js';
import { makeCarrierPool, CARRIER_KIND } from '../network/carrierPool.js';
import { makeFactoryConfig } from '../network/factoryConfig.js';

describe('validateFactoryConfig', () => {
  test('clean linearLine passes', () => {
    const cfg = makeLinearLineFixture();
    const result = validateFactoryConfig(cfg);
    expect(result.errors).toHaveLength(0);
  });

  test('clean assemblyLine passes', () => {
    const cfg = makeAssemblyLineFixture();
    const result = validateFactoryConfig(cfg);
    expect(result.errors).toHaveLength(0);
  });

  test('detects cycle in segment graph', () => {
    // Create a simple cycle: A → B → C → A
    const mat = makeMaterial({ id: 'M', properties: {}, allowed_processes: ['p'] });
    const proc = makeProcess({ id: 'p', name: 'P', kind: KIND.TRANSFORM, output_material: 'M' });

    const nA = makeTrackNode({ id: 'a', type: NODE_TYPE.BUFFER });
    const nB = makeTrackNode({ id: 'b', type: NODE_TYPE.BUFFER });
    const nC = makeTrackNode({ id: 'c', type: NODE_TYPE.BUFFER });

    const segAB = makeTrackSegment({
      id: 's1',
      from_node_id: 'a',
      to_node_id: 'b',
      length_m: 10,
      transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
    });

    const segBC = makeTrackSegment({
      id: 's2',
      from_node_id: 'b',
      to_node_id: 'c',
      length_m: 10,
      transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
    });

    const segCA = makeTrackSegment({
      id: 's3',
      from_node_id: 'c',
      to_node_id: 'a',
      length_m: 10,
      transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
    });

    const exit = makeExitNode({ id: 'exit', kind: EXIT_KIND.SHIP });
    const st = makeStation({ id: 'st', name: 'S', processes: [{ process_id: 'p', parallel_slots: 1, takt_seconds: 10 }] });

    const cfg = makeFactoryConfig({
      materials: [mat],
      processes: [proc],
      stations: [st],
      segments: [segAB, segBC, segCA],
      nodes: [nA, nB, nC],
      exits: [exit],
      orders: [],
    });

    const result = validateFactoryConfig(cfg);
    expect(result.errors.some((e) => e.includes('cycle'))).toBe(true);
  });

  test('detects missing ship exit', () => {
    const mat = makeMaterial({ id: 'M', properties: {}, allowed_processes: ['p'] });
    const proc = makeProcess({ id: 'p', name: 'P', kind: KIND.TRANSFORM, output_material: 'M' });

    const nA = makeTrackNode({ id: 'a', type: NODE_TYPE.BUFFER });
    const scrapExit = makeExitNode({ id: 'scrap', kind: EXIT_KIND.SCRAP });
    const st = makeStation({ id: 'st', name: 'S', processes: [{ process_id: 'p', parallel_slots: 1, takt_seconds: 10 }] });

    const cfg = makeFactoryConfig({
      materials: [mat],
      processes: [proc],
      stations: [st],
      segments: [],
      nodes: [nA],
      exits: [scrapExit],
      orders: [],
    });

    const result = validateFactoryConfig(cfg);
    expect(result.errors.some((e) => e.includes('ship exit'))).toBe(true);
  });

  test('detects process not done by any station', () => {
    const mat = makeMaterial({ id: 'M', properties: {}, allowed_processes: ['p', 'unused'] });
    const proc1 = makeProcess({ id: 'p', name: 'P', kind: KIND.TRANSFORM, output_material: 'M' });
    const proc2 = makeProcess({ id: 'unused', name: 'U', kind: KIND.TRANSFORM, output_material: 'M' });
    const order = makeOrder({ id: 'O', material_type: 'M', quantity: 1, process_sequence: ['unused'] });

    const exit = makeExitNode({ id: 'exit', kind: EXIT_KIND.SHIP });
    const st = makeStation({ id: 'st', name: 'S', processes: [{ process_id: 'p', parallel_slots: 1, takt_seconds: 10 }] });

    const cfg = makeFactoryConfig({
      materials: [mat],
      processes: [proc1, proc2],
      stations: [st],
      segments: [],
      nodes: [],
      exits: [exit],
      orders: [order],
    });

    const result = validateFactoryConfig(cfg);
    expect(result.errors.some((e) => e.includes('no station does it'))).toBe(true);
  });

  test('detects inspect without scrap exit', () => {
    const mat = makeMaterial({ id: 'M', properties: {}, allowed_processes: ['qc'] });
    const inspect = makeProcess({ id: 'qc', name: 'QC', kind: KIND.INSPECT, pass_rate: 0.9 });

    const exit = makeExitNode({ id: 'ship', kind: EXIT_KIND.SHIP });

    const cfg = makeFactoryConfig({
      materials: [mat],
      processes: [inspect],
      stations: [],
      segments: [],
      nodes: [],
      exits: [exit],
      orders: [],
    });

    const result = validateFactoryConfig(cfg);
    expect(result.errors.some((e) => e.includes('Inspect process') && e.includes('scrap exit'))).toBe(true);
  });

  test('allows inspect with scrap exit', () => {
    const mat = makeMaterial({ id: 'M', properties: {}, allowed_processes: ['qc'] });
    const inspect = makeProcess({ id: 'qc', name: 'QC', kind: KIND.INSPECT, pass_rate: 0.9 });

    const shipExit = makeExitNode({ id: 'ship', kind: EXIT_KIND.SHIP });
    const scrapExit = makeExitNode({ id: 'scrap', kind: EXIT_KIND.SCRAP });

    const cfg = makeFactoryConfig({
      materials: [mat],
      processes: [inspect],
      stations: [],
      segments: [],
      nodes: [],
      exits: [shipExit, scrapExit],
      orders: [],
    });

    const result = validateFactoryConfig(cfg);
    expect(result.errors.filter((e) => e.includes('Inspect process'))).toHaveLength(0);
  });

  test('detects shared carrier pool (non-exclusive)', () => {
    const mat = makeMaterial({ id: 'M', properties: {}, allowed_processes: ['p'] });
    const proc = makeProcess({ id: 'p', name: 'P', kind: KIND.TRANSFORM, output_material: 'M' });

    const nA = makeTrackNode({ id: 'a', type: NODE_TYPE.BUFFER });
    const nB = makeTrackNode({ id: 'b', type: NODE_TYPE.BUFFER });
    const nC = makeTrackNode({ id: 'c', type: NODE_TYPE.BUFFER });

    const pool = makeCarrierPool({ id: 'pool', carrier_kind: CARRIER_KIND.AMR, count: 1 });

    const seg1 = makeTrackSegment({
      id: 's1',
      from_node_id: 'a',
      to_node_id: 'b',
      length_m: 10,
      transport: { class: 'carrier', pool_id: 'pool' },
    });

    const seg2 = makeTrackSegment({
      id: 's2',
      from_node_id: 'b',
      to_node_id: 'c',
      length_m: 10,
      transport: { class: 'carrier', pool_id: 'pool' },
    });

    const exit = makeExitNode({ id: 'exit', kind: EXIT_KIND.SHIP });
    const st = makeStation({ id: 'st', name: 'S', processes: [{ process_id: 'p', parallel_slots: 1, takt_seconds: 10 }] });

    const cfg = makeFactoryConfig({
      materials: [mat],
      processes: [proc],
      stations: [st],
      segments: [seg1, seg2],
      nodes: [nA, nB, nC],
      exits: [exit],
      carrierPools: [pool],
      orders: [],
    });

    const result = validateFactoryConfig(cfg);
    expect(result.errors.some((e) => e.includes('used by multiple segments'))).toBe(true);
  });

  test('warns on bottleneck tie', () => {
    const mat = makeMaterial({ id: 'M', properties: {}, allowed_processes: ['p1', 'p2'] });
    const p1 = makeProcess({ id: 'p1', name: 'P1', kind: KIND.TRANSFORM, output_material: 'M' });
    const p2 = makeProcess({ id: 'p2', name: 'P2', kind: KIND.TRANSFORM, output_material: 'M' });

    const st1 = makeStation({
      id: 'st1',
      name: 'S1',
      processes: [{ process_id: 'p1', parallel_slots: 1, takt_seconds: 60, operators_per_slot: 0 }],
    });

    const st2 = makeStation({
      id: 'st2',
      name: 'S2',
      processes: [{ process_id: 'p2', parallel_slots: 1, takt_seconds: 60, operators_per_slot: 0 }],
    });

    const exit = makeExitNode({ id: 'exit', kind: EXIT_KIND.SHIP });

    const cfg = makeFactoryConfig({
      materials: [mat],
      processes: [p1, p2],
      stations: [st1, st2],
      segments: [],
      nodes: [],
      exits: [exit],
      orders: [],
    });

    const result = validateFactoryConfig(cfg);
    expect(result.warnings.some((w) => w.includes('bottleneck') && w.includes('tied'))).toBe(true);
  });
});
