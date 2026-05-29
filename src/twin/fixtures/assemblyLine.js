// assemblyLine fixture — assembly + inspection + scrap path.
//
// Intakes: PCB + CASING (fungible) → Assembly(bom {PCB:1,CASING:1}) → Inspect(90%) → ship/scrap
// Tests assembly with bill of materials, QC with pass_rate, and scrap routing.
// 10 units ordered; ~9 ship, ~1 scrapped.

import { makeMaterial } from '../domain/material.js';
import { makeProcess, KIND } from '../domain/process.js';
import { makeOrder } from '../domain/order.js';
import { makeShift } from '../domain/shift.js';
import { makeTrackNode, NODE_TYPE } from '../network/trackNode.js';
import { makeTrackSegment, TRANSPORT_MODE } from '../network/trackSegment.js';
import { makeStation } from '../network/station.js';
import { makeExitNode, EXIT_KIND } from '../network/exitNode.js';
import { makeFactoryConfig } from '../network/factoryConfig.js';

export function makeAssemblyLineFixture() {
  const pcb = makeMaterial({
    id: 'PCB',
    properties: {},
    allowed_processes: [],
  });

  const casing = makeMaterial({
    id: 'CASING',
    properties: {},
    allowed_processes: [],
  });

  const device = makeMaterial({
    id: 'DEVICE',
    properties: {},
    allowed_processes: ['inspect'],
  });

  const assembly = makeProcess({
    id: 'assemble',
    name: 'Assembly',
    kind: KIND.ASSEMBLY,
    output_material: 'DEVICE',
    bom: { PCB: 1, CASING: 1 },
  });

  const inspect = makeProcess({
    id: 'inspect',
    name: 'Quality Check',
    kind: KIND.INSPECT,
    pass_rate: 0.9,
  });

  const intakePcb = makeTrackNode({
    id: 'intake_pcb',
    type: NODE_TYPE.INTAKE,
    name: 'PCB Intake',
  });

  const intakeCasing = makeTrackNode({
    id: 'intake_casing',
    type: NODE_TYPE.INTAKE,
    name: 'Casing Intake',
  });

  const assemblyInput = makeTrackNode({
    id: 'assem_input',
    type: NODE_TYPE.BUFFER,
    name: 'Assembly Input',
  });

  const inspectInput = makeTrackNode({
    id: 'inspect_input',
    type: NODE_TYPE.BUFFER,
    name: 'Inspection Input',
  });

  const exitBuffer = makeTrackNode({
    id: 'exit_buf',
    type: NODE_TYPE.BUFFER,
    name: 'Final Buffer',
  });

  const segPcbToAssem = makeTrackSegment({
    id: 'seg_pcb_assem',
    from_node_id: 'intake_pcb',
    to_node_id: 'assem_input',
    length_m: 10,
    capacity: 10,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
  });

  const segCasingToAssem = makeTrackSegment({
    id: 'seg_casing_assem',
    from_node_id: 'intake_casing',
    to_node_id: 'assem_input',
    length_m: 10,
    capacity: 10,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
  });

  const segAssemToInspect = makeTrackSegment({
    id: 'seg_assem_inspect',
    from_node_id: 'assem_input',
    to_node_id: 'inspect_input',
    length_m: 20,
    capacity: 10,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
  });

  const segInspectToExit = makeTrackSegment({
    id: 'seg_inspect_exit',
    from_node_id: 'inspect_input',
    to_node_id: 'exit_buf',
    length_m: 10,
    capacity: 10,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 60 },
  });

  const stationAssembly = makeStation({
    id: 'station_assem',
    name: 'Assembly Station',
    processes: [
      {
        process_id: 'assemble',
        automation_level: 0.7,
        parallel_slots: 2,
        takt_seconds: 45,
        operators_per_slot: 1,
      },
    ],
  });

  const stationInspection = makeStation({
    id: 'station_inspect',
    name: 'Inspection Station',
    processes: [
      {
        process_id: 'inspect',
        automation_level: 1.0,
        parallel_slots: 3,
        takt_seconds: 10,
        operators_per_slot: 0,
      },
    ],
  });

  const shipExit = makeExitNode({
    id: 'ship',
    kind: EXIT_KIND.SHIP,
    name: 'Shipping',
  });

  const scrapExit = makeExitNode({
    id: 'scrap',
    kind: EXIT_KIND.SCRAP,
    name: 'Scrap',
  });

  const shift = makeShift({
    id: 'day',
    name: 'Day Shift',
    duration_hours: 8,
    staffing: {
      station_assem: { operator: 2 },
      station_inspect: { operator: 0 },
    },
  });

  const order1 = makeOrder({
    id: 'ORD1',
    material_type: 'DEVICE',
    quantity: 10,
    process_sequence: ['assemble', 'inspect'],
    arrival_time: 0,
  });

  return makeFactoryConfig({
    materials: [pcb, casing, device],
    processes: [assembly, inspect],
    stations: [stationAssembly, stationInspection],
    segments: [segPcbToAssem, segCasingToAssem, segAssemToInspect, segInspectToExit],
    nodes: [intakePcb, intakeCasing, assemblyInput, inspectInput, exitBuffer],
    exits: [shipExit, scrapExit],
    carrierPools: [],
    shifts: [shift],
    orders: [order1],
  });
}
