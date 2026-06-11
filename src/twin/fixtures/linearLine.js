// linearLine fixture — KORA M-800 End-to-End Value Stream
//
// Rewritten from the confirmed KORA M-800 End-to-End Product Lifecycle PDF
// (Rev 00, 06.05.2026, Process Owner: Mr. PraveenKumar N)
//
// Production target: 20,000 meters/day across 3 shifts (24h operation)
// Required effective takt: 28,800s ÷ 6,667 meters/shift ≈ 4.32s/meter
// Parallel slots at each station are scaled to clear this bottleneck.
//
// Sections mapped from PDF:
//   A  KMP Electronic Inbound (Steps 2–7)
//   B  KMP SMT Process GF A-Block (Steps 8–11)
//   C  KMP TRSS Sub-Assembly SF A-Block (Steps 12–15)
//   D  KMP Plastic/BOP + 1P Assembly SF B-Block (Steps 16–19)
//   E  KMP→WH SFG Movement via Ramp (Steps 19–20)
//   F  KMP Empty Bin Return (Steps 21–22)
//   G  WH Inbound — Plastic/SM/Screws/Relays (WH Steps 1–5)
//   H  WH ASRS Retrieval → KMP (WH Step 6)
//   I  WH Value Creation — NIC+SIM+Seal (WH Steps 8–9)
//   J  WH Automated Packaging + FG ASRS (WH Steps 10–12)
//   K  PDI/FAT + Dispatch (WH Steps 13–14)
//   L  WH→KMP Empty Bin Return (WH Step 14 empty route)

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

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. MATERIALS
  // ═══════════════════════════════════════════════════════════════════════════
  // Each material represents a distinct state of the product as it flows
  // through the factory.  allowed_processes gates which stations may accept it.

  // Electronics stream (KMP inbound → SMT → FCT)
  const rawMat = makeMaterial({ id: 'M_RAW', properties: { desc: 'Bare PCBs, SMD/THT, solder paste, flux' }, allowed_processes: ['proc_iqc', 'proc_smt'] });
  const pcba   = makeMaterial({ id: 'M_PCBA', properties: { desc: 'Assembled meter PCBA (post-SMT+AOI)' }, allowed_processes: ['proc_fct', 'proc_1p'] });

  // TRSS stream (WH ASRS → KMP SF A-Block → TRSS assembly)
  // Real BOM per TRSS: Relay ×1, Terminal Block ×1, Screws M4×12 ×8,
  //   Relay Shields (inner+outer) ×2, Brass Terminals ×4  = 16 child parts
  // Simplified here as one kit material; BOM detail in comment above.
  const trssParts = makeMaterial({ id: 'M_TRSS_PARTS', properties: { desc: 'TRSS child part kit (relay, TB, screws, shields, brass)' }, allowed_processes: ['proc_trss'] });
  const trss      = makeMaterial({ id: 'M_TRSS', properties: { desc: 'TRSS sub-assembly' }, allowed_processes: ['proc_1p'] });

  // Plastic / BOP stream (WH ASRS → Ramp → KMP SF B-Block)
  // Includes: Meter Base, Top Cover, Seal LH, Seal RH, Module Cover, Terminal Cover
  const plastic = makeMaterial({ id: 'M_PLASTIC', properties: { desc: 'Plastic/BOP kit (base, covers, seals)' }, allowed_processes: ['proc_1p'] });

  // SFG (post-1P assembly, pre-NIC)
  const sfg = makeMaterial({ id: 'M_SFG', properties: { desc: 'Semi-finished meter (10 mtrs/SFG bin, 25 bins/pallet = 250/pallet)' }, allowed_processes: ['proc_sfg_pack', 'proc_asrs', 'proc_vc'] });

  // NIC/SIM/Seal stream (WH stores → WH VC area)
  // NIC PCBA (AAX001-172-01), SIM Card, Module Cover (PPP001-328-00), Customer Seal
  const nicParts = makeMaterial({ id: 'M_NIC_PARTS', properties: { desc: 'NIC PCBA + SIM + Module Cover + Customer Seal kit' }, allowed_processes: ['proc_vc'] });

  // Post-VC through packaging
  const vcMeter = makeMaterial({ id: 'M_VC_METER', properties: { desc: 'Post-VC meter (NIC+SIM+Seal assembled)' }, allowed_processes: ['proc_screen', 'proc_enclosure', 'proc_pack'] });

  // Finished Good
  const fg = makeMaterial({ id: 'M_FG', properties: { desc: 'Packed FG meter (10 mtrs/carton, 25 cartons/pallet)' }, allowed_processes: ['proc_fat'] });


  // ═══════════════════════════════════════════════════════════════════════════
  // 2. PROCESSES
  // ═══════════════════════════════════════════════════════════════════════════
  // Takt times confirmed from PDF + floor answers (06.2026).
  // Where the PDF had [Fill] blanks, values are marked [APPROX].

  // ── Section A: KMP Electronic Inbound ──────────────────────────────────────
  const procIqc = makeProcess({
    id: 'proc_iqc', name: 'GRN + IQC (FR-QA-53)', kind: KIND.INSPECT, pass_rate: 1.0,
    // 900s per pallet of 1,280 pcs → 0.7s/unit equivalent.
    // Inspection: Dimensional + Visual + Functional per FR-QA-53.
    schema_impact: makeSchemaMatrix({
      process_id: 'proc_iqc',
      rows: [
        { system: 'SAP', create: ['GRN_Number'], read: ['PO_Reference', 'Material_Code'] },
        { system: 'MES', read: ['Inspection_Plan'], create: ['IQC_Result'] },
        { system: 'WMS', update: ['Stock_Status'] },
      ],
    }),
  });

  // ── Section B: KMP SMT + FCT ───────────────────────────────────────────────
  // SMT line is a pipeline: Solder Paste Printer (20s) → Pick & Place → Reflow (20s)
  // → AOI 100% (20s) → Wave Solder (20s).  Pipeline bottleneck = 20s/PCB.
  const procSmt = makeProcess({
    id: 'proc_smt', name: 'SMT + Wave + AOI (pipeline)', kind: KIND.TRANSFORM,
    output_material: 'M_PCBA',
    // 1 PCB enters while previous is at reflow — true pipeline.
    // Effective throughput per line: 1 PCB every 20s.
  });

  // FCT: 100% Intelligent Functional Test per PCBA.  Confirmed takt: 18s.
  const procFct = makeProcess({
    id: 'proc_fct', name: 'Intelligent FCT (100%)', kind: KIND.INSPECT, pass_rate: 1.0,
  });

  // ── Section C: KMP TRSS Sub-Assembly ───────────────────────────────────────
  // Relay + Terminal Block + 8 screws + 2 shields + 4 brass terminals → TRSS
  // Confirmed: 20.5s/TRSS, 1 operator/station, torque 0.5±0.03 Nm.
  const procTrss = makeProcess({
    id: 'proc_trss', name: 'TRSS Sub-Assembly', kind: KIND.TRANSFORM,
    output_material: 'M_TRSS',
    // Modelled as TRANSFORM (kit → sub-assy).  Real BOM in material comment.
  });

  // ── Section D: 1P Assembly + SPM ───────────────────────────────────────────
  // Sequential 4-stage line: P1 assembly (16.6s) → SPM 9 tests (20s) →
  //   Seal/chemical gluing (13s) → MES QC optical wire (19s).
  // Bottleneck per line = SPM at 20s.  18 parallel lines confirmed.
  const proc1p = makeProcess({
    id: 'proc_1p', name: '1P Assembly + SPM + Seal + MES QC', kind: KIND.ASSEMBLY,
    output_material: 'M_SFG',
    bom: { 'M_PCBA': 1, 'M_TRSS': 1, 'M_PLASTIC': 1 },
    // BOM detail: PCBA (FCT-pass) ×1, TRSS sub-assy ×1,
    //   Plastic kit (Meter Base + Top Cover + Seal LH + Seal RH + Module Cover) ×1
  });

  // ── Section E: SFG Boxing + WH ASRS ────────────────────────────────────────
  // 10 meters/SFG bin, 25 bins/pallet = 250 meters/pallet.
  const procSfgPack = makeProcess({
    id: 'proc_sfg_pack', name: 'SFG Boxing (10 mtrs/bin)', kind: KIND.TRANSFORM,
    output_material: 'M_SFG',
  });

  // WH ASRS: automated crane put-away / retrieval.  Multiple cranes confirmed.
  const procAsrs = makeProcess({
    id: 'proc_asrs', name: 'WH ASRS Storage', kind: KIND.TRANSFORM,
    output_material: 'M_SFG',
  });

  // ── Section I: WH Value Creation ───────────────────────────────────────────
  // NIC PCBA + SIM Card + Module Cover + Customer Seal (1 type for now).
  // Confirmed: 22.5s/meter, 1 operator.  2 lines (FF Line A + SF Line B),
  // scaled to 6 total to meet 20k/day.
  const procVc = makeProcess({
    id: 'proc_vc', name: 'NIC + SIM + Seal Assembly', kind: KIND.ASSEMBLY,
    output_material: 'M_VC_METER',
    bom: { 'M_SFG': 1, 'M_NIC_PARTS': 1 },
    schema_impact: makeSchemaMatrix({
      process_id: 'proc_vc',
      rows: [
        { system: 'MES', create: ['Seal_Number', 'SIM_ID', 'NIC_Sync_Result'], read: ['PCB_Number'], update: ['Status'] },
        { system: 'Noviga', create: ['Network_Profile'] },
      ],
    }),
  });

  // ── Section J: WH Automated Packaging ──────────────────────────────────────
  // Screening (10s) → Laser Print (10s) → Hologram Pasting (10s) — pipeline,
  //   effective throughput = 10s/meter per line.
  // Note: J-01 and J-02 in PDF were a duplication error — 1 line, not 2.
  const procScreen = makeProcess({
    id: 'proc_screen', name: 'Screening + Laser + Hologram (pipeline)', kind: KIND.INSPECT,
    pass_rate: 1.0,
    // Quality gates: Accuracy per GTP, NIC comm OK, Memory=Print serial,
    //   Hologram QR linked in MES.
  });

  // Robotic Enclosure fitment (auto, 1s) + Wall-E auto-pack.
  const procEnclosure = makeProcess({
    id: 'proc_enclosure', name: 'Robotic Enclosure + Wall-E', kind: KIND.TRANSFORM,
    output_material: 'M_VC_METER',
    // Terminal Cover + Enclosure assy + Accessory kit — all automated.
  });

  // Carton packing: 10 meters/carton, confirmed 19s/meter.
  const procPack = makeProcess({
    id: 'proc_pack', name: 'Carton Packing (10 mtrs/carton)', kind: KIND.TRANSFORM,
    output_material: 'M_FG',
    // SAP FG creation per carton; MES factory file per carton.
  });

  // ── Section K: PDI + FAT ───────────────────────────────────────────────────
  // Sample-based: n=32 per lot (1 lot ≈ 1 pallet = 250 meters).
  // FAT ≈ 600s for 32 samples → per-unit equivalent ≈ 600/250 = 2.4s.
  // Route: WH GF ASRS → WH SF (lift) → KMP SF (ramp) → KMP 3F (stair).
  // Fail disposition: SCRAP.
  const procFat = makeProcess({
    id: 'proc_fat', name: 'PDI + FAT (n=32/lot)', kind: KIND.INSPECT, pass_rate: 1.0,
    schema_impact: makeSchemaMatrix({
      process_id: 'proc_fat',
      rows: [
        { system: 'SAP', update: ['Order_Status', 'QA_Lot_Release'] },
        { system: 'MES', create: ['FAT_Result', 'Firmware_Record'], update: ['Status'] },
        { system: 'Noviga', read: ['Device_Config'] },
      ],
    }),
  });


  // ═══════════════════════════════════════════════════════════════════════════
  // 3. NETWORK NODES
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Intakes ────────────────────────────────────────────────────────────────
  const nSupplier      = makeTrackNode({ id: 'n_supplier',       type: NODE_TYPE.INTAKE, name: 'KMP Main Gate (Electronics)' });
  const nTrssIntake    = makeTrackNode({ id: 'n_trss_intake',    type: NODE_TYPE.INTAKE, name: 'TRSS Parts (WH ASRS → Ramp → KMP SF A-Block)' });
  const nPlasticIntake = makeTrackNode({ id: 'n_plastic_intake', type: NODE_TYPE.INTAKE, name: 'Plastic/BOP (WH ASRS → Ramp → KMP SF B-Block)' });
  const nNicIntake     = makeTrackNode({ id: 'n_nic_intake',     type: NODE_TYPE.INTAKE, name: 'NIC/SIM/ModCover/Seal (WH Stores)' });

  // ── KMP GF (A-Block) ──────────────────────────────────────────────────────
  const nJunction = makeTrackNode({ id: 'n_junction', type: NODE_TYPE.JUNCTION, name: 'KMP GF Main Artery' });
  const nIqc      = makeTrackNode({ id: 'n_iqc',      type: NODE_TYPE.STATION_INPUT, name: 'KMP GF — GRN + IQC' });
  const nSmt      = makeTrackNode({ id: 'n_smt',      type: NODE_TYPE.STATION_INPUT, name: 'KMP GF — SMT Lines (A-Block)' });
  const nFct      = makeTrackNode({ id: 'n_fct',      type: NODE_TYPE.STATION_INPUT, name: 'KMP GF — FCT Benches (A-Block)' });

  // ── KMP SF A-Block (2nd Floor) — TRSS Assembly ─────────────────────────────
  const nTrss = makeTrackNode({ id: 'n_trss', type: NODE_TYPE.STATION_INPUT, name: 'KMP SF — TRSS Assembly (A-Block)' });

  // ── KMP SF B-Block (2nd Floor) — 1P Assembly ──────────────────────────────
  const n1p      = makeTrackNode({ id: 'n_1p',       type: NODE_TYPE.STATION_INPUT, name: 'KMP SF — 1P Assembly + SPM (B-Block)' });
  const nSfgPack = makeTrackNode({ id: 'n_sfg_pack', type: NODE_TYPE.STATION_INPUT, name: 'KMP SF — SFG Boxing (B-Block)' });

  // ── WH GF — ASRS + Value Creation + Packaging ────────────────────────────
  const nAsrs      = makeTrackNode({ id: 'n_asrs',      type: NODE_TYPE.STATION_INPUT, name: 'WH GF — ASRS (SFG + FG)' });
  const nVc        = makeTrackNode({ id: 'n_vc',        type: NODE_TYPE.STATION_INPUT, name: 'WH — Value Creation (NIC+SIM+Seal)' });
  const nScreen    = makeTrackNode({ id: 'n_screen',    type: NODE_TYPE.STATION_INPUT, name: 'WH GF — Screening + Laser + Hologram' });
  const nEnclosure = makeTrackNode({ id: 'n_enclosure', type: NODE_TYPE.STATION_INPUT, name: 'WH GF — Robotic Enclosure + Wall-E' });
  const nPack      = makeTrackNode({ id: 'n_pack',      type: NODE_TYPE.STATION_INPUT, name: 'WH GF — Carton Packing' });

  // ── KMP 3F — FAT Lab ──────────────────────────────────────────────────────
  const nFat = makeTrackNode({ id: 'n_fat', type: NODE_TYPE.STATION_INPUT, name: 'KMP 3F — FAT Lab' });

  // ── Exits ──────────────────────────────────────────────────────────────────
  const nCustomer = makeExitNode({ id: 'n_customer', kind: EXIT_KIND.SHIP, name: 'Customer (Dispatch)' });
  const nScrap    = makeExitNode({ id: 'n_scrap',    kind: EXIT_KIND.SCRAP, name: 'Scrap Bin' });


  // ═══════════════════════════════════════════════════════════════════════════
  // 4. TRACK SEGMENTS (Transport Links)
  // ═══════════════════════════════════════════════════════════════════════════

  const makeSeg = (id, from, to, dist_m, time_s, cap) => {
    const speedMps = dist_m / (time_s || 1);
    return makeTrackSegment({
      id, from_node_id: from, to_node_id: to, length_m: dist_m, capacity: cap || 50,
      transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: speedMps * 60 },
    });
  };

  // ── Main electronics chain (Supplier → IQC → SMT → FCT → 1P) ─────────────
  // Supplier truck → KMP Main Gate → Dock-3
  const segSupJunc = makeSeg('seg_sup_junc', 'n_supplier', 'n_junction', 50, 5);
  // Gate → IQC: Dock-3 staging → IQC hold (HPT, GF A-Block)
  const segMainArtery = makeTrackSegment({
    id: 'seg_main_artery', from_node_id: 'n_junction', to_node_id: 'n_iqc',
    length_m: 10, capacity: 10,
    transport: { class: 'passive', mode: TRANSPORT_MODE.CONVEYOR, speed_m_per_min: 10 * 60 / 2 },
  });
  // IQC → SMT: IQC hold → Lift GF→FF (3s) → E-Store → VRC FF→GF (3s) → SMT line
  const segIqcSmt = makeSeg('seg_iqc_smt', 'n_iqc', 'n_smt', 50, 15);
  // SMT → FCT: bin trolley (GF A-Block, short distance)
  const segSmtFct = makeSeg('seg_smt_fct', 'n_smt', 'n_fct', 5, 1);
  // FCT → 1P: VRC GF→SF (6s) + trolley through TRSS area to B-Block WIP
  const segFct1p = makeSeg('seg_fct_1p', 'n_fct', 'n_1p', 52, 15);

  // ── TRSS stream (WH ASRS → Ramp → KMP SF A-Block → TRSS → B-Block 1P) ───
  // WH ASRS retrieval + Ramp WH SF→KMP SF + stacker to A-Block [APPROX 15s]
  const segTrssIn = makeSeg('seg_trss_in', 'n_trss_intake', 'n_trss', 80, 15);
  // TRSS A-Block → 1P B-Block: trolley through SF 2F corridor (confirmed 1 min)
  const segTrss1p = makeSeg('seg_trss_1p', 'n_trss', 'n_1p', 15, 60);

  // ── Plastic/BOP stream (WH ASRS → Ramp → KMP SF B-Block WIP) ─────────────
  // ASRS crane + stacker + Ramp (bidirectional) + stacker at KMP SF [APPROX 15s]
  const segPlastic1p = makeSeg('seg_plastic_1p', 'n_plastic_intake', 'n_1p', 80, 15);

  // ── Post-1P chain (1P → SFG Pack → WH ASRS → VC → Packaging → FAT) ──────
  // 1P output → SFG boxing (in-station, SF B-Block)
  const seg1pSfg = makeSeg('seg_1p_sfg', 'n_1p', 'n_sfg_pack', 2, 1);
  // SFG pallet: KMP SF B-Block → Ramp → WH SF → WH Lift SF→GF → ASRS put-away
  // Total ≈ 8 min [APPROX]: Ramp 3min + Lift 2min + ASRS 3min
  const segSfgAsrs = makeSeg('seg_sfg_asrs', 'n_sfg_pack', 'n_asrs', 90, 480);
  // ASRS retrieval → VC area (WH GF internal, stacker) [APPROX 5s]
  const segAsrsVc = makeSeg('seg_asrs_vc', 'n_asrs', 'n_vc', 18, 5);

  // ── NIC/SIM stream (WH stores → VC station) ──────────────────────────────
  const segNicVc = makeSeg('seg_nic_vc', 'n_nic_intake', 'n_vc', 20, 5);

  // ── Post-VC packaging chain ────────────────────────────────────────────────
  // VC → Screening+Laser+Hologram (MTO gated, order-based E-Kanban pull)
  const segVcScreen = makeSeg('seg_vc_screen', 'n_vc', 'n_screen', 20, 4);
  // Screening → Robotic Enclosure (in-line, WH GF)
  const segScreenEnc = makeSeg('seg_screen_enc', 'n_screen', 'n_enclosure', 5, 1);
  // Enclosure → Carton Packing (in-line, WH GF)
  const segEncPack = makeSeg('seg_enc_pack', 'n_enclosure', 'n_pack', 5, 1);
  // Carton Pack → FG ASRS → FAT Lab (KMP 3F)
  // Route: WH GF pack output → ASRS FG put-away → ASRS retrieval →
  //   WH Lift GF→SF → Ramp WH SF→KMP SF → KMP stair SF→3F → FAT Lab
  const segPackFat = makeSeg('seg_pack_fat', 'n_pack', 'n_fat', 160, 30);
  // FAT Lab → Dispatch staging → Covered truck → Customer
  const segFatCust = makeSeg('seg_fat_cust', 'n_fat', 'n_customer', 2085, 47);
  // FAT fail → Scrap
  const segScrap = makeSeg('seg_scrap', 'n_fat', 'n_scrap', 1, 1);


  // ═══════════════════════════════════════════════════════════════════════════
  // 5. STATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  // Parallel slots are calculated to exceed 20,000 meters/day (eff. takt ≤ 4.32s).
  //
  // ┌────────────────────┬──────────┬───────┬──────────┬──────────┬───────────┐
  // │ Station            │ Takt (s) │ Slots │ Eff.Takt │ /shift   │ Status    │
  // ├────────────────────┼──────────┼───────┼──────────┼──────────┼───────────┤
  // │ IQC                │    0.7   │   1   │   0.70   │ 41,143   │ ✅ OK     │
  // │ SMT Lines          │   20.0   │   5   │   4.00   │  7,200   │ ✅ OK     │
  // │ FCT Benches        │   18.0   │   5   │   3.60   │  8,000   │ ✅ OK     │
  // │ TRSS Assembly      │   20.5   │   5   │   4.10   │  7,024   │ ✅ OK     │
  // │ 1P Assembly + SPM  │   20.0   │  18   │   1.11   │ 25,946   │ ✅ OK     │
  // │ SFG Packing        │   15.0   │   4   │   3.75   │  7,680   │ ✅ OK     │
  // │ ASRS (auto cranes) │    2.0   │  10   │   0.20   │ 144,000  │ ✅ OK     │
  // │ VC (NIC+SIM+Seal)  │   22.5   │   6   │   3.75   │  7,680   │ ✅ OK     │
  // │ Screen+Laser+Holo  │   10.0   │   3   │   3.33   │  8,640   │ ✅ OK     │
  // │ Enclosure (robotic)│    1.0   │   1   │   1.00   │ 28,800   │ ✅ OK     │
  // │ Carton Packing     │   19.0   │   5   │   3.80   │  7,579   │ ✅ OK     │
  // │ FAT (sample n=32)  │    2.4   │   1   │   2.40   │ 12,000   │ ✅ OK     │
  // └────────────────────┴──────────┴───────┴──────────┴──────────┴───────────┘

  // ── Section A: IQC ─────────────────────────────────────────────────────────
  // 900s per pallet (1,280 pcs) = 0.7s per unit.  1 QA engineer.
  const stIqc = makeStation({
    id: 'st_iqc', name: 'KMP IQC (GRN + FR-QA-53)', node_id: 'n_iqc',
    processes: [{
      process_id: 'proc_iqc', automation_level: 0,
      parallel_slots: 1, takt_seconds: 0.7, operators_per_slot: 1,
    }],
  });

  // ── Section B: SMT Lines ───────────────────────────────────────────────────
  // Pipeline: Paste(20s)→Reflow(20s)→AOI(20s)→Wave(20s).  Bottleneck = 20s/PCB.
  // 5 parallel lines to meet target.  2 operators per line.
  const stSmt = makeStation({
    id: 'st_smt', name: 'SMT Lines ×5 (GF A-Block)', node_id: 'n_smt',
    processes: [{
      process_id: 'proc_smt', automation_level: 1,
      parallel_slots: 5, takt_seconds: 20, operators_per_slot: 2,
    }],
  });

  // ── Section B: FCT Benches ─────────────────────────────────────────────────
  // Confirmed: 18s per PCBA.  100% test.  5 parallel benches.
  const stFct = makeStation({
    id: 'st_fct', name: 'FCT Benches ×5 (GF A-Block)', node_id: 'n_fct',
    processes: [{
      process_id: 'proc_fct', automation_level: 0,
      parallel_slots: 5, takt_seconds: 18, operators_per_slot: 1,
    }],
  });

  // ── Section C: TRSS Sub-Assembly ───────────────────────────────────────────
  // 20.5s/TRSS, 1 operator each.  5 stations needed (20.5 / 4.32 = 4.75).
  // 10 TRSS per tray output.  Torque 0.5±0.03 Nm check per unit.
  const stTrss = makeStation({
    id: 'st_trss', name: 'TRSS Assembly ×5 (SF A-Block)', node_id: 'n_trss',
    processes: [{
      process_id: 'proc_trss', automation_level: 0,
      parallel_slots: 5, takt_seconds: 20.5, operators_per_slot: 1,
    }],
  });

  // ── Section D: 1P Assembly + SPM ───────────────────────────────────────────
  // 18 parallel lines (confirmed).  Each line is sequential:
  //   P1 (16.6s) → SPM (20s) → Seal (13s) → MES QC (19s).
  // Bottleneck per line = SPM at 20s.  2 operators per line.
  // Entry buffer = 100 (2-bin Kanban: TRSS 30/bin, Base 64/bin, Cover 36/bin, Seal 500/bin).
  const st1p = makeStation({
    id: 'st_1p', name: '1P Assembly + SPM ×18 (SF B-Block)', node_id: 'n_1p',
    entry_buffer_capacity: 100,
    processes: [{
      process_id: 'proc_1p', automation_level: 0,
      parallel_slots: 18, takt_seconds: 20, operators_per_slot: 2,
    }],
  });

  // ── Section E: SFG Boxing ──────────────────────────────────────────────────
  // 10 mtrs/bin, manual scan.  15s confirmed.  4 stations needed.
  const stSfgPack = makeStation({
    id: 'st_sfg_pack', name: 'SFG Packing ×4 (SF B-Block)', node_id: 'n_sfg_pack',
    processes: [{
      process_id: 'proc_sfg_pack', automation_level: 0,
      parallel_slots: 4, takt_seconds: 15, operators_per_slot: 2,
    }],
  });

  // ── WH ASRS ────────────────────────────────────────────────────────────────
  // Multiple cranes/shuttles (confirmed).  2s per put-away/retrieval cycle.
  // Handles both SFG (from KMP) and FG (from packaging).
  const stAsrs = makeStation({
    id: 'st_asrs', name: 'WH ASRS (multi-crane)', node_id: 'n_asrs',
    entry_buffer_capacity: 5000,
    processes: [{
      process_id: 'proc_asrs', automation_level: 1,
      parallel_slots: 10, takt_seconds: 2, operators_per_slot: 0,
    }],
  });

  // ── Section I: Value Creation (NIC + SIM + Seal) ───────────────────────────
  // 22.5s/meter confirmed, 1 operator each.  6 lines needed (22.5/4.32 = 5.2).
  // Original 2 lines (FF Line A + SF Line B) scaled to 6.
  // MTO gating: order-based E-Kanban pull.  1 seal variant for now.
  const stVc = makeStation({
    id: 'st_vc', name: 'WH VC Assembly ×6', node_id: 'n_vc',
    processes: [{
      process_id: 'proc_vc', automation_level: 0,
      parallel_slots: 6, takt_seconds: 22.5, operators_per_slot: 1,
    }],
  });

  // ── Section J: Screening + Laser + Hologram ────────────────────────────────
  // 3-machine pipeline: 10s each.  Effective throughput = 10s/meter per line.
  // 3 parallel lines needed (10/4.32 = 2.31).  Fully automated.
  const stScreen = makeStation({
    id: 'st_screen', name: 'Screen+Laser+Holo ×3 (WH GF)', node_id: 'n_screen',
    processes: [{
      process_id: 'proc_screen', automation_level: 1,
      parallel_slots: 3, takt_seconds: 10, operators_per_slot: 0,
    }],
  });

  // ── Section J: Robotic Enclosure + Wall-E ──────────────────────────────────
  // 1s/meter (confirmed).  Fully automated.  1 line is sufficient.
  const stEnclosure = makeStation({
    id: 'st_enclosure', name: 'Robotic Enclosure + Wall-E (WH GF)', node_id: 'n_enclosure',
    processes: [{
      process_id: 'proc_enclosure', automation_level: 1,
      parallel_slots: 1, takt_seconds: 1, operators_per_slot: 0,
    }],
  });

  // ── Section J: Carton Packing ──────────────────────────────────────────────
  // 19s/meter confirmed.  10 mtrs/carton.  5 lines needed (19/4.32 = 4.40).
  const stPack = makeStation({
    id: 'st_pack', name: 'Carton Packing ×5 (WH GF)', node_id: 'n_pack',
    processes: [{
      process_id: 'proc_pack', automation_level: 1,
      parallel_slots: 5, takt_seconds: 19, operators_per_slot: 1,
    }],
  });

  // ── Section K: FAT Lab ─────────────────────────────────────────────────────
  // Sample-based: n=32 per lot (1 lot = 1 pallet = 250 meters).
  // Total FAT ≈ 600s per 32 samples → per-unit equivalent = 600/250 = 2.4s.
  // Located at KMP 3F.  FAT fail → SCRAP.
  const stFat = makeStation({
    id: 'st_fat', name: 'FAT Lab (KMP 3F, n=32/lot)', node_id: 'n_fat',
    processes: [{
      process_id: 'proc_fat', automation_level: 0,
      parallel_slots: 1, takt_seconds: 2.4, operators_per_slot: 1,
    }],
  });


  // ═══════════════════════════════════════════════════════════════════════════
  // 6. SHIFTS — 3 shifts × 8h = 24h operation
  // ═══════════════════════════════════════════════════════════════════════════

  const staffing = {
    st_iqc:       { operator: 1 },
    st_smt:       { operator: 10 },  // 5 lines × 2 operators
    st_fct:       { operator: 5 },   // 5 benches × 1
    st_trss:      { operator: 5 },   // 5 stations × 1
    st_1p:        { operator: 36 },  // 18 lines × 2
    st_sfg_pack:  { operator: 8 },   // 4 stations × 2
    st_asrs:      { operator: 0 },   // fully automated
    st_vc:        { operator: 6 },   // 6 lines × 1
    st_screen:    { operator: 0 },   // fully automated
    st_enclosure: { operator: 0 },   // fully automated
    st_pack:      { operator: 5 },   // 5 lines × 1
    st_fat:       { operator: 1 },
  };
  // Total operators per shift: 1+10+5+5+36+8+0+6+0+0+5+1 = 77

  const shiftDay = makeShift({
    id: 'shift_day', name: 'Day Shift (06:00–14:00)', duration_hours: 8, staffing,
  });
  const shiftEvening = makeShift({
    id: 'shift_evening', name: 'Evening Shift (14:00–22:00)', duration_hours: 8, staffing,
  });
  const shiftNight = makeShift({
    id: 'shift_night', name: 'Night Shift (22:00–06:00)', duration_hours: 8, staffing,
  });


  // ═══════════════════════════════════════════════════════════════════════════
  // 7. ORDERS
  // ═══════════════════════════════════════════════════════════════════════════
  // 250 meters (1 pallet) as simulation batch.
  // Daily target: 20,000 meters = 80 pallets across 3 shifts.
  //
  // Four concurrent orders model the converging material streams:
  //   1. Main (electronics): full E2E sequence — drives the output unit.
  //   2. TRSS parts: assembled into TRSS, then consumed at 1P.
  //   3. Plastic/BOP: consumed directly at 1P.
  //   4. NIC/SIM parts: consumed at VC.

  const orderMain = makeOrder({
    id: 'ORD-M800-MAIN', material_type: 'M_RAW', quantity: 250,
    process_sequence: [
      'proc_iqc',        // A: GRN + IQC at KMP GF
      'proc_smt',        // B: SMT + Wave + AOI at KMP GF
      'proc_fct',        // B: Intelligent FCT at KMP GF
      'proc_1p',         // D: 1P Assembly + SPM at KMP SF B-Block
      'proc_sfg_pack',   // E: SFG Boxing at KMP SF B-Block
      'proc_asrs',       // E: WH ASRS put-away
      'proc_vc',         // I: NIC+SIM+Seal at WH VC
      'proc_screen',     // J: Screening+Laser+Hologram at WH GF
      'proc_enclosure',  // J: Robotic Enclosure + Wall-E at WH GF
      'proc_pack',       // J: Carton Packing at WH GF
      'proc_fat',        // K: PDI + FAT at KMP 3F
    ],
    arrival_time: 0,
  });

  // TRSS child parts: relay, TB, screws, shields, brass terminals.
  // Assembled into M_TRSS at proc_trss (SF A-Block), then consumed at proc_1p.
  const orderTrss = makeOrder({
    id: 'ORD-TRSS-PARTS', material_type: 'M_TRSS_PARTS', quantity: 250,
    process_sequence: ['proc_trss', 'proc_1p'],
    arrival_time: 0,
  });

  // Plastic/BOP: Meter Base, Top Cover, Seals, Module Cover, Terminal Cover.
  // Arrives from WH ASRS via Ramp.  Consumed directly at proc_1p.
  const orderPlastic = makeOrder({
    id: 'ORD-PLASTIC-BOP', material_type: 'M_PLASTIC', quantity: 250,
    process_sequence: ['proc_1p'],
    arrival_time: 0,
  });

  // NIC PCBA + SIM Card + Module Cover + Customer Seal.
  // Consumed at proc_vc in WH Value Creation.
  const orderNic = makeOrder({
    id: 'ORD-NIC-SIM-PARTS', material_type: 'M_NIC_PARTS', quantity: 250,
    process_sequence: ['proc_vc'],
    arrival_time: 0,
  });


  // ═══════════════════════════════════════════════════════════════════════════
  // 8. ASSEMBLY — collect arrays + layout overrides
  // ═══════════════════════════════════════════════════════════════════════════

  const stations = [
    stIqc, stSmt, stFct, stTrss, st1p, stSfgPack,
    stAsrs, stVc, stScreen, stEnclosure, stPack, stFat,
  ];

  const nodes = [
    nSupplier, nTrssIntake, nPlasticIntake, nNicIntake,
    nJunction, nIqc, nSmt, nFct, nTrss,
    n1p, nSfgPack,
    nAsrs, nVc, nScreen, nEnclosure, nPack, nFat,
  ];

  const segments = [
    // Main electronics chain
    segSupJunc, segMainArtery, segIqcSmt, segSmtFct, segFct1p,
    // TRSS stream
    segTrssIn, segTrss1p,
    // Plastic stream
    segPlastic1p,
    // Post-1P → WH
    seg1pSfg, segSfgAsrs, segAsrsVc,
    // NIC stream
    segNicVc,
    // Post-VC packaging chain
    segVcScreen, segScreenEnc, segEncPack, segPackFat,
    // Exits
    segFatCust, segScrap,
  ];

  // ── 3D Layout Overrides ────────────────────────────────────────────────────
  // KMP is on the left (negative X), WH on the right (positive X).
  // Y = floor level (0 = GF, 5 = FF, 10 = SF/2F, 15 = 3F).
  //
  //   KMP Building (x: -42.5 to -9)          gap        WH Building (x: 9 to 67.5)
  //   ┌─────────────────────────────┐  ┌───bridge───┐  ┌──────────────────────────┐
  //   │ GF(y=0):                    │  │  (y=10)    │  │ GF(y=0):                 │
  //   │   z=-60 Supplier Gate       │  │            │  │   x=26 ASRS (left half)  │
  //   │   z=-50 Junction            │  │            │  │   x=48 Screen ×3         │
  //   │   z=-35 IQC                 │  │            │  │   x=54 Enclosure         │
  //   │   z=-18 SMT ×5             │  │            │  │   x=60 Pack ×5           │
  //   │   z=-5  FCT ×5             │  │            │  │                          │
  //   │                             │  │            │  │ FF(y=5): VC Line A ×3    │
  //   │ SF(y=10):                   │  │            │  │ SF(y=10): VC Line B ×3   │
  //   │   z=2   TRSS ×5 (A-Block)  │──┤  z≈18      │  │                          │
  //   │   z=8-16 1P ×18 (B-Block)  │  │            │  │                          │
  //   │   z=22  SFG Pack ×4        │──┘            │  │                          │
  //   │                             │               │  │                          │
  //   │ 3F(y=15):                   │               │  │                          │
  //   │   z=10  FAT Lab             │               │  │                          │
  //   └─────────────────────────────┘               └──┘──────────────────────────┘
  //
  // ASRS mesh is 32.9×50.6 scene units (after 1.6x scale). Centered at x=26
  // keeps it inside WH walls (extends x=9.55..42.45 vs WH x=9..67.5).
  //
  // Material flow: KMP GF → lift → KMP SF (sub-assy) → ramp/bridge → WH GF
  //   ASRS → lift → WH FF/SF (VC) → lift → WH GF (packaging) →
  //   FG ASRS → ramp → KMP 3F FAT → dispatch

  const overrides = {
    // ── Intakes ──────────────────────────────────────────────────────────────
    n_supplier:       { x: -50, y: 0,  z: -60 },    // Outside KMP south gate
    n_trss_intake:    { x: 5,   y: 10, z: 18 },     // SF bridge area (WH→KMP ramp)
    n_plastic_intake: { x: 5,   y: 10, z: 20 },     // SF bridge area
    n_nic_intake:     { x: 48,  y: 0,  z: 20 },     // WH stores (near VC lift)

    // ── KMP GF (A-Block) — Electronics Inbound ──────────────────────────────
    n_junction:       { x: -26, y: 0,  z: -50 },
    n_iqc:            { x: -26, y: 0,  z: -35 },

    // ── WH GF — ASRS (left half of warehouse) ──────────────────────────────
    // ASRS at x=26 → extends x=[9.55, 42.45] — fully inside WH (x=9..67.5)
    n_asrs:           { x: 26,  y: 0,  z: 0 },

    // ── WH GF — Packaging (right half of warehouse) ─────────────────────────
    n_enclosure:      { x: 54,  y: 0,  z: 0 },

    // ── KMP 3F — FAT Lab ────────────────────────────────────────────────────
    n_fat:            { x: -26, y: 15, z: 10 },

    // ── Exits ────────────────────────────────────────────────────────────────
    n_customer:       { x: 72,  y: 0,  z: 0 },      // Outside WH east dock
    n_scrap:          { x: -50, y: 0,  z: -35 },
  };

  // ── 5 visual SMT Lines (KMP GF A-Block, spread across building width) ───
  for (let i = 1; i <= 5; i++) {
    const pos = { x: -38 + (i - 1) * 6, y: 0, z: -18 };
    if (i === 1) {
      overrides['n_smt'] = pos;
    } else {
      const sId = `st_smt_${i}`;
      const nId = `n_smt_${i}`;
      nodes.push(makeTrackNode({ id: nId, type: NODE_TYPE.STATION_INPUT, name: 'SMT Line' }));
      stations.push(makeStation({ id: sId, name: 'SMT Line', node_id: nId, processes: [] }));
      overrides[nId] = pos;
    }
  }

  // ── 5 visual FCT Benches (KMP GF A-Block, aligned with SMT above) ───────
  for (let i = 1; i <= 5; i++) {
    const pos = { x: -38 + (i - 1) * 6, y: 0, z: -5 };
    if (i === 1) {
      overrides['n_fct'] = pos;
    } else {
      const sId = `st_fct_${i}`;
      const nId = `n_fct_${i}`;
      nodes.push(makeTrackNode({ id: nId, type: NODE_TYPE.STATION_INPUT, name: 'FCT Bench' }));
      stations.push(makeStation({ id: sId, name: 'FCT Bench', node_id: nId, processes: [] }));
      overrides[nId] = pos;
    }
  }

  // ── 5 visual TRSS Assembly stations (KMP SF A-Block) ─────────────────────
  for (let i = 1; i <= 5; i++) {
    const pos = { x: -38 + (i - 1) * 4, y: 10, z: 2 };
    if (i === 1) {
      overrides['n_trss'] = pos;
    } else {
      const sId = `st_trss_${i}`;
      const nId = `n_trss_${i}`;
      nodes.push(makeTrackNode({ id: nId, type: NODE_TYPE.STATION_INPUT, name: 'TRSS Assembly' }));
      stations.push(makeStation({ id: sId, name: 'TRSS Assembly', node_id: nId, processes: [] }));
      overrides[nId] = pos;
    }
  }

  // ── 18 visual 1P Assembly stations in a 3×6 grid (KMP SF B-Block) ─────────
  for (let i = 1; i <= 18; i++) {
    const row = Math.floor((i - 1) / 6);
    const col = (i - 1) % 6;
    const pos = { x: -40 + col * 5, y: 10, z: 8 + row * 4 };

    if (i === 1) {
      overrides['n_1p'] = pos;
    } else {
      const sId = `st_1p_${i}`;
      const nId = `n_1p_${i}`;
      nodes.push(makeTrackNode({ id: nId, type: NODE_TYPE.STATION_INPUT, name: '1P Assembly' }));
      stations.push(makeStation({ id: sId, name: '1P Assembly', node_id: nId, processes: [] }));
      overrides[nId] = pos;
    }
  }

  // ── 4 visual SFG Packing stations (KMP SF B-Block, near bridge exit) ─────
  for (let i = 1; i <= 4; i++) {
    const pos = { x: -28 + (i - 1) * 4, y: 10, z: 22 };
    if (i === 1) {
      overrides['n_sfg_pack'] = pos;
    } else {
      const sId = `st_sfg_pack_${i}`;
      const nId = `n_sfg_pack_${i}`;
      nodes.push(makeTrackNode({ id: nId, type: NODE_TYPE.STATION_INPUT, name: 'SFG Packing' }));
      stations.push(makeStation({ id: sId, name: 'SFG Packing', node_id: nId, processes: [] }));
      overrides[nId] = pos;
    }
  }

  // ── 6 visual VC Assembly stations (WH FF Line A + WH SF Line B) ──────────
  // PDF: "2 lines (FF Line A + SF Line B), scaled to 6 total"
  for (let i = 1; i <= 6; i++) {
    const row = Math.floor((i - 1) / 3);  // 0 = FF Line A, 1 = SF Line B
    const col = (i - 1) % 3;
    const pos = { x: 50 + col * 5, y: 5 + row * 5, z: 15 };
    if (i === 1) {
      overrides['n_vc'] = pos;
    } else {
      const sId = `st_vc_${i}`;
      const nId = `n_vc_${i}`;
      nodes.push(makeTrackNode({ id: nId, type: NODE_TYPE.STATION_INPUT, name: 'VC Assembly' }));
      stations.push(makeStation({ id: sId, name: 'VC Assembly', node_id: nId, processes: [] }));
      overrides[nId] = pos;
    }
  }

  // ── 3 visual Screening lines (WH GF) ─────────────────────────────────────
  for (let i = 1; i <= 3; i++) {
    const pos = { x: 48, y: 0, z: -2 + (i - 1) * 2 };
    if (i === 1) {
      overrides['n_screen'] = pos;
    } else {
      const sId = `st_screen_${i}`;
      const nId = `n_screen_${i}`;
      nodes.push(makeTrackNode({ id: nId, type: NODE_TYPE.STATION_INPUT, name: 'Screening' }));
      stations.push(makeStation({ id: sId, name: 'Screening', node_id: nId, processes: [] }));
      overrides[nId] = pos;
    }
  }

  // ── 5 visual Carton Packing lines (WH GF) ────────────────────────────────
  for (let i = 1; i <= 5; i++) {
    const pos = { x: 60, y: 0, z: -4 + (i - 1) * 2 };
    if (i === 1) {
      overrides['n_pack'] = pos;
    } else {
      const sId = `st_pack_${i}`;
      const nId = `n_pack_${i}`;
      nodes.push(makeTrackNode({ id: nId, type: NODE_TYPE.STATION_INPUT, name: 'Carton Packing' }));
      stations.push(makeStation({ id: sId, name: 'Carton Packing', node_id: nId, processes: [] }));
      overrides[nId] = pos;
    }
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // 9. BUILD FACTORY CONFIG
  // ═══════════════════════════════════════════════════════════════════════════

  return makeFactoryConfig({
    materials: [rawMat, pcba, trssParts, trss, plastic, sfg, nicParts, vcMeter, fg],
    processes: [
      procIqc, procSmt, procFct, procTrss, proc1p, procSfgPack, procAsrs,
      procVc, procScreen, procEnclosure, procPack, procFat,
    ],
    stations,
    segments,
    nodes,
    exits: [nCustomer, nScrap],
    carrierPools: [],
    shifts: [shiftDay, shiftEvening, shiftNight],
    orders: [orderMain, orderTrss, orderPlastic, orderNic],
    layout_overrides: overrides,
  });
}
