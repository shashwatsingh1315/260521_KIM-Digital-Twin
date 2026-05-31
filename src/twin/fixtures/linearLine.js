// linearLine fixture — §6 worked example.
//
// Topology (one node per station; all conveyors at 60 m/min = 1 m/s):
//   n_intake(INTAKE) --s_in_a(10m)--> n_a[Station A: heat 30s]
//   n_a --s_a_b(20m)--> n_b[Station B: treat 60s BOTTLENECK]
//   n_b --s_b_c(15m)--> n_c[Station C: cool 20s]
//   n_c --s_c_ship(10m)--> ship(exit)
//
// Travel times: in_a=10s, a_b=20s, b_c=15s, c_ship=10s (length/speed = length_m/1)
// §6 timeline: Unit1 exits t=165; spacing = 60s (bottleneck B takt); ORD1 done t=285.

import { makeMaterial } from '../domain/material.js';
import { makeProcess, KIND } from '../domain/process.js';
import { makeSchemaMatrix } from '../domain/schemaMatrix.js';
import { makeOrder } from '../domain/order.js';
import { makeShift } from '../domain/shift.js';
import { makeTrackNode, NODE_TYPE } from '../network/trackNode.js';
import { makeTrackSegment, TRANSPORT_MODE } from '../network/trackSegment.js';
import { makeStation } from '../network/station.js';
import { makeExitNode, EXIT_KIND } from '../network/exitNode.js';
import { makeFactoryConfig } from '../network/factoryConfig.js';

// Segment speed constant for travel-time assertions in tests.
export const CONVEYOR_SPEED_M_PER_MIN = 60;

export function makeLinearLineFixture() {
  const blank = makeMaterial({
    id: 'BLANK',
    properties: {},
    allowed_processes: ['heat', 'treat', 'cool'],
  });

  const heat = makeProcess({ id: 'heat', name: 'Heat', kind: KIND.TRANSFORM, output_material: 'BLANK' });
  const treat = makeProcess({
    id: 'treat', name: 'Treat', kind: KIND.TRANSFORM, output_material: 'BLANK',
    // §9 schema-impact documentation (static; no runtime effect).
    schema_impact: makeSchemaMatrix({
      process_id: 'treat',
      rows: [
        { system: 'MES', create: ['Treat_Batch'], read: ['Blank_Id'], update: ['Status'] },
        { system: 'WMS', read: ['Location'], update: ['Location'] },
        { system: 'SAP', update: ['WIP_Value'] },
      ],
    }),
  });
  const cool = makeProcess({ id: 'cool', name: 'Cool', kind: KIND.TRANSFORM, output_material: 'BLANK' });

  // One node per station; intake is a pure source, exit is a sink.
  const nIntake = makeTrackNode({ id: 'n_intake', type: NODE_TYPE.INTAKE, name: 'Intake' });
  const nA = makeTrackNode({ id: 'n_a', type: NODE_TYPE.STATION_INPUT, name: 'Station A node' });
  const nB = makeTrackNode({ id: 'n_b', type: NODE_TYPE.STATION_INPUT, name: 'Station B node' });
  const nC = makeTrackNode({ id: 'n_c', type: NODE_TYPE.STATION_INPUT, name: 'Station C node' });

  const sInA = makeTrackSegment({
    id: 's_in_a', from_node_id: 'n_intake', to_node_id: 'n_a',
    length_m: 10, capacity: 10,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: CONVEYOR_SPEED_M_PER_MIN },
  });
  const sAB = makeTrackSegment({
    id: 's_a_b', from_node_id: 'n_a', to_node_id: 'n_b',
    length_m: 20, capacity: 10,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: CONVEYOR_SPEED_M_PER_MIN },
  });
  const sBC = makeTrackSegment({
    id: 's_b_c', from_node_id: 'n_b', to_node_id: 'n_c',
    length_m: 15, capacity: 10,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: CONVEYOR_SPEED_M_PER_MIN },
  });
  const sCShip = makeTrackSegment({
    id: 's_c_ship', from_node_id: 'n_c', to_node_id: 'ship',
    length_m: 10, capacity: 10,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: CONVEYOR_SPEED_M_PER_MIN },
  });

  const stationA = makeStation({
    id: 'station_a', name: 'Station A (Heat)', node_id: 'n_a',
    processes: [{ process_id: 'heat', automation_level: 0, parallel_slots: 1, takt_seconds: 30, operators_per_slot: 1 }],
  });
  const stationB = makeStation({
    id: 'station_b', name: 'Station B (Treat)', node_id: 'n_b',
    processes: [{ process_id: 'treat', automation_level: 0, parallel_slots: 1, takt_seconds: 60, operators_per_slot: 1 }],
  });
  const stationC = makeStation({
    id: 'station_c', name: 'Station C (Cool)', node_id: 'n_c',
    processes: [{ process_id: 'cool', automation_level: 0, parallel_slots: 1, takt_seconds: 20, operators_per_slot: 1 }],
  });

  const shipExit = makeExitNode({ id: 'ship', kind: EXIT_KIND.SHIP, name: 'Shipping' });

  const shift = makeShift({
    id: 'day', name: 'Day Shift', duration_hours: 8,
    staffing: { station_a: { operator: 1 }, station_b: { operator: 1 }, station_c: { operator: 1 } },
  });

  const order1 = makeOrder({
    id: 'ORD1', material_type: 'BLANK', quantity: 3,
    process_sequence: ['heat', 'treat', 'cool'], arrival_time: 0,
  });

  return makeFactoryConfig({
    materials: [blank],
    processes: [heat, treat, cool],
    stations: [stationA, stationB, stationC],
    segments: [sInA, sAB, sBC, sCShip],
    nodes: [nIntake, nA, nB, nC],
    exits: [shipExit],
    carrierPools: [],
    shifts: [shift],
    orders: [order1],
  });
}
