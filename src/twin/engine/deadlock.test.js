// Tests for deadlock detector (Part B1).
//
// Tests: kitting stall creates a detectable cycle → exactly one shock_raised;
//        healthy assembly run → zero shocks.

import { describe, test, expect, beforeEach } from 'vitest';
import { resetIds } from '../util/ids.js';
import { runTwin } from './engine.js';
import { makeAssemblyLineFixture } from '../fixtures/assemblyLine.js';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';
import { makeMaterial } from '../domain/material.js';
import { makeProcess, KIND } from '../domain/process.js';
import { makeOrder } from '../domain/order.js';
import { makeShift } from '../domain/shift.js';
import { makeTrackNode, NODE_TYPE } from '../network/trackNode.js';
import { makeTrackSegment, TRANSPORT_MODE } from '../network/trackSegment.js';
import { makeStation } from '../network/station.js';
import { makeExitNode, EXIT_KIND } from '../network/exitNode.js';
import { makeFactoryConfig } from '../network/factoryConfig.js';

beforeEach(() => resetIds(0));

/**
 * Kitting stall deadlock fixture.
 *
 * entry_buffer_capacity = 2, parallel_slots = 1 → WIP cap = 1+2 = 3.
 * Orders listed PCB-first: governor admits PCB1, PCB2, CASING1 (cap hit).
 * At t=10 all three arrive; buffer holds PCB1+PCB2 (full at 2); CASING1 is
 * held in seg_case. Assembly has [PCB1, PCB2] but no CASING → can't start.
 * CASING1 can't enter (buffer full). No future events → deadlock cycle:
 *   station_assem → seg_case → station_assem
 */
function makeKittingStallFixture() {
  const pcb = makeMaterial({ id: 'PCB', properties: {}, allowed_processes: [] });
  const casing = makeMaterial({ id: 'CASING', properties: {}, allowed_processes: [] });
  const device = makeMaterial({ id: 'DEVICE', properties: {}, allowed_processes: [] });

  const assembly = makeProcess({
    id: 'assemble', name: 'Assembly', kind: KIND.ASSEMBLY,
    output_material: 'DEVICE', bom: { PCB: 1, CASING: 1 },
  });

  const nPcbIn = makeTrackNode({ id: 'n_pcb_in', type: NODE_TYPE.INTAKE, name: 'PCB Intake' });
  const nCaseIn = makeTrackNode({ id: 'n_case_in', type: NODE_TYPE.INTAKE, name: 'Casing Intake' });
  const nAssem = makeTrackNode({ id: 'n_assem', type: NODE_TYPE.STATION_INPUT, name: 'Assembly' });

  // seg_pcb listed first — determines arrival processing order.
  const segPcb = makeTrackSegment({
    id: 'seg_pcb', from_node_id: 'n_pcb_in', to_node_id: 'n_assem',
    length_m: 10, capacity: 5,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
  });
  const segCase = makeTrackSegment({
    id: 'seg_case', from_node_id: 'n_case_in', to_node_id: 'n_assem',
    length_m: 10, capacity: 5,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
  });
  const segShip = makeTrackSegment({
    id: 'seg_ship', from_node_id: 'n_assem', to_node_id: 'ship',
    length_m: 5, capacity: 10,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
  });

  // Buffer capacity = 2: PCB1+PCB2 fill it; CASING1 held in seg_case → deadlock cycle.
  const stationAssem = makeStation({
    id: 'station_assem', name: 'Assembly', node_id: 'n_assem',
    entry_buffer_capacity: 2,
    processes: [{ process_id: 'assemble', automation_level: 0, parallel_slots: 1, takt_seconds: 10, operators_per_slot: 0 }],
  });

  const shipExit = makeExitNode({ id: 'ship', kind: EXIT_KIND.SHIP, name: 'Ship' });
  const shift = makeShift({ id: 'day', name: 'Day', duration_hours: 8, staffing: {} });

  // PCB quantity=2 exactly fills the buffer (cap=2). The 3rd WIP slot goes to CASING1.
  // Governor admits PCB1, PCB2 (exhausts PCB order), then CASING1 (cap=3 hit).
  // At t=10: PCB1+PCB2 enter buffer (full), CASING1 held in seg_case → cycle.
  const orderPcb = makeOrder({
    id: 'COMP_PCB', material_type: 'PCB', quantity: 2,
    process_sequence: ['assemble'], arrival_time: 0,
  });
  const orderCase = makeOrder({
    id: 'COMP_CASING', material_type: 'CASING', quantity: 3,
    process_sequence: ['assemble'], arrival_time: 0,
  });
  const orderDev = makeOrder({
    id: 'ORD1', material_type: 'DEVICE', quantity: 3,
    process_sequence: ['assemble'], arrival_time: 0,
  });

  return makeFactoryConfig({
    materials: [pcb, casing, device],
    processes: [assembly],
    stations: [stationAssem],
    segments: [segPcb, segCase, segShip],
    nodes: [nPcbIn, nCaseIn, nAssem],
    exits: [shipExit],
    carrierPools: [],
    shifts: [shift],
    orders: [orderDev, orderPcb, orderCase],
  });
}

describe('deadlock detector', () => {
  test('healthy assembly run raises zero shocks', () => {
    resetIds(0);
    const cfg = makeAssemblyLineFixture();
    const { events } = runTwin(cfg, { seed: 0 });
    const shocks = events.filter((e) => e.type === 'shock_raised');
    expect(shocks).toHaveLength(0);
  });

  test('kitting stall: exactly one shock_raised emitted', () => {
    const cfg = makeKittingStallFixture();
    const { events } = runTwin(cfg, { seed: 0 });
    const shocks = events.filter((e) => e.type === 'shock_raised');
    expect(shocks).toHaveLength(1);
  });

  test('kitting stall shock names the assembly station', () => {
    const cfg = makeKittingStallFixture();
    const { events } = runTwin(cfg, { seed: 0 });
    const shock = events.find((e) => e.type === 'shock_raised');
    expect(shock.reason).toMatch(/deadlock/i);
    expect(shock.members.some((m) => m.includes('station_assem'))).toBe(true);
  });

  test('kitting stall shock names the blocked segment', () => {
    const cfg = makeKittingStallFixture();
    const { events } = runTwin(cfg, { seed: 0 });
    const shock = events.find((e) => e.type === 'shock_raised');
    // The CASING segment (or PCB segment) should be in the cycle members.
    expect(shock.members.some((m) => m.startsWith('seg:'))).toBe(true);
  });

  test('kitting stall: no products shipped (stalled before any completion)', () => {
    const cfg = makeKittingStallFixture();
    const { summary } = runTwin(cfg, { seed: 0 });
    expect(summary.units_shipped).toBe(0);
  });

  test('linearLine healthy run raises zero shocks', () => {
    resetIds(0);
    const cfg = makeLinearLineFixture();
    const { events } = runTwin(cfg, { seed: 0 });
    const shocks = events.filter((e) => e.type === 'shock_raised');
    expect(shocks).toHaveLength(0);
  });
});
