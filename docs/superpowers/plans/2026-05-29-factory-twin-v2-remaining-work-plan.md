---
status: PROPOSED
milestone: complete engine-core (7) → twin/fork (8) → UI (9)
branch: claude/relaxed-allen-nqZWs
depends_on: Phases 0–6 + 6C (committed; 146 tests green)
---

# Factory Digital Twin v2 — Remaining Work Plan

## Where we are

Phases 0–6 plus the 6C engine-flow slice are done: the engine runs both fixtures
deterministically and reproduces the §6 timeline to the second (146 tests green).

**What is genuinely left** (audited against the original 10-phase plan + design doc):

| Area | State | Source of truth |
|---|---|---|
| Capacity back-pressure (segment + buffer blocking) | **not enforced** — flow.js never checks `capacity`/`entry_buffer_capacity` | §7.1, §8.1.3, §8.2 |
| Carrier transport physics | **deferred from 6C** — flow.js is passive-only | §7.3, §8.1.3 |
| Deadlock detector (7.2) | **not built** — `shock_raised` type exists, never emitted | §8.1.6 |
| Aggregator live readouts (7.3 tail) | **partial** — no peopleRequired / amrFleet / utilization / buffer-fullness | §7.4, §8.1.7 |
| Pull/deadlock acceptance tests | **missing** — over-release-overflow, kitting-stall shock | plan §7 |
| Hybrid twin/fork + pause-and-apply (Phase 8) | **not built** | §10, decision 11 |
| UI integration (Phase 9) | **not built** | §11 UI row |

This plan sequences the rest into four shippable parts, each headless-and-tested
where possible. **Part 9 (UI) is outlined, not fully specified** — it gets its own
detailed planning pass once the engine API below is frozen.

---

## Pre-step (housekeeping): untrack node_modules

`node_modules/` is committed (15,133 files), so the vitest cache reappears as a
dirty file after every run and the repo is bloated. The `.gitignore` already added
does not untrack what is already indexed.

- `git rm -r --cached node_modules` then commit. (Working tree keeps the files;
  only the index entry is removed.) One small commit, do this first.

---

## Part A — Capacity back-pressure + carrier transport (§7.1, §7.3, §8.1.3)

The current engine treats buffers and segments as unbounded. Real block dynamics
(§8.2) and any meaningful deadlock require finite capacity that actually blocks.
Carriers then layer on top as the second transport class.

### A1. Enforce capacity back-pressure (passive)
**Files:** `engine/flow.js`, `engine/engine.js` (+ tests).
- Segment occupancy ≤ `segment.capacity`. A completed unit may only launch onto an
  outbound segment that has a free slot; otherwise it **waits in the station output
  buffer** (back-pressure) and the slot is *not* freed for new work until it drains.
- Station input buffer occupancy ≤ `entry_buffer_capacity`. On arrival, if the
  destination input buffer is full, the arriving unit **waits on its segment**
  (the segment slot stays occupied), blocking upstream.
- Add an output-buffer drain step to the loop that retries blocked hand-offs each
  event tick.
- **Tests:** tiny `capacity`/`entry_buffer_capacity` + many units ⇒ upstream blocks
  (occupancy never exceeds the limit); §6 timeline unchanged (capacities are loose
  there, so behavior is identical — regression guard).

### A2. Carrier round-trip physics
**Files:** `engine/carriers.js` (new) + `engine/flow.js` carrier branch + tests.
- Per carrier-served segment, carrier state from its dedicated pool: each of
  `count` carriers is `idle | loaded-traversing | unloading | returning`.
- A **FIFO pickup queue** at the segment's source. A free carrier takes the next
  unit, becomes busy for `round_trip_time` (use `derive.roundTripTime`), drops the
  unit at the destination at `now + load + length/loaded_speed`, then is unavailable
  until `+ unload + length/return_speed` (empty return).
- If the destination buffer is full at drop time, the carrier **waits holding the
  unit** (stays busy, does not free) — shrinks effective fleet; this is a deadlock
  input for Part B.
- Shift-gating: people/forklift pools only advance while staffed; AMR pools 24/7.
- `nextEventTime` for the engine now also considers carrier drop/free times.
- **Tests:** travel uses full round trip (loaded + empty); `count` carriers cap
  concurrent in-flight units; pickup queue is FIFO; AMR ignores shift, person pool
  pauses off-shift; throughput matches `derive.poolThroughput`.

### A3. Carrier fixture
**Files:** `fixtures/carrierLine.js` + test.
- A linear line where one segment is `{class:'carrier', pool_id}` served by a small
  AMR pool, sized so the carrier is *not* the bottleneck (clean timeline) plus a
  variant sized so it *is* (utilization ≥ 1, queue grows). Drives A2 + Part B tests.
- **Accept:** passes the validator; `runTwin` completes; carrier-bottleneck variant
  shows a growing pickup queue.

---

## Part B — Deadlock detector + aggregator readouts (Phase 7 tail)

### B1. deadlock.js (§8.1.6)
**Files:** `engine/deadlock.js` + test; wire into `engine.js` at the stall point
(replace the bare `if (t === Infinity) break`).
- Each step (or on stall), build the **waiting-for graph**: station→(output segment
  it's blocked on)→(downstream buffer)→(station draining it); carrier→(dest buffer);
  assembly station→(missing component material line). Nodes are stations, buffers,
  segments, carrier pools, and assembly-kit waits.
- Detect a cycle (DFS). On a cycle, emit **one** `shock_raised` with the ordered
  cycle members and a reason; **do not auto-divert** (operator resolves later in UI).
- Distinguish *deadlock* (cycle) from benign *starvation* (no work left, no cycle) —
  only the former raises a shock; the latter ends the run normally.
- **Tests:** assemblyLine with one component intake throttled ⇒ partial-kit buffer
  fills ⇒ exactly one `shock_raised` naming the assembly station + lagging line;
  a healthy run raises zero shocks.

### B2. aggregator.js live readouts (§7.4, §8.1.7)
**Files:** `engine/aggregator.js` (+ test).
- Extend `computeSummary` (and expose a per-step `liveMetrics(state)`):
  `peopleRequired(shiftId)`, `amrFleet`, per-segment carrier `utilization`
  (= demand/`poolThroughput`), per-buffer fullness ratio — **all sourced from
  `derive.js`**, nothing recomputed inline.
- **Tests:** on carrierLine, aggregate `utilization` matches `derive` to the digit;
  `peopleRequired` equals Σ staffing + labor-carrier counts; buffer fullness in [0,1].

### B3. Pull-loop acceptance tests (plan §7)
**Files:** `engine/pullLoop.test.js`.
- Over-release **without** the governor (admit all units at t0, bypassing the cap)
  on a tiny-buffer line ⇒ overflow/deadlock shock; **with** the governor ⇒ WIP
  bounded to the derived cap, zero shocks, order completes.
- **Accept:** the pull loop is provably deadlock-bounded on the fixtures.

**End of Part B = the original engine-core milestone is fully met** (every Phase 0–7
acceptance box ticked, including the deadlock and over-release tests that were
deferred).

---

## Part C — Hybrid time/mode: Twin + Fork (Phase 8, §10)

All headless and unit-testable. `runTwin` stays the batch entry; this adds the
*stepwise/live* and *forkable* modes around the same pure step function.

### C1. Refactor engine to an explicit step
**Files:** `engine/engine.js` → expose `initState(config,{seed})` and
`step(state) → {state, events}` as pure building blocks; `runTwin` becomes a thin
loop over `step`. Pure refactor, existing tests must stay green.

### C2. snapshot.js
**Files:** `engine/mode/snapshot.js` + test.
- Immutable, versioned, structurally-shared checkpoint of engine state
  (deep-freeze; copy-on-write on next `step`). `snapshot(state) → token`,
  `restore(token) → state`.
- **Test:** restore reproduces the *exact* subsequent event log (rewind determinism).

### C3. twin.js (wall-clock adapter + pause-and-apply)
**Files:** `engine/mode/twin.js` + test.
- Drives `step` against an injected time source; **pause-and-apply** (decision 11):
  freeze → swap in an edited `FactoryConfig` (re-validate) → resume, preserving
  in-flight units/buffers/slots. Clock is still injected (a wall-clock adapter is a
  thin shim; tests use a fake clock — no real `Date.now()` in the engine).
- **Test:** pause → change a takt → resume; in-flight units preserved; downstream
  throughput changes to match the new takt.

### C4. fork.js (sealed one-way fork)
**Files:** `engine/mode/fork.js` + test.
- Clone from a snapshot onto a synthetic clock; **one-way isolation** enforced in
  code — a fork never mutates the twin's state object.
- **Test:** fork diverges (different seed/edit) while the twin snapshot is byte-for-
  byte unchanged.

**Accept:** twin and fork run the same pure engine; isolation + rewind tests pass.

---

## Part D — UI Integration (Phase 9, §11) — OUTLINE ONLY

This is a large, browser-bound chunk and qualitatively different from the headless
engine work. **It gets its own detailed planning pass after Parts A–C freeze the
engine's public surface** (`runTwin`, `step`, `liveMetrics`, snapshot/twin/fork,
`state.units[].location`, segment/station ids). Recorded here so we build the
engine to expose what the UI needs; reuse map already in the architecture doc.

Planned components (R3F, reusing `src/scene/*`):
- **TwinCanvas** — render stations (modifiable dims), tracks, carriers, units from
  `state` each frame (lerp like the existing `ParticleStream`).
- **ProcessForm** (§4.4.2) — kind-driven, shows only the 1–2 relevant fields with a
  live derived readout (`throughput = slots/dwell`, etc.); never a raw
  `capacity_per_hour` field.
- **SchemaMatrixPanel** (§9) — CRUD × {SAP,MES,WMS,Noviga} on machine click.
- **TrackEditor / CarrierPoolPanel** — author nodes/segments/material-rules and
  dedicated pools.
- **WipHeatmap + HeadcountPanel** — buffer fullness/starvation; live people-required,
  AMR fleet, carrier utilization (straight from B2's `liveMetrics`).
- **ShockConsole** — list `shock_raised`; operator resolves (pull unit, open
  overflow, disable track).
- **SimControls** — play/pause/step/speed; fork+rewind; pause-and-apply.
- **Tests:** Playwright golden path — load fixture, run, see units move + bottleneck
  heatmap; edit a takt via pause-and-apply and see throughput change; open schema
  matrix on click.

---

## Sequencing

```
pre-step (untrack node_modules)
  └─► Part A1 back-pressure ─► A2 carriers ─► A3 carrier fixture
        └─► Part B1 deadlock ─► B2 aggregator readouts ─► B3 pull-loop tests
              │  (★ engine-core milestone fully complete here)
              └─► Part C1 step refactor ─► C2 snapshot ─► C3 twin ─► C4 fork
                    └─► Part D UI  (separate detailed planning pass)
```

Land each part behind its tests before the next. Parts A–C are fully headless and
unit-testable; only Part D needs a browser (Playwright untouched until then).

## Definition of Done (Parts A–C; the engine is then "complete")

- [ ] `node_modules` untracked; repo clean after a test run.
- [ ] Capacity back-pressure enforced: occupancy never exceeds `capacity` /
      `entry_buffer_capacity`; §6 timeline unchanged (regression).
- [ ] Carrier round-trip physics (loaded + empty) with FIFO pickup, shift-gating,
      and full-buffer hold; throughput matches `derive.poolThroughput`.
- [ ] Deadlock detector emits exactly one correct `shock_raised` on a constructed
      circular wait / kitting stall; zero on healthy runs.
- [ ] Live readouts (peopleRequired, amrFleet, utilization, buffer fullness) equal
      `derive.js` values; §15 grep guard still passes.
- [ ] Over-release overflows; governor bounds WIP to the derived cap.
- [ ] snapshot rewind reproduces the exact event log; pause-and-apply preserves
      in-flight units; fork never mutates the twin.
- [ ] All new suites green; layer-purity guard still passes.
