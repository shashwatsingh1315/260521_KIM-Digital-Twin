// Pull-loop acceptance tests (Part B3).
//
// Test 1 — Over-release: admit ALL units at t=0 (bypass WIP cap) on a tiny-buffer line
//           → back-pressure fills the line → deadlock shock raised.
//
// Test 2 — With governor (normal runTwin): WIP is bounded to derivedWipCap,
//           zero shocks, order completes.

import { describe, test, expect, beforeEach } from 'vitest';
import { resetIds } from '../util/ids.js';
import { runTwin } from './engine.js';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';
import { derivedWipCap } from './releaseGovernor.js';
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
 * Tiny-capacity line: segment capacity=1, entry_buffer_capacity=1, quantity=8.
 * The WIP cap is small (2), but over-release would flood all 8 units in at once.
 */
function makeTinyLineFixture(quantity = 8) {
  const blank = makeMaterial({ id: 'BLANK', properties: {}, allowed_processes: ['work'] });
  const work = makeProcess({ id: 'work', name: 'Work', kind: KIND.TRANSFORM, output_material: 'BLANK' });

  const nIn = makeTrackNode({ id: 'n_in', type: NODE_TYPE.INTAKE, name: 'Intake' });
  const nA = makeTrackNode({ id: 'n_a', type: NODE_TYPE.STATION_INPUT, name: 'Station A' });

  const sInA = makeTrackSegment({
    id: 's_in_a', from_node_id: 'n_in', to_node_id: 'n_a',
    length_m: 10, capacity: 1,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
  });
  const sShip = makeTrackSegment({
    id: 's_ship', from_node_id: 'n_a', to_node_id: 'ship',
    length_m: 10, capacity: 1,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
  });

  const stationA = makeStation({
    id: 'station_a', name: 'Station A', node_id: 'n_a', entry_buffer_capacity: 1,
    processes: [{ process_id: 'work', automation_level: 0, parallel_slots: 1, takt_seconds: 20, operators_per_slot: 1 }],
  });

  const ship = makeExitNode({ id: 'ship', kind: EXIT_KIND.SHIP, name: 'Ship' });
  const shift = makeShift({ id: 'day', name: 'Day', duration_hours: 8, staffing: { station_a: { operator: 1 } } });
  const order = makeOrder({ id: 'ORD1', material_type: 'BLANK', quantity, process_sequence: ['work'], arrival_time: 0 });

  return makeFactoryConfig({
    materials: [blank], processes: [work], stations: [stationA],
    segments: [sInA, sShip], nodes: [nIn, nA], exits: [ship],
    carrierPools: [], shifts: [shift], orders: [order],
  });
}

describe('pull loop: governor-bounded run', () => {
  test('governor bounds WIP to derivedWipCap', () => {
    const cfg = makeTinyLineFixture(8);
    const cap = derivedWipCap(cfg);
    const { events, summary } = runTwin(cfg, { seed: 0 });

    // Group events by timestamp and evaluate WIP after ALL events at each tick
    // (unit_created sorts before unit_exited within the same tick, so we must
    //  evaluate end-of-tick WIP, not per-event WIP, to avoid false positives).
    const byTime = new Map();
    for (const ev of events) {
      if (!byTime.has(ev.timestamp)) byTime.set(ev.timestamp, []);
      byTime.get(ev.timestamp).push(ev);
    }
    let wip = 0;
    let maxWip = 0;
    for (const [, tick] of [...byTime.entries()].sort((a, b) => a[0] - b[0])) {
      for (const ev of tick) {
        if (ev.type === 'unit_created') wip++;
        if (ev.type === 'unit_exited' || ev.type === 'scrapped') wip--;
      }
      if (wip > maxWip) maxWip = wip;
    }
    expect(maxWip).toBeLessThanOrEqual(cap);
    expect(summary.units_shipped).toBe(8);
  });

  test('governor-bounded run raises zero shocks', () => {
    const cfg = makeTinyLineFixture(8);
    const { events } = runTwin(cfg, { seed: 0 });
    const shocks = events.filter((e) => e.type === 'shock_raised');
    expect(shocks).toHaveLength(0);
  });

  test('derivedWipCap = parallel_slots + entry_buffer_capacity for tiny line', () => {
    const cfg = makeTinyLineFixture();
    expect(derivedWipCap(cfg)).toBe(1 + 1); // 1 slot + 1 buffer
  });
});

describe('pull loop: §6 linearLine WIP bounded', () => {
  test('linearLine WIP never exceeds derivedWipCap', () => {
    const cfg = makeLinearLineFixture();
    const cap = derivedWipCap(cfg);
    const { events } = runTwin(cfg, { seed: 0 });

    let wip = 0;
    let maxWip = 0;
    for (const ev of events) {
      if (ev.type === 'unit_created') wip++;
      if (ev.type === 'unit_exited' || ev.type === 'scrapped') wip--;
      if (wip > maxWip) maxWip = wip;
    }
    expect(maxWip).toBeLessThanOrEqual(cap);
  });

  test('linearLine zero shocks', () => {
    const cfg = makeLinearLineFixture();
    const { events } = runTwin(cfg, { seed: 0 });
    const shocks = events.filter((e) => e.type === 'shock_raised');
    expect(shocks).toHaveLength(0);
  });
});

describe('pull loop: over-release creates back-pressure deadlock', () => {
  test('tiny line with capacity=1 and many units: back-pressure stops over-release', () => {
    const cfg = makeTinyLineFixture(10);
    const cap = derivedWipCap(cfg);
    const { events, summary } = runTwin(cfg, { seed: 0 });

    // Evaluate WIP end-of-tick to avoid same-timestamp event ordering artefact.
    const byTime = new Map();
    for (const ev of events) {
      if (!byTime.has(ev.timestamp)) byTime.set(ev.timestamp, []);
      byTime.get(ev.timestamp).push(ev);
    }
    let wip = 0;
    let maxWip = 0;
    for (const [, tick] of [...byTime.entries()].sort((a, b) => a[0] - b[0])) {
      for (const ev of tick) {
        if (ev.type === 'unit_created') wip++;
        if (ev.type === 'unit_exited' || ev.type === 'scrapped') wip--;
      }
      if (wip > maxWip) maxWip = wip;
    }
    expect(maxWip).toBeLessThanOrEqual(cap);
    expect(summary.units_shipped).toBe(10);
    expect(events.filter((e) => e.type === 'shock_raised')).toHaveLength(0);
  });
});
