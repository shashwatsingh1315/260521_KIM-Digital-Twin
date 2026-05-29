// linearLine fixture — §6 worked example.
//
// Intake → A(transform,30s) → B(transform,60s) → C(transform,20s) → ship
// B is the bottleneck at 60/hr throughput. Total takt = 110s.
// Orders: 3 units of BLANK through all processes.

import { makeMaterial } from '../domain/material.js';
import { makeProcess, KIND } from '../domain/process.js';
import { makeOrder } from '../domain/order.js';
import { makeShift } from '../domain/shift.js';
import { makeTrackNode, NODE_TYPE } from '../network/trackNode.js';
import { makeTrackSegment, TRANSPORT_MODE } from '../network/trackSegment.js';
import { makeStation } from '../network/station.js';
import { makeExitNode, EXIT_KIND } from '../network/exitNode.js';
import { makeFactoryConfig } from '../network/factoryConfig.js';

export function makeLinearLineFixture() {
  const blank = makeMaterial({
    id: 'BLANK',
    properties: {},
    allowed_processes: ['heat', 'treat', 'cool'],
  });

  const heat = makeProcess({
    id: 'heat',
    name: 'Heat',
    kind: KIND.TRANSFORM,
    output_material: 'BLANK',
  });

  const treat = makeProcess({
    id: 'treat',
    name: 'Treat',
    kind: KIND.TRANSFORM,
    output_material: 'BLANK',
  });

  const cool = makeProcess({
    id: 'cool',
    name: 'Cool',
    kind: KIND.TRANSFORM,
    output_material: 'BLANK',
  });

  // Network topology: intake → A → B → C → exit
  const intakeNode = makeTrackNode({
    id: 'intake',
    type: NODE_TYPE.INTAKE,
    name: 'Intake',
  });

  const juncAB = makeTrackNode({
    id: 'junc_ab',
    type: NODE_TYPE.BUFFER,
    name: 'A→B Buffer',
  });

  const juncBC = makeTrackNode({
    id: 'junc_bc',
    type: NODE_TYPE.BUFFER,
    name: 'B→C Buffer',
  });

  const exitNode = makeTrackNode({
    id: 'exit',
    type: NODE_TYPE.BUFFER,
    name: 'Shipping Buffer',
  });

  const sega = makeTrackSegment({
    id: 'seg_intake_a',
    from_node_id: 'intake',
    to_node_id: 'junc_ab',
    length_m: 10,
    capacity: 10,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
  });

  const segab = makeTrackSegment({
    id: 'seg_a_b',
    from_node_id: 'junc_ab',
    to_node_id: 'junc_bc',
    length_m: 20,
    capacity: 10,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
  });

  const segbc = makeTrackSegment({
    id: 'seg_b_c',
    from_node_id: 'junc_bc',
    to_node_id: 'exit',
    length_m: 15,
    capacity: 10,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
  });

  const stationA = makeStation({
    id: 'station_a',
    name: 'Station A (Heat)',
    processes: [
      {
        process_id: 'heat',
        automation_level: 0,
        parallel_slots: 1,
        takt_seconds: 30,
        operators_per_slot: 1,
      },
    ],
  });

  const stationB = makeStation({
    id: 'station_b',
    name: 'Station B (Treat)',
    processes: [
      {
        process_id: 'treat',
        automation_level: 0,
        parallel_slots: 1,
        takt_seconds: 60,
        operators_per_slot: 1,
      },
    ],
  });

  const stationC = makeStation({
    id: 'station_c',
    name: 'Station C (Cool)',
    processes: [
      {
        process_id: 'cool',
        automation_level: 0,
        parallel_slots: 1,
        takt_seconds: 20,
        operators_per_slot: 1,
      },
    ],
  });

  const shipExit = makeExitNode({
    id: 'ship',
    kind: EXIT_KIND.SHIP,
    name: 'Shipping',
  });

  const shift = makeShift({
    id: 'day',
    name: 'Day Shift',
    duration_hours: 8,
    staffing: {
      station_a: { operator: 1 },
      station_b: { operator: 1 },
      station_c: { operator: 1 },
    },
  });

  const order1 = makeOrder({
    id: 'ORD1',
    material_type: 'BLANK',
    quantity: 3,
    process_sequence: ['heat', 'treat', 'cool'],
    arrival_time: 0,
  });

  return makeFactoryConfig({
    materials: [blank],
    processes: [heat, treat, cool],
    stations: [stationA, stationB, stationC],
    segments: [sega, segab, segbc],
    nodes: [intakeNode, juncAB, juncBC, exitNode],
    exits: [shipExit],
    carrierPools: [],
    shifts: [shift],
    orders: [order1],
  });
}
