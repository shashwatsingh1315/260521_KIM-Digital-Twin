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
| 11 | Config edits during run | **Pause and apply** — everything freezes, user edits, apply resumes |
| 12 | Takt variability | **Fixed / deterministic** — no breakdowns or micro-stops in v1 |
| 13 | Time model | **Event-driven per station** — next event is the next takt completion; deterministic and causal |
| 14 | Shift hand-over mid-process | **Complete on overtime** — takt is absolute; staffing affects capacity, not takt |
| 15 | Network validation | **DAG only, no cycles** — ensures forward progress; rework loops are a future feature |

---

## 4. Domain Model (Pure Data)

These are immutable/value definitions with no behavior. The engine operates on
them.

### 4.1 Material (static definition)
```
Material {
  id                 // "STEEL_COIL"
  properties { weight_kg, dimensions{l,w,h}, sku }
  allowed_processes  // Process[]  (unordered set; sequence is per-order)
}
```

### 4.2 Order (top-level request)
```
Order {
  id                 // "ORD_001"
  material_type      // Material
  quantity           // N (units to produce)
  process_sequence   // [Process A, Process B, Process C]  (order-specific sequence)
  arrival_time       // when the order becomes available to the release governor
  
  status             // "pending" | "in_progress" | "completed" | "failed"
  units_created      // count of units spawned from this order
  units_completed    // count of units that have exited
  
  lifecycle { created_at, completed_at?, events[] }
}
```
Orders arrive at the system (via UI, file, or demand signal) and are queued in
the release governor's pending queue. As units complete, the order progresses.
When `units_completed == quantity`, the order is marked complete.

### 4.3 Unit (dynamic instance — the thing that flows)
```
Unit {
  id                 // UUID
  material           // Material
  order_id           // parent order (for logical completion aggregation)
  unit_number        // 1 of N in the order
  
  next_process       // the next Process this unit must undergo (from order.process_sequence)
  
  location {
    type             // "pending" | "track" | "station_input" | "station_processing" | "station_output" | "exit"
    track_id?, track_position_m?
    station_id?, buffer_slot?, process_id?
  }
  
  enrichments        // { field: value } accumulated as processes run
  lifecycle { created_at, completed_at?, events[] }
}
```
A unit is a single, independently-flowing item. Splitting an order produces N
units; there is no physical merge. Units are created lazily: the release
governor spawns a unit from a pending order only when it can admit it onto the
floor.

### 4.4 Process (transformation recipe)
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
Processes define *what can happen*. The **sequence** in which a material undergoes
processes is per-order (defined in `Order.process_sequence`), not per-material.
This allows flexible routing: the same STEEL_COIL can follow different sequences
depending on the order.

### 4.5 Shift (workforce schedule)
```
Shift {
  id, name           // "Day Shift"
  start_time         // "07:00"
  duration_hours     // 7
  days               // ["Mon".."Fri"]
  staffing           // { station_id: { role: count } }
}
```

### 4.6 ExitNode (where units leave the system)
```
ExitNode {
  id, location{x, y, z}
  connected_from: TrackSegment[]
}
```
Units reach an exit node and are marked complete, removing them from the
simulation. The order-completion aggregator tracks when all units from an order
have exited.

**Config validation:** At least one exit node must exist. All terminal track
segments must lead to an exit node; no dead-end tracks allowed.

### 4.7 Divergence Routing (material-type based)

At a `TrackNode` with multiple outbound segments, the unit's next station is
determined by its `next_process` and the station's capabilities:

```
routing_logic(unit, junction):
  next_process = unit.next_process
  candidate_stations = [stations reachable from junction that support next_process
                        and material_type]
  if only one candidate:
    → go to that station
  if multiple:
    → all reachable; pick first (or round-robin in future)
  if none:
    → ERROR at config time (validation catches this)
```

**Config validation:** For every material type and every divergence junction,
ensure there exists a valid outbound path to at least one station that performs
the material's allowed processes. Otherwise, the unit will trap.

---

## 5. Time Model — Event-Driven Per-Station

**Critical:** The engine must advance deterministically despite varying takt times.

```
SimulationEngine {
  current_time_seconds: number
  
  station_processes: {
    [process_key = "station_A:process_Drilling"]: {
      station_id, process_id, takt_seconds
      next_completion_time: number  // when the next unit finishes
      is_staffed: boolean            // per shift availability
    }
  }
  
  advance_one_step() {
    // Find the next event
    next_time = min(all next_completion_times where is_staffed)
    
    if next_time == ∞ (no events):
      return  // nothing to do
    
    current_time = next_time
    
    for each process where next_completion_time == current_time:
      unit = station_input_buffer.dequeue()
      if unit exists:
        complete_unit(unit, process)
        next_completion_time = current_time + takt_seconds
      else:
        next_completion_time = ∞  // station idle, waiting for input
  }
}
```

**Why event-driven?** If Station A takt = 30s and Station B takt = 60s, a
naive "tick all stations every second" incurs 60 discrete timesteps. Event-driven
jumps directly to 30s, 60s, etc., making the simulation:
- **Deterministic:** causally correct, no artificial ordering
- **Efficient:** large takt times don't bloat the step count
- **Pausable:** can pause at any time and edit config; resume from snapshot

---

## 6. Bottleneck Identification

The pull release governor admits units based on the bottleneck station's
readiness. The bottleneck is the station with the **lowest effective throughput**:

```
effective_throughput[station] = (units_per_hour_at_takt) × (shift_availability)
                               = (3600 / takt_seconds) × (staffed_hours / 24)

bottleneck_station = station with min(effective_throughput)
```

**Example:**
```
Station A: takt=30s, always staffed  → 120 units/hour
Station B: takt=60s, always staffed  → 60 units/hour  ← BOTTLENECK
Station C: takt=20s, part-time       → 30 units/hour
```

Station B is the bottleneck. The release governor only admits a unit when B can
accept one (its input buffer is not full, or it's not actively processing).

**Config validation:** Warn if the bottleneck is not explicitly identified by
the user. (In a future multi-path network, bottlenecks per path may differ.)

---

## 7. Network Model (Editable Physical Infrastructure)

The floor is a **directed graph with physics**. This is the editable backbone.

### 7.1 Track network
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

### 7.2 Station
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

---

## 8. Simulation Engine (Pure, Time Injected)

The engine has **zero knowledge of the UI or the four external systems.** It
takes the domain + network + a `time` source and advances state. Time is an
**injected dependency** — never read from the system clock directly — which is
what lets the same engine run the live twin (wall-clock) and a fork (synthetic
clock).

### 8.1 Responsibilities
1. **Pull release governor** — admit a new unit onto the floor only when the
   **bottleneck** station can accept one. This caps work-in-progress (WIP) and
   is the primary defense against deadlock.
2. **Takt tick (shift-gated)** — each process @ station completes a unit every
   `takt_seconds`, **but only while the station is staffed per the current shift**.
   If a shift ends, takt is paused (not cancelled; resumes next shift).
3. **Flow + buffer physics** — move units along segments at `speed_m_per_min`,
   respect segment capacity, move into/out of station input/output buffers;
   when a segment is full, the unit **waits** (blocks).
4. **Queue discipline** — station input buffer is FIFO; one process at a time
   per station (no tool-switching mid-shift).
5. **Deadlock detector** — detect circular waits (cycle in the "waiting-for"
   graph) and emit a **ShockEvent** for the operator to resolve (we do not
   auto-divert).
6. **Order-completion aggregator** — mark an order complete when **all** its
   units have exited.

### 8.2 The central dynamic: takt balance
Because takt drives everything, the relationship between adjacent takt times is
the whole system:
- Upstream faster than downstream → WIP piles up → buffer fills → **blocks**.
- Upstream slower than downstream → downstream **starves** (idle capacity).
The UI must make this **visible** (WIP / starvation heatmap) — it is the core
KPI.

---

## 9. External-System Representation (Schema-Impact Matrix)

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

## 10. Time & Mode — Hybrid Twin + Fork

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

## 11. Module Boundaries

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

## 12. Chaos Sources and How They Are Tamed

The design was stress-tested by enumerating what would turn an ordered system
into a chaotic one. Each is mapped to a decision:

| Chaos source | Tamed by |
|---|---|
| Unbounded WIP → deadlock | Pull / bottleneck-gated release |
| Deadlock from wait/block | Detect circular wait → surface as ShockEvent → operator resolves |
| Takt imbalance | Made visible (WIP / starvation heatmap) |
| Hidden track capacity | Track latency + occupancy modeled explicitly (§5) |
| Shift gaps | Station takt ticks only while staffed; process paused if shift ends |
| Split-no-merge count mismatch | Logical order-completion aggregator (order complete when all units exit) |
| Twin vs. sim collision | Hybrid: sealed one-way copy-on-write fork, two clocks (§10) |
| External-system sync drift | Eliminated — systems are a schema overlay, not drivers (§9) |
| Uncontrolled release | Pull release gated by bottleneck station (§6) |
| Order/unit creation | Explicit Order + pending queue; units spawned lazily by release governor (§4.2-4.3) |
| Process sequencing | Per-order sequences; material-type routing enforces next_process (§4.7) |
| Station queue discipline | FIFO input buffer; one process at a time (§8.1) |
| Network validation | Config-time validation: DAG only, no dead-ends, all material types routable (§4.6-4.7) |
| Config edit mid-run | **RESOLVED** — pause-and-apply (all operations freeze, user edits, then apply) |

---

## 13. Remaining Open Questions (Deferred to Design Refinement)

These are design-pass-level questions that don't block the engine architecture:

1. **Track authoring UX.** How does the user draw/edit the track graph and
   junctions in the 3D view? (Sketch tool? Click-to-place nodes? Implicit topology
   from station adjacency?)
2. **Dimension-editing UX.** How are station dimensions edited, and what is
   constrained (collisions with walls, floor bounds)?
3. **Shift hand-over recovery.** If a process is paused mid-cycle due to shift
   end, how long does it take to resume? (Assumed: instant/same shift next day;
   later: model changeover/setup time.)
4. **Multi-path network support.** For now, assume a linear/DAG flow. In future:
   how to identify bottlenecks when orders can take different paths through the
   network?

---

## 14. Suggested Build Order

1. **Domain + Network types** (Order, Unit, Process, Shift, Material, TrackNode,
   TrackSegment, Station, ExitNode).
2. **Config validator** — check DAG, no dead-ends, all material types routable,
   bottleneck identified.
3. **Engine core**: event-driven takt tick (shift-gated) + flow/buffer/block
   physics on a hand-built network; unit tests to prove determinism and causality.
4. **Pull release governor** + bottleneck identification.
5. **Deadlock detector** + ShockEvent emission.
6. **Order-completion aggregator**.
7. **Hybrid time/mode** (snapshot + fork + clone-on-write).
8. **UI**: wire the engine state into the existing R3F floor; add track editor,
   schema-matrix panel, WIP/starvation heatmap, shock console, config pause-resume.

1. **Domain + Network types** (pure data, no behavior).
2. **Engine core**: takt tick + flow/buffer/block physics, with unit tests on a
   tiny hand-built network — prove balance/imbalance behavior.
3. **Pull release governor** + deadlock detector → ShockEvent.
4. **Order-completion aggregator.**
5. **Hybrid time/mode** (snapshot + fork).
6. **UI**: wire the engine state into the existing R3F floor; add track editor,
   schema-matrix panel, WIP heatmap, shock console.
