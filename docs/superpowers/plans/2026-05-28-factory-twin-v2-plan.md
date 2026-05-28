# Factory Digital Twin v2 — Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking. Build the **engine first** (pure, fully
> unit-tested) before any UI. Every task lists its files, key signatures, tests,
> and acceptance criteria.

**Goal:** Build the configurable, takt-driven factory digital twin specified in
`docs/designs/factory-twin-v2-architecture.md` — a pure simulation engine plus an
R3F UI, where every number is user-input or formula-derived (no hardcoding).

**Design reference:** `docs/designs/factory-twin-v2-architecture.md` (sections
cited inline as §N).

**Tech Stack:** JavaScript (ES modules), React 18, React Three Fiber / Three.js,
Vite, Vitest (unit), Playwright (e2e) — all already in `package.json`.

**Core principles (binding):**
- Engine is **pure**: takes `(config, state, time)` → new state. No I/O, no clock
  reads, no React, no DOM. This makes it deterministic and trivially testable.
- Dependency direction: **UI → Engine → Network → Domain** (§11). Lower layers
  never import higher ones.
- Every value is **Input** or **Derived** (§15). Derived values are computed by
  functions in `engine/derive.js`, never stored on entities.

---

## Target Directory Layout

```
src/twin/
  domain/      material.js order.js unit.js process.js shift.js schemaMatrix.js
  network/     trackNode.js trackSegment.js station.js carrierPool.js exitNode.js
               factoryConfig.js
  engine/      derive.js validator.js clock.js releaseGovernor.js taktScheduler.js
               flow.js processApply.js deadlock.js aggregator.js engine.js events.js
  mode/        snapshot.js twin.js fork.js
  ui/          (React components, added in Phase 8)
  fixtures/    linearLine.js  assemblyLine.js  (hand-built configs for tests)
```

Tests are colocated as `*.test.js` next to each module (matching the existing
`src/hooks/usePullEngine.test.js` convention).

---

## Phase 0 — Scaffolding & Conventions

**Goal:** Create the directory skeleton and a shared id/util helper so later
phases drop in cleanly.

**Files:**
- Create: `src/twin/util/ids.js`, `src/twin/util/assert.js`

- [ ] **Step 0.1:** Add `newId(prefix)` (UUID-ish, deterministic-seedable for
  tests) in `util/ids.js`. Tests must be able to inject a seeded counter so unit
  ids are stable across runs.
- [ ] **Step 0.2:** Add `invariant(cond, msg)` in `util/assert.js` for
  config-validation error messages.
- [ ] **Step 0.3:** Confirm `npm test` (vitest) runs and picks up `src/twin/**`.

**Acceptance:** `npm test` passes with a trivial placeholder test in
`src/twin/util/ids.test.js` proving seeded ids are deterministic.

---

## Phase 1 — Domain Types (Pure Data)

**Goal:** Implement the §4 entities as plain factory functions returning frozen
value objects. No behavior, no derived fields stored.

**Files:**
- Create: `src/twin/domain/{material,order,unit,process,shift,schemaMatrix}.js`
  and colocated `*.test.js`.

- [ ] **Step 1.1 — Material (§4.1):** `makeMaterial({id, properties, allowed_processes})`.
- [ ] **Step 1.2 — Order (§4.2):** `makeOrder({id, material_type, quantity,
  process_sequence, arrival_time})` → also holds mutable-via-engine counters
  `status, units_created, units_completed, scrap` (initialized, mutated only by
  the aggregator).
- [ ] **Step 1.3 — Unit (§4.3):** `makeUnit({material, order_id, unit_number})`
  with `location`, `next_process`, `enrichments`, `lifecycle`.
- [ ] **Step 1.4 — Process (§4.4):** `makeProcess({id, name, kind, ...})`
  carrying the kind-specific optional fields (`output_material, bom,
  enrichment_inherit, dwell_seconds, slots, pass_rate, adds_enrichments`). Add a
  `KIND` enum: `transform | assembly | inspect | label | hold | store | intake |
  offload`.
- [ ] **Step 1.5 — Shift (§4.5):** `makeShift({id, name, start_time,
  duration_hours, days, staffing})`.
- [ ] **Step 1.6 — SchemaImpactMatrix (§9):** `makeSchemaMatrix({process_id,
  rows})` where each row is `{system, create[], read[], update[], delete[]}`.

**Tests:** each factory rejects missing required fields; produces the documented
shape; `process` rejects fields that don't belong to its `kind` (e.g. `bom` on a
`transform`).

**Acceptance:** 100% of domain factories covered; all assert on invalid input.

---

## Phase 2 — Network Types & Factory Config

**Goal:** Implement §7 physical entities and a single `FactoryConfig` document
that bundles everything the engine needs.

**Files:**
- Create: `src/twin/network/{trackNode,trackSegment,station,carrierPool,exitNode,
  factoryConfig}.js` + tests.

- [ ] **Step 2.1 — TrackNode (§7.1):** `makeTrackNode({id, coordinates,
  outbound})` where `outbound[dest] = {segment_id, material_rules}`.
- [ ] **Step 2.2 — TrackSegment (§7.1):** `makeTrackSegment({id, from_node,
  to_node, length_m, transport, capacity, state})`. `transport` is
  `{class:'passive', mode, speed_m_per_min}` **or** `{class:'carrier', pool_id}`.
- [ ] **Step 2.3 — Station (§7.2):** `makeStation({id, location, dimensions,
  buffers, processes, staffing_by_shift})`. Per-process fields: `process_id,
  automation_level, parallel_slots, takt_seconds, operators_per_slot`. **Do not**
  store `capacity_per_hour` — it is derived (§15).
- [ ] **Step 2.4 — CarrierPool (§7.3):** `makeCarrierPool({id, carrier_kind,
  count, units_per_trip, timing})` with `counts_as_labor`/`shift_gated` defaulted
  from `carrier_kind` (person→labor+gated, amr→neither, forklift→labor+gated),
  overridable.
- [ ] **Step 2.5 — ExitNode (§4.6):** `makeExitNode({id, location, kind,
  connected_from})`, `kind ∈ {ship, scrap}`.
- [ ] **Step 2.6 — FactoryConfig:** `makeFactoryConfig({materials, processes,
  stations, segments, nodes, exits, carrierPools, shifts, orders})` — the whole
  editable document. This is the single object the validator and engine consume.

**Tests:** round-trip construct/read; carrier defaults by kind; segment transport
discriminated union enforced.

**Acceptance:** a `FactoryConfig` can be assembled from the fixtures (Phase 3).

---

## Phase 3 — Test Fixtures (Hand-Built Networks)

**Goal:** Two known-good configs the engine tests assert against.

**Files:**
- Create: `src/twin/fixtures/linearLine.js`, `src/twin/fixtures/assemblyLine.js`.

- [ ] **Step 3.1 — linearLine:** Intake → A(transform,30s) → B(transform,60s,
  bottleneck) → C(transform,20s) → ship exit. Single material, single path. Used
  to prove takt balance, blocking, and the worked example in §6 of the design.
- [ ] **Step 3.2 — assemblyLine:** two component intakes (PCB, CASING) →
  Assembly(bom {PCB:1,CASING:1}) → Inspect(pass_rate 0.9) → ship + scrap exits.
  Used to prove assembly kitting and QC scrap routing.

**Acceptance:** both fixtures pass the Phase 4 validator with zero errors.

---

## Phase 4 — Config Validator

**Goal:** Catch every misconfiguration at load time (§4.6, §4.7, §6, §9) before
the engine ever runs — this is the primary guard against "wonky" behavior.

**Files:**
- Create: `src/twin/engine/validator.js` + test.

- [ ] **Step 4.1 — Graph is a DAG (§ decision 15):** reject cycles in the
  segment graph; report the offending cycle.
- [ ] **Step 4.2 — No dead-ends (§4.6):** every terminal segment leads to an
  ExitNode; at least one `ship` exit exists.
- [ ] **Step 4.3 — Routable (§4.7):** for every material type and every
  divergence node, a valid outbound path exists to a station performing the
  material's next process.
- [ ] **Step 4.4 — Scrap reachable:** if any process `kind==='inspect'`, a
  reachable `scrap` exit exists.
- [ ] **Step 4.5 — Carrier integrity:** every `carrier` segment references an
  existing pool; pools are dedicated (no pool serves >1 segment in v1).
- [ ] **Step 4.6 — Bottleneck identifiable (§6):** compute effective throughput
  for all stations; warn if no unique bottleneck (ties allowed but flagged).

**Tests:** feed deliberately broken variants of the fixtures (cycle, dead-end,
unroutable material, inspect-without-scrap, shared pool) and assert each specific
error fires; the clean fixtures produce zero errors.

**Acceptance:** validator returns `{errors:[], warnings:[]}`; broken configs
surface precise, actionable messages.

---

## Phase 5 — Derived Formulas

**Goal:** Implement §15 derived values as pure functions. Nothing else in the
engine may inline these formulas.

**Files:**
- Create: `src/twin/engine/derive.js` + test.

- [ ] **Step 5.1:** `effectiveSlots(station, processId, shiftId)` =
  `min(parallel_slots, floor(assigned_operators / operators_per_slot))`;
  `operators_per_slot===0` ⇒ `parallel_slots` (full automation).
- [ ] **Step 5.2:** `capacityPerHour(station, processId, shiftId)` =
  `3600 / takt_seconds × effectiveSlots(...)`.
- [ ] **Step 5.3:** `shiftAvailability(shifts, shiftId)` = staffed fraction of day.
- [ ] **Step 5.4:** `effectiveThroughput(...)` = `capacityPerHour × availability`.
- [ ] **Step 5.5:** `bottleneck(config)` = station/process with min throughput.
- [ ] **Step 5.6:** `roundTripTime(pool, segment)` =
  `load + length/loaded_speed + unload + length/return_speed`.
- [ ] **Step 5.7:** `poolThroughput(pool, segment)` =
  `count × units_per_trip × 3600/roundTripTime × availability` (AMR availability=1).
- [ ] **Step 5.8:** `holdThroughput(process)` = `slots / dwell_seconds`.
- [ ] **Step 5.9:** `peopleRequired(config, shiftId)` and `amrFleet(config)`.

**Tests:** assert each formula against the §6/§7.3/§7.4 worked numbers (e.g.
B=60s,1 slot ⇒ 60/hr; oven slots 3/dwell 300 ⇒ 36/hr; round-trip with empty
return). Property test: `capacityPerHour` is monotonic in operators.

**Acceptance:** every §15 derived row has a tested function; no formula is
duplicated outside this file.

---

## Phase 6 — Engine Core (Event-Driven Tick + Flow)

**Goal:** The deterministic heart (§5, §8). Pure reducer: `step(state) → state`.

**Files:**
- Create: `src/twin/engine/{clock,events,taktScheduler,flow,processApply,
  engine}.js` + tests.

- [ ] **Step 6.1 — clock.js:** an injected time source; `makeClock(0)` for
  synthetic, wall-clock adapter added in Phase 9. Engine reads time only via this.
- [ ] **Step 6.2 — events.js:** typed event records (`unit_created, unit_moved,
  station_started, station_completed, unit_exited, scrapped, shock_raised`) for
  the audit trail and UI.
- [ ] **Step 6.3 — taktScheduler.js (§5):** maintain `next_completion_time` per
  (station,process); `nextEventTime(state)` = min over staffed processes;
  `advanceTo(state, t)` applies all completions due at `t`, reschedules
  `+takt_seconds`, sets `∞` when input-starved.
- [ ] **Step 6.4 — flow.js (§8.1.3):** move units across segments.
  - Passive: advance at conveyor speed, respecting segment `capacity`.
  - Carrier: pick up from a dedicated pool, traverse loaded, drop, return empty;
    if destination buffer full, carrier **waits holding the unit** (occupies
    itself). FIFO pickup.
  - Station input buffers are FIFO; one process at a time per station.
- [ ] **Step 6.5 — processApply.js (§4.4.1, §8.1.5):** implement each kind:
  transform (reassign material), assembly (consume fungible kit per bom, emit new
  product unit tagged to product order, FIFO if shared), inspect (roll pass_rate;
  fail→scrap exit), label/seal (append enrichment), hold (occupy slot for
  dwell), store (occupy slot until pull).
- [ ] **Step 6.6 — engine.js:** orchestrate one step: `step(state) =
  flow → process completions → schedule`. Returns new state + emitted events.

**Tests (the crux — use fixtures):**
- linearLine: reproduce the §6 worked timeline exactly (Unit 1 exits ~t=100s,
  order done ~t=160s). Assert determinism (same seed ⇒ identical event log).
- Balanced vs imbalanced takt: WIP accumulates before the slow station; the fast
  downstream starves (idle).
- Segment capacity: filling a segment blocks the upstream station.
- assemblyLine: assembly waits for a full kit; emits one product; partial kit
  stalls; inspect routes ~10% to scrap.

**Acceptance:** the worked example matches to the second; all flow/process kinds
have a passing test; event log is reproducible.

---

## Phase 7 — Pull Release, Deadlock, Aggregation

**Goal:** Close the control loop (§6, §8.1.1, §8.1.6, §8.1.7).

**Files:**
- Create: `src/twin/engine/{releaseGovernor,deadlock,aggregator}.js` + tests.

- [ ] **Step 7.1 — releaseGovernor.js (§6):** admit a unit from a pending order
  only when the bottleneck station can accept one; spawn the unit lazily, set its
  `next_process` from the order sequence. Caps WIP.
- [ ] **Step 7.2 — deadlock.js (§8.1.6):** build the "waiting-for" graph each
  step; detect cycles (station↔buffer↔carrier↔assembly-kit). On detection emit a
  `shock_raised` event describing the cycle; do **not** auto-divert.
- [ ] **Step 7.3 — aggregator.js (§7.4, §8.1.7):** count `units_completed` at
  ship exits, `scrap` at scrap exits; mark orders complete or short; compute live
  `peopleRequired`, `amrFleet`, per-segment carrier `utilization`, and per-buffer
  fullness for the heatmap.

**Tests:**
- Over-release without the governor ⇒ buffers overflow and deadlock; with the
  governor ⇒ WIP bounded, no deadlock.
- Construct a deliberate circular wait ⇒ exactly one `shock_raised` with the
  correct cycle members.
- assemblyLine with 90% pass ⇒ order reports shortfall after scrap; headcount and
  utilization match the derived formulas.

**Acceptance:** the pull loop is provably deadlock-bounded on the fixtures;
aggregates equal the Phase 5 derived values.

---

## Phase 8 — Hybrid Time / Mode (Twin + Fork)

**Goal:** §10 — live twin and a sealed, rewindable fork.

**Files:**
- Create: `src/twin/mode/{snapshot,twin,fork}.js` + tests.

- [ ] **Step 8.1 — snapshot.js:** immutable, versioned, copy-on-write checkpoint
  of engine state.
- [ ] **Step 8.2 — twin.js:** drives the engine on a wall-clock adapter; supports
  **pause-and-apply** config edits (freeze → apply new `FactoryConfig` → resume)
  (§ decision 11).
- [ ] **Step 8.3 — fork.js:** clone a snapshot, run on a synthetic clock; assert
  **one-way isolation** — a fork never writes back to the twin and never triggers
  external side-effects (none exist, but the boundary is enforced in code).

**Tests:** fork diverges from twin without mutating it; rewind to a snapshot
reproduces the exact prior event log; pause-apply-resume preserves in-flight
units per the § "pause and apply" rule.

**Acceptance:** twin and fork run the same engine; isolation test passes.

---

## Phase 9 — UI Integration (R3F)

**Goal:** Wire engine state into the existing Three.js scene and add the editors
and readouts (§11 UI row). Reuse existing `src/scene/*` and `src/components/*`.

**Files:**
- Create: `src/twin/ui/{TwinCanvas,TrackEditor,CarrierPoolPanel,
  SchemaMatrixPanel,ProcessForm,WipHeatmap,HeadcountPanel,ShockConsole,
  SimControls}.jsx`.
- Modify: `src/App.jsx` (mount the v2 twin view), reuse `src/scene/PathRouter.js`
  for waypoint geometry.

- [ ] **Step 9.1 — TwinCanvas:** render stations (with **modifiable dimensions**),
  tracks, carriers, and units from engine state each frame (lerp positions like
  the existing `ParticleStream`).
- [ ] **Step 9.2 — ProcessForm (§4.4.2):** kind-driven form showing only the
  relevant 1–2 fields, with a **live derived readout** (throughput = slots/dwell,
  etc.). No raw `capacity_per_hour` field.
- [ ] **Step 9.3 — SchemaMatrixPanel (§9):** on machine click, show the
  CRUD × {SAP,MES,WMS,Noviga} schema-impact table.
- [ ] **Step 9.4 — TrackEditor / CarrierPoolPanel:** author nodes, segments,
  per-junction material rules, and dedicated carrier pools (kind, count, timing).
- [ ] **Step 9.5 — WipHeatmap + HeadcountPanel:** visualize buffer fullness /
  starvation and live people-required + AMR fleet + carrier utilization.
- [ ] **Step 9.6 — ShockConsole:** list `shock_raised` events; let the operator
  resolve (pull a unit, open overflow, disable a track).
- [ ] **Step 9.7 — SimControls:** play/pause/step/speed for the twin; fork +
  rewind for what-if; pause-and-apply for config edits.

**Tests (Playwright, extend `test/e2e`):** load a fixture, run the sim, assert
units move and a bottleneck heatmap appears; edit a takt via pause-and-apply and
see throughput change; open the schema matrix on click.

**Acceptance:** the golden path runs in-browser; editing config changes behavior
live; no hardcoded numbers in any form (all fields trace to §15).

---

## Cross-Cutting: Definition of Done

- [ ] Engine layer has **no** imports from `ui/` or React; verified by a lint/test
  guard.
- [ ] Every §15 derived value is computed in `derive.js` and nowhere else.
- [ ] `npm test` green (unit); `npm run test:e2e` green (Playwright).
- [ ] The §6 worked example is reproduced to the second by a unit test.
- [ ] Config validator rejects all five broken-fixture variants with precise msgs.
- [ ] Design doc and this plan stay in sync — update §N references if either moves.

---

## Sequencing & Dependencies

```
0 Scaffold
└─1 Domain ──2 Network ──3 Fixtures ──4 Validator
                                   └──5 Derive
                                        └──6 Engine core
                                             └──7 Pull/Deadlock/Aggregate
                                                  └──8 Twin/Fork
                                                       └──9 UI
```

Phases 1–8 are pure and fully unit-testable headless; only Phase 9 needs a
browser. Land each phase behind its tests before starting the next.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Engine logic leaks into UI | Strict layer rule + import guard test (DoD) |
| Non-determinism (Map order, time) | Seeded ids; event-driven clock; sort event ties |
| Assembly kitting deadlock surprises | Covered by Phase 7 deadlock test on assemblyLine |
| Hidden magic numbers creep back | §15 ledger is the gate; derive.js is the only home |
| Scope creep (rework loops, shared pools, multi-path) | Explicitly deferred (§13); DAG + dedicated-pool only in v1 |
