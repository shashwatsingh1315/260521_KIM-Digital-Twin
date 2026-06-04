---
status: CURRENT
implemented: phases 0–C (engine, carrier physics, deadlock, aggregator) — 200+ tests green
ui_phase: D (TwinCanvas, SimControls, WipHeatmap, HeadcountPanel, ShockConsole, ProcessForm) in progress
deferred: TrackEditor, CarrierPoolPanel, ForkPanel, SchemaMatrixPanel (Phase E)
---
# Factory Digital Twin v2 — First-Principles Architecture

Generated from a design conversation on 2026-05-28.

This document supersedes the rendering-centric design in
`factory-pull-digital-twin.md`. That document described *how to draw* a fixed
factory; this one defines *what the factory is* as a configurable, simulatable
domain model. The 3D rendering work remains valid as the UI layer on top of
this model.

> For a navigable code map, see [ARCHITECTURE.md](../ARCHITECTURE.md). For
> translating factory floor data into config code, see [factory-config-guide.md](../factory-config-guide.md).

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
| 16 | Transport on a path | **Passive** (conveyor) **or carrier** (AMR / forklift / person); the visual is aesthetic, the resource cost is not |
| 17 | Carrier pool scope | **Dedicated per path** — no shared dispatch; headcount is a clean sum |
| 18 | Carrier count | **User-assigned** — sim reports utilization & whether it keeps up; user tunes |
| 19 | AMR vs. people hours | **AMR runs 24/7** (no labor, separate fleet count); people/manned-forklift are shift-gated and count as headcount |
| 20 | Process taxonomy | **5 orthogonal axes** (count/type/data/time/boundary); named kinds are presets |
| 21 | v1 process kinds | transform, **assembly (N→1)**, inspect/QC, label/seal, hold, store, intake, offload |
| 22 | Assembly components | **Fungible** — matched by type + count, no serial pegging; product born at assembly step |
| 23 | QC failure | **Scrap exit** — no rework loop in v1 (DAG); order reports shortfall if scrap drops it below qty |

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

A process is not a fixed enum — it is a point in a **5-axis transform space**.
The named `kind`s below are presets over these axes:

| Axis | Question | Values |
|---|---|---|
| **count** | Does unit count change? | `1→1` · `N→1` (assembly) |
| **type** | Does material identity change? | same · new type |
| **data** | Does it gain information? | none · adds enrichments |
| **time** | How long does material reside? | instant (takt) · fixed dwell · until-pull |
| **boundary** | Does it cross the system edge? | internal · intake · offload/exit |

```
Process {
  id, name
  kind                // see preset table below
  input_materials     // Material[]

  // --- transform / output ---
  output_material?    // if type changes (transform, assembly)  Raw → Treated

  // --- assembly (kind == "assembly") ---
  bom?                // { material_id: qty }  e.g. { PCB:1, CASING:1, SCREW:4 }
                      // components are FUNGIBLE: matched by type + count, not serial
  enrichment_inherit? // "none" | "union"   (default none; product gets adds_enrichments)

  // --- timed residence (kind == "hold" | "store") ---
  dwell_seconds?      // hold: fixed residence time;  store: omitted (until pull)
  slots?              // how many units reside simultaneously (oven trays, racks)

  // --- inspection (kind == "inspect") ---
  pass_rate?          // 0..1; failing units route to a SCRAP exit (no rework in v1, DAG)

  // --- data ---
  adds_enrichments    // e.g. ["seal_number"]  (label/seal, inspect result, etc.)

  constraints { requires_skills[], requires_tools[] }
  takt_is_set_per_station   // takt lives on Station.processes, not here
  schema_impact       // SchemaImpactMatrix  (see §9)
}
```

**v1 kind presets:**

| kind | count | type | data | time | boundary | engine handling |
|---|---|---|---|---|---|---|
| `transform` | 1→1 | new | maybe | takt | internal | reassign `unit.material`, advance |
| `assembly` | **N→1** | new | maybe | takt | internal | consume fungible kit per `bom`, emit one product |
| `inspect` | 1→1 | same | adds result | takt | internal | pass → continue; fail → **scrap exit** |
| `label` / `seal` | 1→1 | same | adds field | takt | internal | append enrichment only |
| `hold` | 1→1 | same | none | **dwell** | internal | occupy a slot for `dwell_seconds` |
| `store` | 1→1 | same | none | **until pull** | internal | occupy a slot until downstream pull |
| `intake` | 0→1 | sets | sets | takt | **entry** | order-level unit creation (§4.2-4.3) |
| `offload` | 1→0 | — | — | takt | **exit** | unit reaches ExitNode, completes |

Processes define *what can happen*. The **sequence** is per-order
(`Order.process_sequence`), not per-material — the same STEEL_COIL can follow
different sequences depending on the order.

> **Note on `takt` vs `dwell` vs `slots`** — these are three different numbers and
> are easy to conflate. `takt` = the load/unload cadence (throughput rate);
> `dwell` = how long one unit stays (residence); `slots` = how many reside at
> once. For a curing oven: takt = load cadence, dwell = bake time, slots = trays.
> Steady-state throughput ≈ `slots / dwell`.

### 4.4.1 Transformation & Assembly Mechanics

**`1→1` transform (the simple 90%)** — same unit id keeps flowing:
```
on complete(transform):
  unit.material    = output_material          // RAW_STEEL → TREATED_STEEL
  unit.enrichments += adds_enrichments
  unit.next_process = order.process_sequence[++idx]
```

**`N→1` assembly (the hard case)** — a new unit is *born*:
```
station waits until input buffer holds a COMPLETE fungible kit (per bom)   // sync point
on assembly:
  consume the kit units (they cease to exist)
  emit new unit:
    id            = new uuid
    material      = output_material            // DEVICE
    order_id      = the product order this assembly fulfils      // see rule below
    enrichments   = (enrichment_inherit == "union" ? merge(components) : {}) + adds_enrichments
```

Assembly is a **merge** — which is allowed, and does *not* contradict the
"split, no merge" decision. That rule forbids *same-order split units* from
re-joining; assembly instead combines **distinct component materials** via a BOM.

**Three rules assembly forces (resolved for v1):**
1. **Order identity** — the product unit belongs to the **product order** whose
   `process_sequence` includes this assembly step. The product unit is born *at*
   the assembly station (not at intake); components arrive from their own
   intakes/upstream. If several product orders share an assembly station,
   serve them **FIFO**.
2. **Components are fungible** — matched by `(type, count)` only; no serial
   pegging in v1.
3. **Kitting deadlock** — if the station holds partial kits because one
   component line lags, its buffer fills and stalls. This is detected like any
   block and raised as a **ShockEvent** for the operator (§8.1).

### 4.4.2 Kind-Based Editing (UI)

The `Process` struct holds many optional fields, but the editor **never shows all
of them at once.** The form is driven by `kind`, so the user only ever sees the
1–2 fields that matter for that kind. The fields stay orthogonal in the data
model; the UI just hides what is irrelevant.

| kind | Fields shown | Hidden |
|---|---|---|
| `transform` | takt, output_material | dwell, slots, bom, pass_rate |
| `assembly` | takt, output_material, bom, enrichment_inherit | dwell, slots, pass_rate |
| `inspect` | takt, pass_rate | dwell, slots, bom, output_material |
| `label` / `seal` | takt, adds_enrichments | dwell, slots, bom, pass_rate |
| `hold` | dwell, slots | takt*, bom, pass_rate |
| `store` | slots | takt*, dwell, bom, pass_rate |

\* For hold/store, "takt" is the *load cadence* and defaults to "as fast as
upstream feeds"; it is an advanced field, not required.

Each form shows a **live derived readout** so the coupling is visible without
mental math, e.g. for hold: `throughput ≈ slots / dwell = 3 / 300 s = 36/hr`.
This keeps the three numbers separate (correct) yet effortless to enter (clean).

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
  kind                // "ship" (good output) | "scrap" (QC failures)
  connected_from: TrackSegment[]
}
```
Units reach an exit node and are removed from the simulation. A **ship** exit
counts toward the order's `units_completed`; a **scrap** exit increments the
order's scrap counter instead. An order whose good units fall short of
`quantity` (due to scrap) is reported as a shortfall — v1 does not auto-release
replacements.

**Config validation:** At least one ship exit must exist. All terminal track
segments must lead to an exit node; no dead-end tracks allowed. If any process
has `kind == "inspect"`, a reachable scrap exit must exist for the failing path.

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
  length_m
  transport: PassiveTransport | CarrierTransport   // see §7.3
  capacity { max_units | max_volume_m3, current_occupancy: Unit[] }
  state    // "active" | "blocked" | "maintenance"
}
```

- A **junction** is a `TrackNode` with multiple inbound (converge) or outbound
  (diverge) segments.
- At a **diverge**, the branch is chosen by **material type** (`material_rules`).
- A unit **consumes physical space** on a segment; when the segment is at
  capacity, upstream units **wait** (block).
- Each segment declares **how** material crosses it — passively (conveyor) or
  via a carrier (AMR / forklift / person). See §7.3.

### 7.2 Station
```
Station {
  id, location{x,y,z}, dimensions{l,w,h}        // INPUT: dimensions modifiable
  buffers {
    input  { capacity, current: Unit[], fed_by: segment[] }    // INPUT: capacity
    output { capacity, current: Unit[], drains_to: segment }   // INPUT: capacity
  }
  processes [ {
    process_id                            // INPUT
    automation_level                      // INPUT: "manual" | "semi" | "full"
    parallel_slots                        // INPUT: max units run at once
    takt_seconds                          // INPUT: the heartbeat for this process here
    operators_per_slot                    // INPUT: people needed to run one slot
                                          //        (0 for full automation)
    // DERIVED (never stored, never hand-entered):
    //   capacity_per_hour      = 3600 / takt_seconds × effective_slots
    //   effective_slots(shift) = min(parallel_slots,
    //                                 floor(assigned_operators / operators_per_slot))
  } ]
  staffing_by_shift { shift_id: { roles{role:count} } }   // INPUT: people assigned
}
```

The same `process_id` may appear on multiple stations (parallel capacity); a
single station may list multiple processes.

**No redundant/magic numbers here:** `capacity_per_hour` is *derived* from takt,
not stored (storing both invites contradiction). Understaffing does **not** use a
magic multiplier like `0.8` — instead, `effective_slots` is *computed* from how
many operators are assigned versus `operators_per_slot`. A fully-automated process
sets `operators_per_slot = 0`, so staffing never throttles it. See §15.

### 7.3 Transport Classes & Carrier Pools

The visual choice (AMR vs. walking person) is **aesthetic in the 3D view**, but
the choice has one real, non-aesthetic consequence: **resource accounting** (how
many people the factory needs) and whether transport itself becomes a bottleneck.
So transport is modeled as a real entity, not a render flag.

Every segment uses one of two transport classes:

**Passive transport** — the track moves the material (conveyor, chute, powered
rail). No discrete carrier, no labor.
```
PassiveTransport {
  mode          // "conveyor" | "chute" | "rail"
  speed_m_per_min
}
```
Throughput is bounded only by `length_m`, `speed`, and segment `capacity`.

**Carrier transport** — a discrete carrier picks up a unit, travels, drops it,
and **returns empty** to fetch the next. Served by a dedicated `CarrierPool`.
```
CarrierTransport {
  pool_id       // the dedicated CarrierPool serving this segment
}

CarrierPool {
  id
  carrier_kind  // "amr" | "forklift" | "person"
  count         // fleet size / people assigned (USER-ASSIGNED, not derived)
  units_per_trip            // usually 1; cart/tote can be >1
  timing {
    load_sec, unload_sec
    loaded_speed_m_per_min
    return_speed_m_per_min  // empty leg, often faster
  }

  // Derived from carrier_kind (user-overridable):
  counts_as_labor   // person → true;  amr → false;  forklift → true (manned)
  shift_gated       // person/forklift → true;  amr → false (runs 24/7)
}
```

**Key decisions (binding):**
- **Dedicated per path** — each carrier-served segment has its *own* pool. No
  shared dispatch, so no starvation/oscillation, and headcount is a clean sum.
- **User-assigned count** — the user sets `count`; the sim does **not** derive
  it. Instead the sim reports utilization and whether the pool keeps up (see
  §7.4). The user tunes `count` up/down by observation.
- **AMR runs 24/7** — AMR pools ignore shifts and add **zero** to headcount
  (counted separately as a fleet). People (and manned forklifts) are shift-gated
  and count as labor.

**Carrier physics (the round trip — must not be skipped):**
```
round_trip_time = load_sec
                + (length_m / loaded_speed)
                + unload_sec
                + (length_m / return_speed)

pool_throughput = count × units_per_trip × (3600 / round_trip_time)   units/hour
                  × availability   (1.0 for AMR 24/7; shift fraction for people)
```
Modeling only the loaded leg would overstate capacity and undercount people, so
the empty return is mandatory.

### 7.4 Headcount Accounting

This is the bottom-line readout the factory exists to produce.

```
people_required (per shift) =
    Σ station staffing for that shift            (operators + technicians)
  + Σ CarrierPool.count where counts_as_labor && active in that shift

amr_fleet = Σ CarrierPool.count where carrier_kind == "amr"   (reported separately)
```

Because pools are dedicated and counts are user-assigned, this is a plain sum —
no dispatch model, no estimation. The sim's job is to tell the user whether their
assigned numbers are **enough**:

- **Carrier utilization** = (demand on segment) ÷ pool_throughput.
  - `< 1.0` → keeps up (idle time exists).
  - `≥ 1.0` → transport is a bottleneck; units queue at pickup, WIP grows, and
    (under wait/block) the line can stall.
- A **growing pickup queue** is the visible signal to add a carrier/person.

So "number of people required" emerges by iteration: assign → run → watch
utilization & queues → adjust. The total headcount is always exact for whatever
is currently assigned.

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
3. **Flow + buffer physics** — move units along segments, respect segment
   capacity, move into/out of station input/output buffers; when a segment is
   full, the unit **waits** (blocks).
   - **Passive segments**: unit advances continuously at the conveyor speed.
   - **Carrier segments**: a free carrier from the dedicated pool picks up the
     unit, traverses (loaded), drops at the destination buffer, then returns
     empty before it can take the next. If the destination buffer is full, the
     carrier **waits while holding the unit** (occupying itself) — this shrinks
     effective fleet and can trigger a transport ShockEvent.
   - Carrier pools are **shift-gated** for people/forklifts; AMR pools run 24/7.
4. **Queue discipline** — station input buffer is FIFO; one process at a time
   per station (no tool-switching mid-shift). Carrier pickup is FIFO by request.
5. **Process application** — apply the process kind's transform on completion:
   - `transform`: reassign `unit.material`, add enrichments, advance.
   - `assembly`: wait for a complete fungible kit (per `bom`), consume the
     components, emit one product unit (born here, tagged with the product
     order). A stalled kit is a block → ShockEvent.
   - `inspect`: roll against `pass_rate`; pass → continue, fail → route to a
     **scrap exit**.
   - `label`/`seal`: append enrichment only.
   - `hold`/`store`: occupy a slot for `dwell_seconds` (hold) or until a
     downstream pull (store); `slots` bounds simultaneous residents.
6. **Deadlock detector** — detect circular waits (cycle in the "waiting-for"
   graph), including assembly kitting stalls and carrier blocks; emit a
   **ShockEvent** for the operator to resolve (we do not auto-divert).
7. **Order-completion aggregator** — count `units_completed` at **ship** exits
   and `scrap` at scrap exits; mark an order complete when good units reach
   `quantity`, or report a shortfall if scrap prevents it.

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
│  Material · Order · Unit · Process · Shift         │
│  + SchemaImpactMatrix                              │
├─ NETWORK (editable physical) ─────────────────────┤
│  TrackNode · TrackSegment(passive | carrier)       │
│  Station(dimensions, buffers, takt-per-process)    │
│  CarrierPool(dedicated, AMR/forklift/person)       │
├─ ENGINE (pure, time injected) ────────────────────┤
│  Pull release · Takt tick (shift-gated) ·          │
│  Flow/buffer/block + carrier round-trip physics ·  │
│  Deadlock detector → ShockEvent ·                  │
│  Order-completion + headcount/utilization          │
├─ TIME / MODE ─────────────────────────────────────┤
│  Live Twin (wall-clock)  │  Fork (synthetic, COW)  │
├─ UI ──────────────────────────────────────────────┤
│  3D floor (modifiable dims) · Track + carrier      │
│  editor · Schema-matrix panel (on machine click) · │
│  WIP/starvation + carrier-utilization heatmap ·    │
│  Headcount readout · Shock console                 │
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
| Transport undercount (forgot empty return) | Carrier model is full round-trip; loaded + empty legs (§7.3) |
| Carrier dispatch starvation | Eliminated — pools are dedicated per path, no shared dispatch (§7.3) |
| Carrier blocked at full buffer | Carrier waits holding the unit → shrinks fleet → transport ShockEvent (§8.1) |
| Hidden transport bottleneck | Carrier utilization & pickup-queue surfaced in UI (§7.4) |
| Assembly kitting deadlock | Partial-kit stall detected as a block → ShockEvent (§4.4.1, §8.1) |
| Assembly count/order ambiguity | Product born at assembly step, tagged to the product order, FIFO if shared (§4.4.1) |
| QC scrap drift (count mismatch) | Scrap exits tracked separately; order reports shortfall vs quantity (§4.6, §8.1) |
| takt/dwell/slots conflation | Three explicit fields; throughput ≈ slots/dwell documented (§4.4) |

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
4. **Transport layer**: passive vs. carrier movement; dedicated pools with full
   round-trip timing; carrier-block handling.
5. **Pull release governor** + bottleneck identification.
6. **Deadlock detector** + ShockEvent emission (station + transport).
7. **Order-completion aggregator** + headcount/utilization accounting.
8. **Hybrid time/mode** (snapshot + fork + clone-on-write).
9. **UI**: wire the engine state into the existing R3F floor; add track editor,
   carrier-pool config, schema-matrix panel, WIP/starvation + carrier-utilization
   heatmap, headcount readout, shock console, config pause-resume.

---

## 15. Configuration Ledger — Inputs vs. Derived (No Hardcoding)

**Governing principle:** every number in the system is either **(I) user input**
entered upfront, or **(D) derived** by a formula from inputs. **Nothing is a magic
constant baked into code.** Defaults exist only as editable seed values, never as
locks. If a value can be computed from other values, it is *derived* and never
stored (storing both invites contradiction).

### 15.1 The ledger

| Value | Source | Formula (if derived) |
|---|---|---|
| Material weight / dimensions / sku | **I** | — |
| Order quantity / arrival_time / process_sequence | **I** | — |
| Process takt_seconds (per station) | **I** | — |
| Process dwell_seconds / slots (hold/store) | **I** | — |
| Process pass_rate (inspect) | **I** | — |
| Process bom quantities (assembly) | **I** | — |
| Station dimensions | **I** | — |
| Station buffer capacities (in/out) | **I** | — |
| parallel_slots, operators_per_slot | **I** | — |
| Shift start / duration / days / staffing | **I** | — |
| Track length_m, speed_m_per_min, capacity | **I** | — |
| Carrier count / units_per_trip / load+unload / speeds | **I** | — |
| Carrier counts_as_labor / shift_gated | **I** (default by kind) | overridable |
| **station capacity_per_hour** | **D** | `3600 / takt × effective_slots` |
| **effective_slots (per shift)** | **D** | `min(parallel_slots, ⌊assigned_operators / operators_per_slot⌋)` |
| **station effective_throughput** | **D** | `capacity_per_hour × shift_availability` |
| **bottleneck station** | **D** | `argmin(effective_throughput)` |
| **carrier round_trip_time** | **D** | `load + length/loaded_speed + unload + length/return_speed` |
| **carrier pool_throughput** | **D** | `count × units_per_trip × 3600/round_trip × availability` |
| **carrier utilization** | **D** | `segment_demand / pool_throughput` |
| **hold/store throughput** | **D** | `≈ slots / dwell` |
| **people_required (per shift)** | **D** | `Σ station staffing + Σ labor-carrier counts` |
| **amr_fleet** | **D** | `Σ AMR carrier counts` |
| **next_completion_time** | **D** | `current_time + takt` (event-driven, §5) |
| **order units_completed / scrap / shortfall** | **D** | counted at ship/scrap exits |

### 15.2 Legacy magic numbers eliminated

The v1 (`factory-pull-digital-twin.md`) design hardcoded several constants. v2
replaces each with input or derivation:

| v1 hardcoded value | v2 treatment |
|---|---|
| "buffer > 5 units = bottleneck" | per-buffer `capacity` (**I**); fullness is **D** |
| "ASRS consumes 1 unit / 3 ticks" | a demand/takt (**I**) |
| "tick 0 → 100", "1 tick/sec" | event-driven time, no fixed range (§5) |
| Hardcoded Three.js coordinates | station/track positions are **I** |
| "max 500 particles", renderOrder 0/1/2 | rendering-layer perf settings, not domain numbers |

### 15.3 Consequence

Because of this discipline, the whole factory is **data-driven**: a configuration
is just a document of inputs, and every behavioral number falls out by formula.
The engine contains **no tunable constants** — it can be fully exercised by
editing config alone, which is also what makes the hybrid twin/fork and the
config-pause-and-apply model clean.
