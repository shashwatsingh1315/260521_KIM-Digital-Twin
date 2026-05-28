---
status: DRAFT
---
# Factory Digital Twin v2 — First-Principles Architecture

Generated from a design conversation on 2026-05-28.
Branch: claude/relaxed-allen-nqZWs

This document supersedes the rendering-centric design in
`factory-pull-digital-twin.md`. That document described *how to draw* a fixed
factory; this one defines *what the factory is* as a configurable, simulatable
domain model. The 3D rendering work remains valid as the UI layer on top of
this model.

---

## 1. Vision

A configurable digital twin of a manufacturing floor where the user can:

- Define **raw materials** and the **processes** they undergo (hold, store,
  transform, etc.).
- Place **stations** that perform those processes — automated or manned, each
  with a per-process **takt time** and **processing capacity**.
- Run the **same process across multiple parallel stations** (volume), and run
  **multiple processes at a single station**.
- Author an **editable track network** (like railway track: single tracks
  between stations, with diverge/converge junctions) that physically carries
  material between stations.
- Model **worker shifts** (e.g. N shifts of 7 hours) that gate station
  availability.
- Replicate the floor plan and machines with **correct, modifiable
  dimensions**.
- View, per machine, a **schema-impact matrix** documenting which fields each
  external system (WMS / MES / Noviga / SAP) creates, reads, updates, or
  deletes for the processes at that station.

The factory runs as a **live twin** in wall-clock time and can be **forked into
a what-if simulator** from any point.

---

## 2. First-Principles Framing

The factory is modeled as **units of material flowing through a physical
network under a takt-time clock, admitted by a pull discipline.**

Three deliberate framings drive the whole design:

1. **Physical, not logical, routing.** There is no abstract "route planner."
   Material moves the way a train moves on track: a single track between two
   points, junctions that diverge/converge, and *waiting* when the next segment
   is full. Routing decisions at a divergence are **material-type based** (this
   material always takes this branch).

2. **Takt time is the engine's heartbeat.** Each *process @ station* releases
   and processes a unit at its configured takt. Material is released and
   processed based on takt — **not** on external system events.

3. **External systems are a representational overlay.** WMS / MES / Noviga /
   SAP do **not** drive the simulation. They are documented per process as a
   schema-impact matrix (CRUD × system) for representation purposes only.

---

## 3. Resolved Design Decisions

These were settled during the design conversation and are binding for v2:

| # | Question | Decision |
|---|----------|----------|
| 1 | Twin vs. simulator | **Hybrid** — live twin (wall-clock) that can be forked into a what-if sim (synthetic clock) |
| 2 | What drives material flow | **Takt time** per process @ station |
| 3 | Role of WMS/MES/Noviga/SAP | **Representational only** — schema-impact matrix, not a data source |
| 4 | How units are released onto the floor | **Pull / bottleneck-gated** — admit a unit only when the bottleneck can take it |
| 5 | Divergence/junction routing | **Material-type based** (fixed branch per material type) |
| 6 | Track full at a junction | **Wait (block)** — the unit waits; no auto-divert |
| 7 | Track / buffer model | **Stations have input/output buffers; track space is consumed per unit** |
| 8 | Multi-granularity | **Order → splits into units at entry; units flow independently; no re-merge** |
| 9 | Order completion | **Logical aggregator** — order is complete when all its units exit |
| 10 | Station dimensions | **Modifiable** |

---

## 4. Domain Model (Pure Data)

These are immutable/value definitions with no behavior. The engine operates on
them.

### 4.1 Material (static definition)
```
Material {
  id                 // "STEEL_COIL"
  properties { weight_kg, dimensions{l,w,h}, sku }
  allowed_processes  // Process[]
  divergence_rules   // { junction_id: chosen_branch_id }  (material-type routing)
}
```

### 4.2 Unit (dynamic instance — the thing that flows)
```
Unit {
  id                 // UUID
  material           // Material
  order_id           // parent order (for logical completion aggregation)
  location {
    type             // "track" | "station_input" | "station_processing" | "station_output"
    track_id?, track_position_m?
    station_id?, buffer_slot?, process_id?
  }
  enrichments        // { field: value } accumulated as processes run
  lifecycle { created_at, completed_at?, events[] }
}
```
A unit is a single, independently-flowing item. Splitting an order produces N
units; there is no merge.

### 4.3 Process (transformation recipe)
```
Process {
  id, name           // "Sealing"
  kind               // "hold" | "store" | "transform" | ...
  input_materials    // Material[]
  adds_enrichments   // e.g. ["seal_number"]
  output_material?   // if it transforms type (Raw → Treated)
  constraints { requires_skills[], requires_tools[] }
  schema_impact      // SchemaImpactMatrix  (see §7)
}
```

### 4.4 Shift (workforce schedule)
```
Shift {
  id, name           // "Day Shift"
  start_time         // "07:00"
  duration_hours     // 7
  days               // ["Mon".."Fri"]
  staffing           // { station_id: { role: count } }
}
```

---

## 5. Network Model (Editable Physical Infrastructure)

The floor is a **directed graph with physics**. This is the editable backbone.

### 5.1 Track network
```
TrackNode {                 // a point: station port OR junction
  id, coordinates{x,y,z}
  outbound { dest_node_id: { segment_id, material_rules{ material_id: dest_node_id } } }
}

TrackSegment {              // a single track between two nodes
  id, from_node, to_node
  physics  { length_m, transport_mode("conveyor"|"rail"|"manual"), speed_m_per_min }
  capacity { max_units | max_volume_m3, current_occupancy: Unit[] }
  state    // "active" | "blocked" | "maintenance"
}
```

- A **junction** is a `TrackNode` with multiple inbound (converge) or outbound
  (diverge) segments.
- At a **diverge**, the branch is chosen by **material type** (`material_rules`).
- A unit **consumes physical space** on a segment; when the segment is at
  capacity, upstream units **wait** (block).

### 5.2 Station
```
Station {
  id, location{x,y,z}, dimensions{l,w,h}        // dimensions modifiable
  buffers {
    input  { capacity, current: Unit[], fed_by: segment[] }
    output { capacity, current: Unit[], drains_to: segment }
  }
  processes [ {
    process_id
    automation_level  // "manual" | "semi" | "full"
    parallel_slots    // can run K units simultaneously
    takt_seconds      // the heartbeat for this process @ this station
    capacity_per_hour
  } ]
  staffing_by_shift { shift_id: { roles{role:count}, capacity_multiplier } }
}
```

The same `process_id` may appear on multiple stations (parallel capacity); a
single station may list multiple processes.

---

## 6. Simulation Engine (Pure, Time Injected)

The engine has **zero knowledge of the UI or the four external systems.** It
takes the domain + network + a `time` source and advances state. Time is an
**injected dependency** — never read from the system clock directly — which is
what lets the same engine run the live twin (wall-clock) and a fork (synthetic
clock).

### 6.1 Responsibilities
1. **Pull release governor** — admit a new unit onto the floor only when the
   **bottleneck** station can accept one. This caps work-in-progress (WIP) and
   is the primary defense against deadlock.
2. **Takt tick** — each process @ station completes a unit every `takt_seconds`,
   **but only while the station is active per the current shift** (effective
   throughput = takt × availability).
3. **Flow + buffer physics** — move units along segments at `speed_m_per_min`,
   respect segment capacity, move into/out of station buffers; when blocked, the
   unit **waits**.
4. **Deadlock detector** — detect circular waits (cycle in the "waiting-for"
   graph) and emit a **ShockEvent** for the operator to resolve (we do not
   auto-divert).
5. **Order-completion aggregator** — mark an order complete when **all** its
   units have exited (there is no physical merge).

### 6.2 The central dynamic: takt balance
Because takt drives everything, the relationship between adjacent takt times is
the whole system:
- Upstream faster than downstream → WIP piles up → buffer fills → **blocks**.
- Upstream slower than downstream → downstream **starves** (idle capacity).
The UI must make this **visible** (WIP / starvation heatmap) — it is the core
KPI.

---

## 7. External-System Representation (Schema-Impact Matrix)

Clicking a machine shows a per-process table documenting the **data footprint**
of that process across the four systems. It is **static schema-level
documentation**, not live per-unit values and not a sync mechanism.

Example — Process "Sealing" @ Station C:

```
           CREATE         READ          UPDATE        DELETE
─────────────────────────────────────────────────────────────
SAP        —              —             —             —
MES        Seal_Number    PCB_Number    Status        —
WMS        —              Location      Location      —
Noviga     —              —             —             —
```

```
SchemaImpactMatrix {
  process_id
  rows: { system: "SAP"|"MES"|"WMS"|"Noviga",
          create[], read[], update[], delete[] }   // field names
}
```

This communicates intent like: *"at this station, MES creates a Seal_Number
field and reads the PCB_Number field."* It is attached to the `Process`
definition.

---

## 8. Time & Mode — Hybrid Twin + Fork

```
        LIVE TWIN                          FORKED SIM
   (wall-clock, real)              (synthetic clock, what-if)
   ┌──────────────────┐  snapshot   ┌──────────────────┐
   │ units, tracks,   │ ──────────► │ copy-on-write     │
   │ stations         │  (frozen    │ clone of state    │
   │                  │   point)    │ driven by         │
   │                  │             │ synthetic clock   │
   └──────────────────┘             └──────────────────┘
        ▲                                  ▲
   real takt advances                synthetic clock advances
   no write to a fork                NEVER writes back to twin
```

Three non-negotiable rules:
1. **One-way fork.** A sim reads a snapshot of the twin; it never writes back to
   live state. (Since the four systems are representational, there are no real
   side-effects to guard, but the rule keeps twin and fork timelines clean.)
2. **Two clocks.** Twin = wall-clock; fork = synthetic, rewindable. Engine takes
   `time` as a parameter.
3. **Snapshot = immutable, versioned checkpoint.** This is also what enables
   rewind/scrub.

---

## 9. Module Boundaries

```
┌─ DOMAIN (pure data) ──────────────────────────────┐
│  Material · Unit · Process · Shift                 │
│  + SchemaImpactMatrix                              │
├─ NETWORK (editable physical) ─────────────────────┤
│  TrackNode · TrackSegment(length,speed,capacity)   │
│  Station(dimensions, buffers, takt-per-process)    │
├─ ENGINE (pure, time injected) ────────────────────┤
│  Pull release · Takt tick (shift-gated) ·          │
│  Flow/buffer/block physics ·                       │
│  Deadlock detector → ShockEvent ·                  │
│  Order-completion aggregator                       │
├─ TIME / MODE ─────────────────────────────────────┤
│  Live Twin (wall-clock)  │  Fork (synthetic, COW)  │
├─ UI ──────────────────────────────────────────────┤
│  3D floor (modifiable dims) · Track editor ·       │
│  Schema-matrix panel (on machine click) ·          │
│  WIP/starvation heatmap · Shock console            │
└────────────────────────────────────────────────────┘
```

Dependency direction is strictly downward: UI → Engine → Network → Domain. The
engine never imports UI or external-system code.

---

## 10. Chaos Sources and How They Are Tamed

The design was stress-tested by enumerating what would turn an ordered system
into a chaotic one. Each is mapped to a decision:

| Chaos source | Tamed by |
|---|---|
| Unbounded WIP → deadlock | Pull / bottleneck-gated release |
| Deadlock from wait/block | Detect circular wait → surface as ShockEvent → operator resolves |
| Takt imbalance | Made visible (WIP / starvation heatmap) |
| Hidden track capacity | Track latency + occupancy modeled explicitly |
| Shift gaps | Station takt ticks only while staffed (throughput = takt × availability) |
| Split-no-merge count mismatch | Logical order-completion aggregator |
| Twin vs. sim collision | Hybrid: sealed one-way copy-on-write fork, two clocks |
| External-system sync drift | Eliminated — systems are a schema overlay, not drivers |
| Config edit mid-run | **OPEN** — see §11 |

---

## 11. Open Questions

1. **Config edits during a run.** When the user shortens a track, moves a
   station, or changes a takt while units are in flight, what happens? Candidate
   rules: pause-and-apply, or apply-to-new-units-only. **Undecided.**
2. **Takt determinism.** Is takt fixed/deterministic, or does it have
   variability (breakdowns, micro-stops)? Recommend starting deterministic.
3. **Track authoring UX.** How does the user draw/edit the track graph and
   junctions (and set per-junction material rules)? Needs its own design pass.
4. **Dimension-editing UX.** How are station dimensions edited in the 3D view,
   and what is constrained (collisions, floor bounds)?
5. **Shift hand-over mid-process.** What happens to a unit being processed when
   its station's shift ends mid-cycle?

---

## 12. Suggested Build Order

1. **Domain + Network types** (pure data, no behavior).
2. **Engine core**: takt tick + flow/buffer/block physics, with unit tests on a
   tiny hand-built network — prove balance/imbalance behavior.
3. **Pull release governor** + deadlock detector → ShockEvent.
4. **Order-completion aggregator.**
5. **Hybrid time/mode** (snapshot + fork).
6. **UI**: wire the engine state into the existing R3F floor; add track editor,
   schema-matrix panel, WIP heatmap, shock console.
