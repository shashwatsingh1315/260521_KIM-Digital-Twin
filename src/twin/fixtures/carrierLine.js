// carrierLine fixture — Part A3.
//
// Topology:
//   n_intake(INTAKE) --s_in_a(10m conveyor)--> n_a[Station A: process 30s]
//   n_a              --s_a_b(20m carrier: AMR pool 'amr1')--> n_b[Station B: process 60s]
//   n_b              --s_b_ship(10m conveyor)--> ship(exit)
//
// Two variants:
//   makeCarrierLineFixture()         — carrier NOT the bottleneck (throughput > station B)
//   makeCarrierLineBottleneck()      — carrier IS the bottleneck (utilization ≥ 1, queue grows)

import { makeMaterial } from '../domain/material.js';
import { makeProcess, KIND } from '../domain/process.js';
import { makeOrder } from '../domain/order.js';
import { makeShift } from '../domain/shift.js';
import { makeTrackNode, NODE_TYPE } from '../network/trackNode.js';
import { makeTrackSegment, TRANSPORT_MODE } from '../network/trackSegment.js';
import { makeStation } from '../network/station.js';
import { makeCarrierPool, CARRIER_KIND } from '../network/carrierPool.js';
import { makeExitNode, EXIT_KIND } from '../network/exitNode.js';
import { makeFactoryConfig } from '../network/factoryConfig.js';

function buildCarrierLine({ amrCount, loadUnloadSec = 30, quantity = 5 }) {
  const blank = makeMaterial({ id: 'BLANK', properties: {}, allowed_processes: ['prep', 'finish'] });
  const prep = makeProcess({ id: 'prep', name: 'Prep', kind: KIND.TRANSFORM, output_material: 'BLANK' });
  const finish = makeProcess({ id: 'finish', name: 'Finish', kind: KIND.TRANSFORM, output_material: 'BLANK' });

  const nIntake = makeTrackNode({ id: 'n_intake', type: NODE_TYPE.INTAKE, name: 'Intake' });
  const nA = makeTrackNode({ id: 'n_a', type: NODE_TYPE.STATION_INPUT, name: 'Node A' });
  const nB = makeTrackNode({ id: 'n_b', type: NODE_TYPE.STATION_INPUT, name: 'Node B' });

  // AMR pool serving the middle segment.
  // Segment: 20m. Carrier RTT = (loadUnloadSec/2) + 20s + (loadUnloadSec/2) + 10s = loadUnloadSec + 30s
  // Normal (loadUnloadSec=30): RTT=60s; 3 carriers→180/hr; station B→60/hr → carrier not bottleneck
  // Bottleneck (loadUnloadSec=100): RTT=130s; 1 carrier→~27.7/hr < station B→60/hr → carrier is bottleneck
  const amrPool = makeCarrierPool({
    id: 'amr1',
    carrier_kind: CARRIER_KIND.AMR,
    count: amrCount,
    units_per_trip: 1,
    speed_loaded_m_per_min: 60,
    speed_empty_m_per_min: 120,
    load_unload_seconds: loadUnloadSec,
  });

  const sInA = makeTrackSegment({
    id: 's_in_a', from_node_id: 'n_intake', to_node_id: 'n_a',
    length_m: 10, capacity: 10,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
  });
  // Carrier segment: 20m long, served by amr1.
  const sAB = makeTrackSegment({
    id: 's_a_b', from_node_id: 'n_a', to_node_id: 'n_b',
    length_m: 20, capacity: 10,
    transport: { class: 'carrier', pool_id: 'amr1' },
  });
  const sBShip = makeTrackSegment({
    id: 's_b_ship', from_node_id: 'n_b', to_node_id: 'ship',
    length_m: 10, capacity: 10,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
  });

  const stationA = makeStation({
    id: 'station_a', name: 'Station A (Prep)', node_id: 'n_a', entry_buffer_capacity: 10,
    processes: [{ process_id: 'prep', automation_level: 0, parallel_slots: 1, takt_seconds: 30, operators_per_slot: 1 }],
  });
  const stationB = makeStation({
    id: 'station_b', name: 'Station B (Finish)', node_id: 'n_b', entry_buffer_capacity: 10,
    processes: [{ process_id: 'finish', automation_level: 0, parallel_slots: 1, takt_seconds: 60, operators_per_slot: 1 }],
  });

  const shipExit = makeExitNode({ id: 'ship', kind: EXIT_KIND.SHIP, name: 'Shipping' });
  const shift = makeShift({
    id: 'day', name: 'Day Shift', duration_hours: 8,
    staffing: { station_a: { operator: 1 }, station_b: { operator: 1 } },
  });

  const order = makeOrder({
    id: 'ORD1', material_type: 'BLANK', quantity,
    process_sequence: ['prep', 'finish'], arrival_time: 0,
  });

  return makeFactoryConfig({
    materials: [blank],
    processes: [prep, finish],
    stations: [stationA, stationB],
    segments: [sInA, sAB, sBShip],
    nodes: [nIntake, nA, nB],
    exits: [shipExit],
    carrierPools: [amrPool],
    shifts: [shift],
    orders: [order],
  });
}

/**
 * Normal variant: 3 AMR carriers, RTT=60s.
 * 3 × 60 = 180 units/hr vs station B 60/hr → carrier is NOT the bottleneck.
 */
export function makeCarrierLineFixture() {
  return buildCarrierLine({ amrCount: 3, loadUnloadSec: 30 });
}

/**
 * Bottleneck variant: 1 AMR carrier, RTT=130s (load_unload_seconds=100).
 * 1 carrier: throughput ≈ 27.7 units/hr (from derive.poolThroughput) < station B 60/hr
 * → carrier IS the bottleneck. Completion time is noticeably longer than the 3-carrier normal variant.
 */
export function makeCarrierLineBottleneck() {
  return buildCarrierLine({ amrCount: 1, loadUnloadSec: 100, quantity: 5 });
}
