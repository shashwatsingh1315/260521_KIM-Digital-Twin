# Architecture Overview

This document is a code-linked map of the system. For the full design rationale, domain model, and binding decisions see [docs/designs/factory-twin-v2-architecture.md](designs/factory-twin-v2-architecture.md).

---

## Two Modes in One Codebase

`src/main.jsx` routes to one of two experiences:

| Route | Component | Status |
|-------|-----------|--------|
| `/` | `src/twin/ui/TwinApp.jsx` | **Active** — deterministic event-driven engine |
| `/legacy` | `src/App.jsx` | Reference only — M800-specific 3D prototype |

Only the deterministic twin (`/`) is actively developed.

---

## Deterministic Twin — Data Flow

```
FactoryConfig (JS object)
        │
        ▼
  validator.js         ← rejects invalid configs at startup
        │
        ▼
  initState()          ← engine.js: builds event queue from config
        │
        ▼
  RAF loop             ← TwinProvider.jsx: advanceFrame(Δt) each animation frame
        │
        ▼
  step(state)          ← engine.js: processes all events up to wall-clock budget
    ├── flow.js          unit movement (segments, backpressure, arrivals)
    ├── taktScheduler.js slot scheduling (parallel slots, takt times)
    ├── processApply.js  transform / assembly / inspect / hold logic
    ├── releaseGovernor.js  WIP cap enforcement
    ├── carriers.js      carrier pool physics (load, traverse, return, shift gate)
    ├── aggregator.js    order completion counters, live metrics
    └── deadlock.js      circular-wait detection
        │
        ▼
  React state update   ← simTime, metrics, shocks
    ├── TwinCanvas.jsx     Three.js 3D scene (stations, conveyor lines, unit particles)
    └── Right-rail panels  WipHeatmap, ShockConsole, HeadcountPanel, UnitStream
```

---

## Engine Modules (`src/twin/engine/`)

| File | Responsibility |
|------|----------------|
| `engine.js` | Event-loop kernel: `initState()`, `step()`, `runTwin()` |
| `clock.js` | Discrete time tracking |
| `flow.js` | Unit movement physics — segments, buffer arrivals, backpressure |
| `taktScheduler.js` | Slot-based process scheduling (parallel slots per station) |
| `processApply.js` | Applies transform / assembly / inspect / hold / store logic to units |
| `releaseGovernor.js` | Global WIP cap; gates unit release into the network |
| `carriers.js` | Carrier pool round-trip physics; shift gating |
| `aggregator.js` | Order completion counting; live metrics (utilisation, headcount, WIP) |
| `deadlock.js` | Detects and reports circular-wait conditions |
| `derive.js` | Derived calculations: effective slots, throughput, round-trip time |
| `validator.js` | Config validation: references, connectivity, reachability |
| `events.js` | Event type definitions |
| `mode/snapshot.js` | State checkpointing for rewind |
| `mode/twin.js` | Standard simulation mode |
| `mode/fork.js` | What-if branching (COW isolation) |

---

## Domain Objects (`src/twin/domain/`)

| Object | What it represents |
|--------|-------------------|
| `Unit` | A single physical item flowing through the network |
| `Order` | A production request (material type, quantity, process sequence, arrival time) |
| `Process` | A manufacturing step (transform, assembly, inspect, hold, store, etc.) |
| `Material` | A material type with an allowed-process whitelist |
| `Shift` | A time window during which operators/carriers are active |
| `SchemaMatrix` | Documents which external system (SAP/MES/WMS/Noviga) creates/reads/updates each field |

---

## Network Objects (`src/twin/network/`)

| Object | What it represents |
|--------|-------------------|
| `TrackNode` | A physical point in the network (INTAKE, JUNCTION, STATION_INPUT, etc.) |
| `TrackSegment` | A conveyor or carrier-served link between two nodes |
| `Station` | A workstation bound to a node; holds processes and buffer capacity |
| `ExitNode` | A terminal node (SHIP or SCRAP) |
| `CarrierPool` | A fleet of vehicles (forklift, AGV, personnel) serving a set of segments |
| `FactoryConfig` | The complete validated specification passed to `initState()` |

---

## Key Design Decisions

**Discrete-event, not time-stepped.** The engine processes an ordered event list, not a fixed clock tick. This means the simulation can skip idle periods in O(1) and is not sensitive to the step size.

**Deterministic.** All stochastic outcomes (scrap, inspect fail) use a seedable RNG (`src/twin/util/rng.js`). The same config + seed always produces the same result — making tests and what-if comparisons reliable.

**Pull-based scheduling.** The release governor holds units back until downstream buffers have headroom. Depletion downstream propagates a pull signal upstream (Kanban-like), preventing system flooding.

**Validation-first.** `validator.js` rejects configs at startup. No silent failures — if the factory is physically impossible, the engine says so before running a single tick.

**Pause-and-apply editing.** The UI can pause the engine, edit takt times or process definitions, and resume. Structural changes (topology) trigger a clean `initState()` rather than patching running state.

---

## Persistence

Config auto-saves to Neon Postgres via `api/config.js` (Vercel serverless, debounced 600 ms). On load, the app fetches the saved config and restores it. Layout overrides are also stored in `localStorage`.

See [DB_MIGRATION_PLAN.md](../DB_MIGRATION_PLAN.md) for a proposed (not yet implemented) full relational schema.

---

## Legacy Prototype (`src/App.jsx`, `src/scene/`, `src/components/`)

The original M800 3D prototype uses a simpler pull engine (`src/hooks/usePullEngine.js`) and renders the KMP/WH factory layout as a fixed Three.js scene. It is not connected to the deterministic engine. Kept for reference at `/legacy`.
