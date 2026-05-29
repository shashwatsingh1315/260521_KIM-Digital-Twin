---
status: PROPOSED
milestone: engine-core / part 6C
branch: claude/relaxed-allen-nqZWs
depends_on: Phases 0–5 + engine skeleton (committed)
---

# Factory Digital Twin v2 — Engine Flow (Part 6C)

## Goal

Make the engine **actually run** the two committed fixtures end-to-end,
deterministically, and reproduce the §6 takt-balanced timeline to the second.
After this part:

```js
import { runTwin } from 'src/twin';
const result = runTwin(makeLinearLineFixture());
// result.summary.orders_completed === 1
// Unit exits spaced exactly 60s apart (= bottleneck B takt)
```

**In scope:** taktScheduler · passive flow + buffer physics · processApply
(transform/inspect/label/seal/hold/store) · pull release governor · order
aggregator · real event loop wired through `engine.js`.

**Deferred to a follow-up part (6D/7B):** carrier round-trip transport physics,
the deadlock detector + ShockEvent emission. *Justification:* both fixtures are
passive-conveyor only and contain no carriers, so neither feature is testable
yet without inventing a new fixture. Keeping them out makes this part small,
shippable, and fully provable on the fixtures we have.

---

## Prerequisite (structural fix): bind stations to the network

**Problem found.** Fixtures define stations and a track topology *separately*.
Nothing says which node a station sits at, so the engine cannot route a unit to a
station. The validator's `checkDeadEnds` already gestures at a `${id}_input`
convention, but the fixtures don't follow it.

**Resolution (binding decision).** One node per station. A `Station` gains a
required `node_id` (its single network port, per §7.2 "station port").

- A unit arriving at `node_id` (via the inbound segment) enters that station's
  **input buffer**.
- On process completion the unit is placed into the station **output buffer**,
  which drains onto the **outbound segment leaving `node_id`**.
- `intake` nodes are pure **sources** (release governor injects units there; no
  station). `ExitNode`s are **sinks**.
- A segment therefore means "travel from the thing at `from_node_id` to the thing
  at `to_node_id`." Exactly one outbound segment per station node in v1 (linear/
  DAG); divergence routing stays a later feature.

**Files touched (revises committed Phase 2/3 — necessary, low-risk):**
- `network/station.js` — add required `node_id`; `makeFactoryConfig` validates it
  references a real node and that the node is not also an intake/exit.
- `engine/validator.js` — `checkDeadEnds` uses `station.node_id` (drop the string
  convention).
- `fixtures/linearLine.js`, `fixtures/assemblyLine.js` — re-topologize to
  one-node-per-station (see canonical layout below). Update `*.test.js` and
  `network.test.js` for the new `node_id` field.

### Revised linearLine topology (canonical worked example)

```
n_intake(intake) ──s_in_a(10m)──► n_a[Station A: heat 30s]
n_a ──s_a_b(20m)──► n_b[Station B: treat 60s ◄BOTTLENECK]
n_b ──s_b_c(15m)──► n_c[Station C: cool 20s]
n_c ──s_c_ship(10m)──► ship(exit)
```
All segments are conveyors at **60 m/min (= 1 m/s)**, so `travel_seconds =
length_m`. Stations are single-slot, manned (1 operator/slot).

---

## The §6 canonical timeline (what the headline test asserts)

With the layout above, the deterministic schedule is fully determined. The test
**computes expected times from fixture constants** (no magic literals) and
asserts the engine matches each to the second.

| Unit | intake→A | A heat | A→B | B treat | B→C | C cool | C→ship | **exits** |
|------|---------|--------|-----|---------|-----|--------|--------|-----------|
| 1 | 0–10 | 10–40 | 40–60 | 60–120 | 120–135 | 135–155 | 155–165 | **165** |
| 2 | — | 40–70 | 70–90 | **120**–180 | 180–195 | 195–215 | 215–225 | **225** |
| 3 | — | 70–100 | 100–120 | **180**–240 | 240–255 | 255–275 | 275–285 | **285** |

**Provable properties (the acceptance crux):**
1. Unit 1 exits at **t=165**.
2. Inter-exit spacing is **exactly 60 s** (165 → 225 → 285) — proves the line is
   paced by bottleneck B (`treat`, 60 s), not by A (30 s) or C (20 s).
3. Order `ORD1` is marked `completed` at **t=285** (3 good units shipped).
4. Station C **starves** between units (idle 155→195, 215→255) and B is the only
   station running back-to-back — the takt-imbalance signal of §8.2.
5. Determinism: same seed ⇒ byte-identical sorted event log across two runs.

Units 2 and 3 *wait in B's input buffer* (arrive n_b at t90 / t120, but B is busy
until t120 / t180) — this is the buffer-physics path, exercised for free.

---

## Work items (ordered; each lands behind its tests)

### 1. `engine/taktScheduler.js` (§5)
Per-station processing state and the next-event clock.
- `makeScheduler(config)` → tracks, per station, `{ busy, current_unit,
  completion_time, process_id }` for each of its `parallel_slots`.
- `nextEventTime(state)` = `min` over staffed, busy slots of `completion_time`
  (`Infinity` if all idle/starved).
- `start(state, stationId, unit, now)` — claim a free slot, set
  `completion_time = now + takt_seconds` (takt from `station.processes`).
- `dueCompletions(state, t)` — slots whose `completion_time === t`, deterministic
  order (sort by station id then slot index).
- **Tests:** min-event selection; back-to-back rescheduling = `now + takt`;
  starvation ⇒ `Infinity`; multi-slot parallelism.

### 2. `engine/flow.js` (§8.1.3, passive only)
Segment travel + buffer movement. **No geometry** — distance is `segment.length_m`.
- A unit placed on a passive segment has `arrival_time = now + length_m /
  (speed_m_per_min/60)`; it occupies one of the segment's `capacity` slots until
  it lands.
- `nextArrivalTime(state)` = min pending segment arrival (feeds the event clock
  alongside the scheduler).
- On arrival: if the destination is a **station node**, push to that station's
  FIFO input buffer (respect `entry_buffer_capacity`; if full, the unit **waits on
  the segment**, blocking it). If the destination is an **exit**, hand to the
  aggregator.
- Output-buffer → outbound-segment hand-off: a completed unit enters the segment
  leaving its node when the segment has a free capacity slot; else it waits in the
  output buffer (back-pressure).
- **Tests:** travel time = length/speed; conveyor capacity blocks upstream when
  full; FIFO order preserved; arrival routes to station vs exit correctly.

### 3. `engine/processApply.js` (§4.4.1)
Pure per-kind effect applied at a slot's completion. Returns the post-process
unit(s) and any emitted events; never does I/O.
- `transform`: `unit.material = output_material`; merge `adds_enrichments`;
  advance `next_process`.
- `inspect`: **seeded** roll (`makeRng(seed)`, see item 6) vs `pass_rate`; pass →
  advance; fail → route to a scrap exit (`scrapped` event), aggregator counts
  scrap.
- `label`/`seal`: append enrichment only; advance.
- `hold`: occupy a slot for `dwell_seconds` (scheduler uses `dwell` instead of
  `takt`); `slots` bounds concurrent residents. `store`: occupy until a downstream
  pull (release of buffer space). Throughput ≈ `slots/dwell` (from `derive.js`).
- `assembly`: station waits until its input buffer holds a complete fungible kit
  (per `bom` counts, matched by material type); consume the kit units; **emit one
  product unit** (`makeUnit`) tagged to the product order, `material =
  output_material`, enrichments per `enrichment_inherit`. FIFO if multiple product
  orders share the station.
- `next_process` advancement reads the unit's parent `order.process_sequence`.
- **Tests:** transform reassigns material + advances; inspect pass/fail is
  deterministic per seed; label appends; hold occupies for dwell; **assembly waits
  for a full {PCB,CASING} kit, consumes 2, emits 1 DEVICE**.

### 4. `engine/releaseGovernor.js` (§6)
Pull-gated lazy unit creation, capping WIP.
- Bottleneck from `derive.bottleneck(config)`.
- WIP cap is **derived**, not hardcoded: `bottleneck.parallel_slots +
  bottleneck_station.entry_buffer_capacity`. Admit the next pending unit from an
  arrived order only while `(released − passed_bottleneck) < cap`.
- On admit: `makeUnit(...)`, set `next_process = order.process_sequence[0]`, place
  at the order's intake node, increment `order.units_created`, emit `unit_created`.
- **Tests:** with a deliberately tiny `entry_buffer_capacity` + many units,
  in-flight count never exceeds the derived cap (governor-on); a governor-off
  control over-fills the buffer — proving the governor is what bounds WIP.

### 5. `engine/aggregator.js` (§7.4, §8.1.7)
Order completion + live derived readouts.
- On a unit reaching a **ship** exit: `order.units_completed++`, emit
  `unit_exited`. On **scrap**: `order.scrap++`. Mark order `completed` when good
  units reach `quantity`, else `short` once all its units have left the floor.
- Expose `summary`: per-order status, `peopleRequired`, `amrFleet`, per-segment
  occupancy — all sourced from `derive.js`, never recomputed inline.
- **Tests:** linearLine → ORD1 `completed`, 3 shipped, 0 scrap; assemblyLine at
  seed where ~1/10 fails → `units_completed + scrap === units_created` and order
  reported `short`.

### 6. Determinism plumbing
- `util/rng.js`: `makeRng(seed)` — a small deterministic PRNG (e.g. mulberry32).
  Only `inspect` consumes it in this part. Seed flows `runTwin(cfg,{seed})` →
  engine → processApply.
- **Test:** same seed ⇒ identical inspect pass/fail sequence; different seed ⇒
  different (but still deterministic) sequence.

### 7. Wire the real loop in `engine/engine.js`
Replace the skeleton loop with the true step:
```
while (orders pending/in-progress && time < maxTime):
  governor.tryAdmit(...)                       // pull release
  t = min(scheduler.nextEventTime, flow.nextArrivalTime)
  if t === Infinity: break                     // (idle = deadlock candidate; 6D)
  advance clock to t
  flow.applyArrivals(t)                        // segment → buffer / exit
  for slot in scheduler.dueCompletions(t):     // process completions
      processApply(...) → output buffer / scrap
      scheduler frees slot
  startEligible(...)                           // pull from input buffers into free slots
  snapshot state; collect events
finalize order statuses; return {states, events: sortEvents(...), summary}
```
- Keep `runTwin`'s existing public shape `{states, events, summary}` (already
  exported from `index.js`).
- **Tests (headline):** the §6 timeline table above, asserted to the second from
  fixture constants; determinism (two runs identical); assemblyLine runs to
  completion with correct ship/scrap accounting.

---

## Definition of Done (this part)

- [ ] `npm test` green; all new suites under `src/twin/engine/**` + revised
      fixture/network tests.
- [ ] `runTwin(linearLine)` reproduces the §6 timeline **to the second**; exits
      spaced exactly 60 s; ORD1 `completed` at t=285.
- [ ] `runTwin(assemblyLine)` completes; assembly emits one DEVICE per
      {PCB,CASING} kit; inspect scrap accounted so
      `units_completed + scrap === units_created`.
- [ ] Determinism: identical seed ⇒ identical sorted event log (asserted).
- [ ] Pull governor bounds WIP to the **derived** cap (tiny-buffer test); §15 grep
      guard still passes (no `3600 /` or `capacity_per_hour` outside `derive.js`).
- [ ] Layer-purity guard still passes (no `engine/**` import of `react`/`ui`).
- [ ] No new hardcoded constants; existing app / `src/engine` / `src/data`
      untouched.

## Sequencing

```
0 station↔node binding + fixture re-topo  (prerequisite)
      └► 1 taktScheduler ─┐
         2 flow ──────────┼─► 7 engine loop ─► headline timeline test
         3 processApply ──┤
         6 rng ───────────┘
         4 releaseGovernor ─► WIP-bound test
         5 aggregator ──────► completion/scrap test
```

## Explicitly deferred (next part, 6D/7B)
- Carrier round-trip transport physics (`flow.js` carrier branch) + a carrier
  fixture to test it.
- Deadlock detector (waiting-for graph, cycle detection) + `shock_raised`
  emission; until then an unexpected all-idle state with work remaining simply
  ends the run (surfaced in `summary` as incomplete, not as a shock).
- Hybrid twin/fork (snapshot + COW) and all UI work.
```
