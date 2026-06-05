// Regression tests for relay-node routing (units passing through junction/buffer
// nodes that are neither a station input nor an exit).
//
// Bug history: units that arrived at a non-station, non-exit node were silently
// dropped by flow.applyArrivals — so any topology with a junction lost all its
// units. The default M800 `linearLine` fixture routes through `n_junction`, so it
// shipped zero units (the sim died at t=5).

import { describe, test, expect, beforeEach } from 'vitest';
import { resetIds } from '../util/ids.js';
import { makeFlowState, launchOnSegment, applyArrivals, nextArrivalTime } from './flow.js';
import { runTwin } from './engine.js';
import { validateFactoryConfig } from './validator.js';
import { makeUnit } from '../domain/unit.js';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';

import { makeFactoryConfig } from '../network/factoryConfig.js';
import { makeMaterial } from '../domain/material.js';
import { makeProcess, KIND } from '../domain/process.js';
import { makeOrder } from '../domain/order.js';
import { makeShift } from '../domain/shift.js';
import { makeTrackNode, NODE_TYPE } from '../network/trackNode.js';
import { makeTrackSegment, TRANSPORT_MODE } from '../network/trackSegment.js';
import { makeStation } from '../network/station.js';
import { makeExitNode, EXIT_KIND } from '../network/exitNode.js';

beforeEach(() => resetIds(0));

// intake -> J(junction) -> station -> ship
function makeJunctionConfig() {
  const passive = (speed) => ({ class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: speed });
  const mat = makeMaterial({ id: 'M', properties: {}, allowed_processes: ['p'] });
  const proc = makeProcess({ id: 'p', name: 'P', kind: KIND.TRANSFORM, output_material: 'M' });
  const nIn = makeTrackNode({ id: 'n_in', type: NODE_TYPE.INTAKE, name: 'in' });
  const nJ = makeTrackNode({ id: 'n_j', type: NODE_TYPE.JUNCTION, name: 'junction' });
  const nSt = makeTrackNode({ id: 'n_st', type: NODE_TYPE.STATION_INPUT, name: 'st' });
  const ship = makeExitNode({ id: 'ship', kind: EXIT_KIND.SHIP, name: 'ship' });
  const st = makeStation({ id: 'st', name: 'St', node_id: 'n_st', entry_buffer_capacity: 100,
    processes: [{ process_id: 'p', automation_level: 1, parallel_slots: 3, takt_seconds: 10, operators_per_slot: 0 }] });
  const segInJ = makeTrackSegment({ id: 's_in_j', from_node_id: 'n_in', to_node_id: 'n_j', length_m: 60, capacity: 100, transport: passive(360) }); // 10s
  const segJSt = makeTrackSegment({ id: 's_j_st', from_node_id: 'n_j', to_node_id: 'n_st', length_m: 60, capacity: 100, transport: passive(360) }); // 10s
  const segStShip = makeTrackSegment({ id: 's_st_ship', from_node_id: 'n_st', to_node_id: 'ship', length_m: 60, capacity: 100, transport: passive(360) });
  const order = makeOrder({ id: 'O', material_type: 'M', quantity: 5, process_sequence: ['p'], arrival_time: 0 });
  return makeFactoryConfig({
    materials: [mat], processes: [proc], stations: [st],
    segments: [segInJ, segJSt, segStShip], nodes: [nIn, nJ, nSt],
    exits: [ship], carrierPools: [], shifts: [makeShift({ id: 'd', name: 'd', duration_hours: 24 })], orders: [order],
  });
}

describe('relay routing', () => {
  test('a unit arriving at a junction is forwarded onto the outbound segment (not dropped)', () => {
    const cfg = makeJunctionConfig();
    const flow = makeFlowState(cfg);
    const segInJ = cfg.segments.find((s) => s.id === 's_in_j');
    const unit = makeUnit({ material: 'M', order_id: 'O', unit_number: 1, next_process: 'p' });

    launchOnSegment(flow, segInJ, unit, 0);
    // Arrives at the junction at t=10 — must be relayed, not buffered, not dropped.
    const arrivals = applyArrivals(flow, cfg, 10);
    expect(arrivals).toHaveLength(0); // junction is not a station, so no buffer arrival
    expect(flow.stationBuffers.get('st')).toHaveLength(0);

    // The unit is now in transit on the junction's outbound segment, arriving at t=20.
    expect(flow.segmentUnits.get('s_j_st')).toHaveLength(1);
    expect(nextArrivalTime(flow)).toBe(20);

    // It then reaches the station buffer on the next hop.
    const arrivals2 = applyArrivals(flow, cfg, 20);
    expect(arrivals2).toHaveLength(1);
    expect(arrivals2[0].stationId).toBe('st');
    expect(flow.stationBuffers.get('st')).toHaveLength(1);
  });

  test('a line with a junction ships all its units end-to-end', () => {
    const cfg = makeJunctionConfig();
    const { summary } = runTwin(cfg, { seed: 0, maxTime: 100000 });
    expect(summary.units_shipped).toBe(5);
    expect(summary.orders_completed).toBe(1);
  });
});

describe('M800 default fixture', () => {
  test('validates with no errors', () => {
    const { errors } = validateFactoryConfig(makeLinearLineFixture());
    expect(errors).toEqual([]);
  });

  test('runs to completion and ships every unit (no units lost at junctions)', () => {
    const cfg = makeLinearLineFixture();
    const { summary } = runTwin(cfg, { seed: 0, maxTime: 2000000 });
    expect(summary.units_shipped).toBeGreaterThan(0);
    expect(summary.orders_short).toBe(0);
    expect(summary.orders_completed).toBe(summary.total_orders);
  });
});
