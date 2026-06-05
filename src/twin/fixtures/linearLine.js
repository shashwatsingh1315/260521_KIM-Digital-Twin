// linearLine fixture — rewritten to reflect the complete M800 Value Stream
//
// This is a flattened, linear representation of the M800 factory flow 
// extracted from m800_model.js. It chains KMP (manufacturing) and WH (warehouse)
// into a single straight-line topology from Supplier to Customer.
//
// Distances and speeds are mathematically derived from m800_model.js travel times.
// Takt times are exactly matching the m800 process definitions.

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

export function makeLinearLineFixture() {
  // --- MATERIALS ---
  // Representing the primary state changes of the meter core
  const rawMat = makeMaterial({ id: 'M_RAW', properties: {}, allowed_processes: ['proc_iqc', 'proc_smt'] });
  const batteryMat = makeMaterial({ id: 'M_BATTERY', properties: {}, allowed_processes: ['proc_1p'] });
  const pcba = makeMaterial({ id: 'M_PCBA', properties: {}, allowed_processes: ['proc_fct', 'proc_1p'] });
  const sfg = makeMaterial({ id: 'M_SFG', properties: {}, allowed_processes: ['proc_sfg_pack', 'proc_vc'] });
  const fg = makeMaterial({ id: 'M_FG', properties: {}, allowed_processes: ['proc_pack', 'proc_fat'] });

  // --- PROCESSES ---
  // Takt times strictly derived from m800_model.js process definitions
  const procIqc = makeProcess({
    id: 'proc_iqc', name: 'GRN + IQC', kind: KIND.INSPECT, pass_rate: 1.0, // 900s
    schema_impact: makeSchemaMatrix({
      process_id: 'proc_iqc',
      rows: [
        { system: 'SAP', create: ['GRN_Number'], read: ['PO_Reference', 'Material_Code'] },
        { system: 'MES', read: ['Inspection_Plan'], create: ['IQC_Result'] },
        { system: 'WMS', update: ['Stock_Status'] },
      ],
    }),
  });
  const procSmt = makeProcess({ id: 'proc_smt', name: 'SMT + Wave', kind: KIND.TRANSFORM, output_material: 'M_PCBA' }); // 60s
  const procFct = makeProcess({ id: 'proc_fct', name: 'Intelligent FCT', kind: KIND.INSPECT, pass_rate: 1.0 }); // 10s
  const proc1p = makeProcess({ id: 'proc_1p', name: '1P Assembly', kind: KIND.ASSEMBLY, output_material: 'M_SFG', bom: { 'M_PCBA': 1, 'M_BATTERY': 1 } }); // 16.6s
  const procSfgPack = makeProcess({ id: 'proc_sfg_pack', name: 'SFG Pack', kind: KIND.TRANSFORM, output_material: 'M_SFG' }); // 15s
  const procAsrs = makeProcess({ id: 'proc_asrs', name: 'WIP Storage', kind: KIND.TRANSFORM, output_material: 'M_SFG' }); // ASRS storage
  const procVc = makeProcess({
    id: 'proc_vc', name: 'NIC+SIM+Seal', kind: KIND.TRANSFORM, output_material: 'M_FG', // 22.5s
    schema_impact: makeSchemaMatrix({
      process_id: 'proc_vc',
      rows: [
        { system: 'MES', create: ['Seal_Number', 'SIM_ID'], read: ['PCB_Number'], update: ['Status'] },
        { system: 'Noviga', create: ['Network_Profile'] },
      ],
    }),
  });
  const procPack = makeProcess({ id: 'proc_pack', name: 'Screen+Laser+Pack', kind: KIND.TRANSFORM, output_material: 'M_FG' }); // 30s+19s = 49s
  const procFat = makeProcess({
    id: 'proc_fat', name: 'PDI + FAT', kind: KIND.INSPECT, pass_rate: 1.0, // 600s
    schema_impact: makeSchemaMatrix({
      process_id: 'proc_fat',
      rows: [
        { system: 'SAP', update: ['Order_Status'] },
        { system: 'MES', create: ['FAT_Result'], update: ['Status'] },
        { system: 'Noviga', read: ['Device_Config'] },
      ],
    }),
  });

  // --- NODES ---
  const nSupplier = makeTrackNode({ id: 'n_supplier', type: NODE_TYPE.INTAKE, name: 'Supplier Gate' });
  const nBatterySup = makeTrackNode({ id: 'n_battery_sup', type: NODE_TYPE.INTAKE, name: 'Battery Intake' });
  const nJunction = makeTrackNode({ id: 'n_junction', type: NODE_TYPE.JUNCTION, name: 'Main Artery Start' });
  const nIqc = makeTrackNode({ id: 'n_iqc', type: NODE_TYPE.STATION_INPUT, name: 'IQC Area' });
  const nSmt = makeTrackNode({ id: 'n_smt', type: NODE_TYPE.STATION_INPUT, name: 'SMT Line' });
  const nFct = makeTrackNode({ id: 'n_fct', type: NODE_TYPE.STATION_INPUT, name: 'FCT Bench' });
  const n1p = makeTrackNode({ id: 'n_1p', type: NODE_TYPE.STATION_INPUT, name: '1P Assembly' });
  const nSfgPack = makeTrackNode({ id: 'n_sfg_pack', type: NODE_TYPE.STATION_INPUT, name: 'SFG Boxing' });
  const nAsrs = makeTrackNode({ id: 'n_asrs', type: NODE_TYPE.STATION_INPUT, name: 'WIP ASRS' });
  const nVc = makeTrackNode({ id: 'n_vc', type: NODE_TYPE.STATION_INPUT, name: 'Value Creation' });
  const nPack = makeTrackNode({ id: 'n_pack', type: NODE_TYPE.STATION_INPUT, name: 'Final Pack' });
  const nFat = makeTrackNode({ id: 'n_fat', type: NODE_TYPE.STATION_INPUT, name: 'FAT Lab' });
  const nCustomer = makeExitNode({ id: 'n_customer', kind: EXIT_KIND.SHIP, name: 'Customer' });
  const nScrap = makeExitNode({ id: 'n_scrap', kind: EXIT_KIND.SCRAP, name: 'Scrap Bin' });

  // --- SEGMENTS (Transport) ---
  // Helper to dynamically set conveyor speed based on m800 required distance and travel time
  const makeSeg = (id, from, to, dist_m, time_s) => {
    const speedMps = dist_m / (time_s || 1);
    return makeTrackSegment({
      id, from_node_id: from, to_node_id: to, length_m: dist_m, capacity: 50,
      transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: speedMps * 60 },
    });
  };

  // Aggregate distances/times from m800 paths
  const segSupJunc = makeSeg('seg_sup_junc', 'n_supplier', 'n_junction', 30, 5);
  // Batteries run on their own line straight to 1P assembly — they never enter the
  // KMP electronics line (IQC/SMT/FCT only process the meter core, not batteries).
  const segBatBypass = makeSeg('seg_bat_bypass', 'n_battery_sup', 'n_1p', 120, 24);
  // Shared artery with tiny capacity (5) to show backpressure!
  const segMainArtery = makeTrackSegment({
    id: 'seg_main_artery', from_node_id: 'n_junction', to_node_id: 'n_iqc', length_m: 1000, capacity: 5,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 1000 * 60 / 17 },
  });

  const segIqcSmt = makeSeg('seg_iqc_smt', 'n_iqc', 'n_smt', 50, 15); // Lifts + E-Store + VRC + Trolley to SMT
  const segSmtFct = makeSeg('seg_smt_fct', 'n_smt', 'n_fct', 5, 1);
  const segFct1p  = makeSeg('seg_fct_1p', 'n_fct', 'n_1p', 52, 15); // VRC to SF, TRSS area to BWIP to 1P
  const seg1pSfg  = makeSeg('seg_1p_sfg', 'n_1p', 'n_sfg_pack', 2, 1);
  const segSfgAsrs = makeSeg('seg_sfg_asrs', 'n_sfg_pack', 'n_asrs', 50, 10);
  const segAsrsVc = makeSeg('seg_asrs_vc', 'n_asrs', 'n_vc', 58, 13);
  const segVcPack = makeSeg('seg_vc_pack', 'n_vc', 'n_pack', 20, 4);
  const segPackFat = makeSeg('seg_pack_fat', 'n_pack', 'n_fat', 90, 19); // Pack -> FG ASRS -> FAT
  const segFatCust = makeSeg('seg_fat_cust', 'n_fat', 'n_customer', 2085, 47); // FAT -> Dispatch -> Customer
  const segScrap = makeSeg('seg_scrap', 'n_fat', 'n_scrap', 1, 1);

  // --- STATIONS ---
  // IQC is the slow line bottleneck (900s), so it sets the pull WIP cap. Give it
  // a large input buffer so the cap admits both the meter-core order and the
  // battery component order concurrently — otherwise the 1P assembly starves
  // (all WIP fills with PCBAs and no batteries are ever admitted to kit with).
  const stIqc = makeStation({ id: 'st_iqc', name: 'KMP IQC', node_id: 'n_iqc', entry_buffer_capacity: 50, processes: [{ process_id: 'proc_iqc', automation_level: 0, parallel_slots: 1, takt_seconds: 900, operators_per_slot: 1 }] });
  const stSmt = makeStation({ id: 'st_smt', name: 'SMT Line', node_id: 'n_smt', processes: [{ process_id: 'proc_smt', automation_level: 1, parallel_slots: 1, takt_seconds: 60, operators_per_slot: 2 }] });
  const stFct = makeStation({ id: 'st_fct', name: 'FCT Bench', node_id: 'n_fct', processes: [{ process_id: 'proc_fct', automation_level: 0, parallel_slots: 1, takt_seconds: 10, operators_per_slot: 1 }] });
  const st1p = makeStation({ id: 'st_1p', name: '1P Assembly', node_id: 'n_1p', entry_buffer_capacity: 50, processes: [{ process_id: 'proc_1p', automation_level: 0, parallel_slots: 18, takt_seconds: 16.6, operators_per_slot: 2 }] });
  const stSfgPack = makeStation({ id: 'st_sfg_pack', name: 'SFG Pack', node_id: 'n_sfg_pack', processes: [{ process_id: 'proc_sfg_pack', automation_level: 0, parallel_slots: 1, takt_seconds: 15, operators_per_slot: 2 }] });
  const stAsrs = makeStation({ id: 'st_asrs', name: 'ASRS', node_id: 'n_asrs', entry_buffer_capacity: 5000, processes: [{ process_id: 'proc_asrs', automation_level: 1, parallel_slots: 10, takt_seconds: 2, operators_per_slot: 0 }] });
  const stVc = makeStation({ id: 'st_vc', name: 'WH VC Assembly', node_id: 'n_vc', processes: [{ process_id: 'proc_vc', automation_level: 0, parallel_slots: 1, takt_seconds: 22.5, operators_per_slot: 1 }] });
  const stPack = makeStation({ id: 'st_pack', name: 'WH Auto Pack', node_id: 'n_pack', processes: [{ process_id: 'proc_pack', automation_level: 1, parallel_slots: 1, takt_seconds: 49, operators_per_slot: 1 }] });
  const stFat = makeStation({ id: 'st_fat', name: 'FAT Lab', node_id: 'n_fat', processes: [{ process_id: 'proc_fat', automation_level: 0, parallel_slots: 1, takt_seconds: 600, operators_per_slot: 1 }] });

  // --- SHIFTS & ORDERS ---
  const shift = makeShift({
    id: 'day', name: 'M800 Full Shift', duration_hours: 8,
    staffing: { st_iqc: { operator: 1 }, st_smt: { operator: 2 }, st_fct: { operator: 1 }, st_1p: { operator: 2 }, st_sfg_pack: { operator: 2 }, st_vc: { operator: 1 }, st_pack: { operator: 1 }, st_fat: { operator: 1 } },
  });

  const order1 = makeOrder({
    id: 'ORD-M800-DEMO', material_type: 'M_RAW', quantity: 20,
    process_sequence: ['proc_iqc', 'proc_smt', 'proc_fct', 'proc_1p', 'proc_sfg_pack', 'proc_asrs', 'proc_vc', 'proc_pack', 'proc_fat'], arrival_time: 0,
  });

  const orderBat = makeOrder({
    id: 'ORD-BATTERIES', material_type: 'M_BATTERY', quantity: 20,
    process_sequence: ['proc_1p'], arrival_time: 0,
  });

  const stations = [stIqc, stSmt, stFct, st1p, stSfgPack, stAsrs, stVc, stPack, stFat];
  const nodes = [nSupplier, nBatterySup, nJunction, nIqc, nSmt, nFct, n1p, nSfgPack, nAsrs, nVc, nPack, nFat];
  const overrides = {
    n_supplier:    { x: -50, y: 0, z: -60 }, // Outside west
    n_battery_sup: { x: -50, y: 0, z: -40 }, // Outside west
    n_junction:    { x: -35, y: 0, z: -50 }, // Inside KMP
    n_iqc:      { x: -30, y: 0, z: -20 }, // Inside KMP
    n_smt:      { x: -25, y: 0, z: -5 },  // Inside KMP
    n_fct:      { x: -20, y: 0, z: -5 },  // Inside KMP
    n_sfg_pack: { x: -15, y: 10, z: 10 }, // KMP East Edge (near bridge)
    n_asrs:     { x: 34.6,y: 0,  z: 0.1 }, // WH ASRS (Massive, centered)
    n_vc:       { x: 58,  y: 10, z: -10 }, // WH East Edge Strip
    n_pack:     { x: 58,  y: 0,  z: 0 },   // WH East Edge Strip
    n_fat:      { x: 58,  y: 0,  z: 15 },  // WH East Edge Strip
    n_customer: { x: 75,  y: 0,  z: 15 }, // Outside WH East
    n_scrap:    { x: -50, y: 0,  z: 0 },  // Outside KMP West
  };

  // Add 18 visual stations to render the massive parallel capacity in a perfect 3x6 grid
  for (let i = 1; i <= 18; i++) {
    const row = Math.floor((i - 1) / 6);
    const col = (i - 1) % 6;
    const pos = { x: -30 + col * 1.5, y: 10, z: 10 + row * 1.5 }; // Deep inside KMP 2nd floor

    if (i === 1) {
      // First station already exists in the static definitions
      overrides['n_1p'] = pos;
    } else {
      const sId = `st_1p_${i}`;
      const nId = `n_1p_${i}`;
      nodes.push(makeTrackNode({ id: nId, type: NODE_TYPE.STATION_INPUT, name: '1P Assembly' }));
      stations.push(makeStation({ id: sId, name: '1P Assembly', node_id: nId, processes: [] }));
      overrides[nId] = pos;
    }
  }

  return makeFactoryConfig({
    materials: [rawMat, batteryMat, pcba, sfg, fg],
    processes: [procIqc, procSmt, procFct, proc1p, procSfgPack, procAsrs, procVc, procPack, procFat],
    stations: stations,
    segments: [segSupJunc, segMainArtery, segBatBypass, segIqcSmt, segSmtFct, segFct1p, seg1pSfg, segSfgAsrs, segAsrsVc, segVcPack, segPackFat, segFatCust, segScrap],
    nodes: nodes,
    exits: [nCustomer, nScrap],
    carrierPools: [],
    shifts: [shift],
    orders: [order1, orderBat],
    layout_overrides: overrides,
  });
}
