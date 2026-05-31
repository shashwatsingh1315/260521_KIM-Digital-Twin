// assemblyLine fixture — assembly + inspection + scrap path.
//
// Topology (one node per station):
//   n_pcb_intake(INTAKE) --seg_pcb(10m)--> n_assem[Assembly: takt 45s, 2 slots]
//   n_casing_intake(INTAKE) --seg_casing(10m)--> n_assem
//   n_assem --seg_ai(20m)--> n_inspect[Inspect: takt 10s, 3 slots, pass_rate 0.9]
//   n_inspect --seg_ship(10m)--> ship(exit)
//   n_inspect --seg_scrap(5m)--> scrap(exit)
//
// 10 DEVICE units ordered; ~9 ship, ~1 scrapped.

import { makeMaterial } from '../domain/material.js';
import { makeProcess, KIND } from '../domain/process.js';
import { makeOrder } from '../domain/order.js';
import { makeShift } from '../domain/shift.js';
import { makeTrackNode, NODE_TYPE } from '../network/trackNode.js';
import { makeTrackSegment, TRANSPORT_MODE } from '../network/trackSegment.js';
import { makeStation } from '../network/station.js';
import { makeExitNode, EXIT_KIND } from '../network/exitNode.js';
import { makeFactoryConfig } from '../network/factoryConfig.js';

export const CONVEYOR_SPEED_M_PER_MIN = 60;

export function makeAssemblyLineFixture() {
  const pcb = makeMaterial({ id: 'PCB', properties: {}, allowed_processes: [] });
  const casing = makeMaterial({ id: 'CASING', properties: {}, allowed_processes: [] });
  const device = makeMaterial({ id: 'DEVICE', properties: {}, allowed_processes: ['inspect'] });

  const assembly = makeProcess({
    id: 'assemble', name: 'Assembly', kind: KIND.ASSEMBLY,
    output_material: 'DEVICE', bom: { PCB: 1, CASING: 1 },
  });
  const inspect = makeProcess({ id: 'inspect', name: 'Quality Check', kind: KIND.INSPECT, pass_rate: 0.9 });

  const nPcbIntake = makeTrackNode({ id: 'n_pcb_intake', type: NODE_TYPE.INTAKE, name: 'PCB Intake' });
  const nCasingIntake = makeTrackNode({ id: 'n_casing_intake', type: NODE_TYPE.INTAKE, name: 'Casing Intake' });
  const nAssem = makeTrackNode({ id: 'n_assem', type: NODE_TYPE.STATION_INPUT, name: 'Assembly node' });
  const nInspect = makeTrackNode({ id: 'n_inspect', type: NODE_TYPE.STATION_INPUT, name: 'Inspect node' });

  const segPcb = makeTrackSegment({
    id: 'seg_pcb', from_node_id: 'n_pcb_intake', to_node_id: 'n_assem',
    length_m: 10, capacity: 20,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: CONVEYOR_SPEED_M_PER_MIN },
  });
  const segCasing = makeTrackSegment({
    id: 'seg_casing', from_node_id: 'n_casing_intake', to_node_id: 'n_assem',
    length_m: 10, capacity: 20,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: CONVEYOR_SPEED_M_PER_MIN },
  });
  const segAI = makeTrackSegment({
    id: 'seg_ai', from_node_id: 'n_assem', to_node_id: 'n_inspect',
    length_m: 20, capacity: 10,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: CONVEYOR_SPEED_M_PER_MIN },
  });
  const segShip = makeTrackSegment({
    id: 'seg_ship', from_node_id: 'n_inspect', to_node_id: 'ship',
    length_m: 10, capacity: 10,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: CONVEYOR_SPEED_M_PER_MIN },
  });
  const segScrap = makeTrackSegment({
    id: 'seg_scrap', from_node_id: 'n_inspect', to_node_id: 'scrap',
    length_m: 5, capacity: 10,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: CONVEYOR_SPEED_M_PER_MIN },
  });

  const stationAssembly = makeStation({
    id: 'station_assem', name: 'Assembly Station', node_id: 'n_assem',
    entry_buffer_capacity: 20,
    processes: [{ process_id: 'assemble', automation_level: 0.7, parallel_slots: 2, takt_seconds: 45, operators_per_slot: 1 }],
  });
  const stationInspection = makeStation({
    id: 'station_inspect', name: 'Inspection Station', node_id: 'n_inspect',
    processes: [{ process_id: 'inspect', automation_level: 1.0, parallel_slots: 3, takt_seconds: 10, operators_per_slot: 0 }],
  });

  const shipExit = makeExitNode({ id: 'ship', kind: EXIT_KIND.SHIP, name: 'Shipping' });
  const scrapExit = makeExitNode({ id: 'scrap', kind: EXIT_KIND.SCRAP, name: 'Scrap' });

  const shift = makeShift({
    id: 'day', name: 'Day Shift', duration_hours: 8,
    staffing: { station_assem: { operator: 2 }, station_inspect: { operator: 0 } },
  });

  // Product order: 10 DEVICEs (born at assembly).
  const order1 = makeOrder({
    id: 'ORD1', material_type: 'DEVICE', quantity: 10,
    process_sequence: ['assemble', 'inspect'], arrival_time: 0,
  });
  // Component orders: one PCB and one CASING per DEVICE (fungible, consumed by assembly).
  const orderPcb = makeOrder({
    id: 'COMP_PCB', material_type: 'PCB', quantity: 10,
    process_sequence: ['assemble'], arrival_time: 0,
  });
  const orderCasing = makeOrder({
    id: 'COMP_CASING', material_type: 'CASING', quantity: 10,
    process_sequence: ['assemble'], arrival_time: 0,
  });

  return makeFactoryConfig({
    materials: [pcb, casing, device],
    processes: [assembly, inspect],
    stations: [stationAssembly, stationInspection],
    segments: [segPcb, segCasing, segAI, segShip, segScrap],
    nodes: [nPcbIntake, nCasingIntake, nAssem, nInspect],
    exits: [shipExit, scrapExit],
    carrierPools: [],
    shifts: [shift],
    orders: [order1, orderPcb, orderCasing],
  });
}
