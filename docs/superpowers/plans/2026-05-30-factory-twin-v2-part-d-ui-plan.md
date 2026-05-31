---
status: HARDENED
milestone: Part D — UI Integration (Phase 9)
branch: claude/relaxed-allen-nqZWs
depends_on: Parts A–C complete (205 tests green, engine surface frozen)
date: 2026-05-30
critics: 5-angle adversarial review applied (scope/simplicity/reuse/verification/correctness)
---

# Factory Digital Twin v2 — Part D: UI Integration Plan (Hardened)

## Scope Boundary (post-critic)

**In scope for Part D (this plan):**

| Sub-phase | Deliverable |
|-----------|-------------|
| D1 | `useTwin` hook — `initState`/`step` driven, `restore()` rewind |
| D2 | `twinLayout.js` — DAG → positions; `unitPositions()` |
| D3 | `TwinCanvas` — 3D scene rendering |
| D3.5 | `TwinApp` + route (moved earlier so D4+ is E2E testable) |
| D4 | `SimControls` + `WipHeatmap` + `HeadcountPanel` |
| D5 | `ShockConsole` |
| D6 | `ProcessForm` (pause-and-apply) |
| D10 | Playwright golden-path tests |

**Deferred to Part E:**

| Deferred item | Reason |
|---------------|--------|
| `SchemaMatrixPanel` | No runtime simulation effect; documentation-only panel |
| `TrackEditor` | Full graph editor is a separate product milestone, not wiring-engine-to-browser |
| `CarrierPoolPanel` | Depends on TrackEditor being done first |
| `ForkPanel` (what-if modal) | UI scaffolding undefined; defer alongside fork UI |

**Non-negotiable invariants:**
- Existing M800 app at `/` stays **untouched**.
- `src/twin/engine/**` never imports `react`/`ui`/DOM (layerPurity.test.js guard).
- All §15 derived values stay in `derive.js`. No `3600/` outside it.
- `ProcessForm` never renders a `capacity_per_hour` input field.

---

## Frozen Engine Public Surface

The UI may import only:

```
src/twin/engine/engine.js        → initState, step
src/twin/engine/aggregator.js    → liveMetrics
src/twin/engine/mode/snapshot.js → snapshot, restore
src/twin/engine/mode/twin.js     → makeTwin  (used only for simple non-rewind flows)
src/twin/engine/events.js        → EVENT_TYPE
src/twin/engine/validator.js     → validateFactoryConfig
src/twin/engine/derive.js        → effectiveSlots, capacityPerHour, bottleneck, ...
src/twin/index.js                → all domain/network factory functions
```

**Key state fields read by the UI:**
- `state.flowState.stationBuffers: Map<stationId, Unit[]>`
- `state.flowState.segmentUnits: Map<segId, {unit, arrival_time}[]>`
- `state.flowState.segmentHeld: Map<segId, {unit}[]>`
- `state.carrierState.pools: Map<poolId, {pool, seg, pickupQueue, carriers[]}>`
- `state.govState.wipCount`
- `state.clock.now() → seconds`
- `liveMetrics(config, flowState, carrierState, shiftId) → {peopleRequired, amrFleet, carrierUtilization, bufferFullness}`

**Note on `unit.location`:** The domain `Unit` object has a `location.type` field
initialized to `'pending'` but not updated by the engine — the engine maintains unit
positions through `flowState` maps exclusively. `unitPositions()` correctly scans
`flowState` maps rather than consulting `unit.location`.

---

## Reuse Map (post-critic corrections)

### Fully reusable, no changes

| File | How used in Part D |
|------|--------------------|
| `src/scene/MachineMeshes.jsx` | `StationMesh` wraps it; passes `fillRatio` from `bufferFullness` |
| `src/scene/SceneAtmosphere.jsx` | Mounted as-is in `TwinCanvas` |
| `src/scene/ScenePostFX.jsx` | Mounted as-is in `TwinCanvas` |
| `src/scene/SetDressing.jsx` | Mounted as-is in `TwinCanvas` |
| `src/scene/BuildingShells.jsx` | Mounted as-is for factory shell geometry |
| `src/scene/PathRouter.js` | `pointAt`, `arcLengths` for segment path lerp |
| `src/materials/factoryMaterials.js` | `fillStateColor(ratio)` (confirmed exported) for heatmap; **not** `fillStateMat` (verify export name before use) |

### Reusable with parameterization (small change to existing file)

| File | Change needed |
|------|--------------|
| `src/scene/LocationNode.jsx` | Add optional `fillRatio` prop so it can be driven by `bufferFullness` without reading `simState`; keep all existing behavior (GLB models, selection ring, buffer label). This is a ~10-line change — do NOT clone into `TwinStationNode.jsx`. |
| `src/layout/autoLayout.js` | Generalize: accept any array of `{id, ...}` nodes + any edges, not just M800 `location_node`. `computeTwinLayout(nodes, edges, overrides)` becomes a parameterized call. Then `computeLayout()` (M800) and `computeTwinLayout()` (twin) share the same algorithm. |

### Adapt (thin wrapper, same component)

| File | Adaptation |
|------|-----------|
| `src/scene/ParticleStream.jsx` | Create `UnitStream.jsx` that pre-computes `{id, pos3d: {x,y,z}}[]` from `unitPositions()` and passes it as a pre-positioned array. Internally reuses the `InstancedMesh` + `useFrame` pattern verbatim. |

### Not reused

| File | Reason |
|------|--------|
| `src/components/LayoutEditor.jsx` | Hardcodes `location_node` from m800_model.js and M800-specific leaf types; **cannot** be used as-is for TrackEditor (deferred to Part E anyway) |
| `src/components/FactoryTwin.jsx` | M800-specific orchestrator |
| `src/engine/useSimEngine.js` | Old probabilistic engine |

---

## Component Tree (Part D only)

```
src/twin/ui/
  TwinApp.jsx              ← top-level page (route: /twin)
  TwinProvider.jsx         ← Context: engineState, metrics, shocks, paused, done
  useTwin.js               ← Hook: initState/step lifecycle + RAF loop
  twinLayout.js            ← Pure: TrackNode DAG → {x,y,z}; unitPositions()
  TwinCanvas.jsx           ← R3F Canvas + OrbitControls + scene layers
    StationMesh.jsx        ← LocationNode adapter: fillRatio from bufferFullness
    TrackSegmentLines.jsx  ← Segment lines colored by occupancy
    UnitStream.jsx         ← InstancedMesh adapter from ParticleStream pattern
    CarrierAgents.jsx      ← InstancedMesh per carrier (idle/loaded/held)
  SimControls.jsx          ← Play/Pause/Step/Speed strip + Rewind button
  WipHeatmap.jsx           ← Per-station buffer fullness badges
  HeadcountPanel.jsx       ← peopleRequired / amrFleet / carrier utilization
  ShockConsole.jsx         ← shock_raised list + acknowledge
  ProcessForm.jsx          ← Kind-driven takt editor, pause-and-apply
  index.js                 ← Barrel: export { TwinApp, TwinProvider, useTwin }
```

---

## Data Flow (corrected)

```
FactoryConfig
      │
      ▼
useTwin(config, opts)          ← TwinProvider mounts this
  initState(config, opts)      ← creates initial engine state
  │
  │  RAF loop (in TwinProvider via useLayoutEffect + requestAnimationFrame)
  │  Per frame: advance sim by (wallDelta × speed), capped at MAX_STEPS_PER_FRAME
  │  After each step: compute metrics INSIDE the tick loop (same call, no race)
  │
  ├─ engineStateRef.current    → TwinCanvas reads per useFrame (no React re-render)
  ├─ metricsSnap (useState)    → panels read at ~10Hz (updated inside tick loop)
  ├─ shocks (useState)         → ShockConsole reads
  ├─ simTime (useState)        → SimControls display
  └─ paused / done (useState)  → SimControls, ProcessForm

Rewind:
  snapshot(engineStateRef.current)  → token (frozen)
  ...later...
  restore(token, config)            → engineStateRef.current = restored state
  (no makeTwin re-creation needed; useTwin drives step() directly)
```

### `useTwin` — corrected design

`useTwin` drives `initState`/`step` **directly** (not through `makeTwin`). This
gives full rewind support without needing a `replaceState` API on the twin handle.

```js
// src/twin/ui/useTwin.js
export function useTwin(config, opts = {}) {
  const engineStateRef = useRef(null);         // mutable engine state
  const speedRef       = useRef(1);
  const pausedRef      = useRef(false);
  const [simTime, setSimTime]   = useState(0);
  const [metrics, setMetrics]   = useState(null);
  const [shocks,  setShocks]    = useState([]);
  const [paused,  setPaused]    = useState(false);
  const [done,    setDone]      = useState(false);

  // Initialize (or re-initialize on config identity change).
  useEffect(() => {
    const { state, events: e0 } = initState(config, opts);
    engineStateRef.current = state;
    setSimTime(state.clock.now());
    setDone(false);
    setShocks([]);
    // Collect t=0 shocks from init events.
    const s0 = e0.filter(e => e.type === 'shock_raised');
    if (s0.length) setShocks(s0);
  }, [config]);             // only re-init when config identity changes

  // Called each RAF frame by TwinProvider.
  const advanceFrame = useCallback((wallDeltaSeconds) => {
    if (pausedRef.current || !engineStateRef.current) return;
    const state = engineStateRef.current;
    const targetSim = state.clock.now() + wallDeltaSeconds * speedRef.current;
    const MAX_STEPS_PER_FRAME = 500;            // prevent main-thread stall
    let steps = 0;
    const newShocks = [];

    while (steps++ < MAX_STEPS_PER_FRAME) {
      if (state.clock.now() >= targetSim) break;
      const result = step(state);
      // step() mutates state in place and returns same ref.
      for (const ev of result.events) {
        if (ev.type === 'shock_raised') newShocks.push(ev);
      }
      if (result.done) {
        setDone(true);
        break;
      }
    }

    // Compute metrics once per frame from the now-current state.
    const m = liveMetrics(config, state.flowState, state.carrierState);
    setSimTime(state.clock.now());
    setMetrics(m);
    if (newShocks.length) setShocks(prev => [...prev, ...newShocks]);
  }, [config]);

  const pause  = useCallback(() => { pausedRef.current = true;  setPaused(true); }, []);
  const resume = useCallback(() => { pausedRef.current = false; setPaused(false); }, []);
  const setSpeed = useCallback((s) => { speedRef.current = s; }, []);

  // Pause-and-apply: swap config while preserving in-flight state.
  // Caller must call pause() first.
  const applyConfig = useCallback((newConfig) => {
    if (!pausedRef.current) throw new Error('call pause() before applyConfig()');
    const v = validateFactoryConfig(newConfig);
    if (v.errors.length) throw new Error(`Invalid config: ${v.errors[0]}`);
    const s = engineStateRef.current;
    s.config        = newConfig;
    s.stationMap    = new Map(newConfig.stations.map(st => [st.id, st]));
    s.processMap    = new Map(newConfig.processes.map(p => [p.id, p]));
    s.nodeToStation = new Map(newConfig.stations.map(st => [st.node_id, st]));
    const intakeNodes = new Set(newConfig.nodes.filter(n => n.type === 'intake').map(n => n.id));
    s.intakeSegments = newConfig.segments.filter(sg => intakeNodes.has(sg.from_node_id));
    s.exitIds = new Set(newConfig.exits.map(e => e.id));
    s.flowState._config = newConfig;
    // Update metrics immediately with new config.
    setMetrics(liveMetrics(newConfig, s.flowState, s.carrierState));
  }, []);

  // Rewind: restore(token, config) → replace engine state in place.
  const rewind = useCallback((token) => {
    engineStateRef.current = restore(token, config);
    setSimTime(token.clockTime);
    setDone(false);
    pausedRef.current = false;
    setPaused(false);
  }, [config]);

  return {
    advanceFrame,
    pause, resume, setSpeed, applyConfig, rewind,
    simTime, metrics, shocks, paused, done,
    _engineState: () => engineStateRef.current,  // for snapshot + 3D scene
  };
}
```

### TwinProvider RAF loop (corrected)

```jsx
// src/twin/ui/TwinProvider.jsx
export function TwinProvider({ config, seed = 0, children }) {
  const twinHook = useTwin(config, { seed });
  const rafRef   = useRef(null);
  const lastTimeRef = useRef(null);

  useLayoutEffect(() => {
    function loop(now) {
      if (lastTimeRef.current !== null) {
        const delta = Math.min((now - lastTimeRef.current) / 1000, 0.1); // cap at 100ms
        twinHook.advanceFrame(delta);
      }
      lastTimeRef.current = now;
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);   // explicit cleanup — no ghost loops
      lastTimeRef.current = null;
    };
  }, [twinHook.advanceFrame]);              // re-wires when config changes

  return (
    <TwinContext.Provider value={{ config, twinHook }}>
      {children}
    </TwinContext.Provider>
  );
}
```

### Unit Position Computation (corrected)

`unitPositions()` returns plain `{x,y,z}` objects (NOT `THREE.Vector3`) so it
stays pure and browser-free (testable with vitest, no Three.js import):

```js
// twinLayout.js
// unitPositions(flowState, carrierState, config, nodePositions, now)
//   → Map<unitId, {x,y,z}>
//
// Segment units: lerp from fromNode to toNode at
//   t = (now - (arrival_time - travelTime)) / travelTime, clamped [0,1]
// Segment held:  toNode position (waiting at boundary)
// Station buffer: stationNode + small per-slot offset
// Carrier loaded: lerp from pool seg's fromNode to toNode based on drop_at
// Carrier held_at_dest: toNode position
```

R3F components call `new THREE.Vector3(p.x, p.y, p.z)` at render time.

### Routing (no React Router)

The app has no React Router dependency. Route to `/twin` via pathname check in
`main.jsx`:

```jsx
// src/main.jsx  (addition, ~4 lines)
const isTwin = window.location.pathname.startsWith('/twin');
ReactDOM.createRoot(document.getElementById('root')).render(
  isTwin ? <TwinApp /> : <App />
);
```

This requires zero new dependencies. Playwright test navigates to
`http://localhost:5173/twin`.

---

## Sub-phases (hardened)

---

### D1 — `useTwin` hook (headless)

**Files:**
- `src/twin/ui/useTwin.js`
- `src/twin/ui/useTwin.test.js`

**Tests (vitest + jsdom):**
1. `useTwin(cfg)` — `simTime` starts at 0
2. `advanceFrame(1.0)` — `simTime` advances > 0
3. `pause()` + `advanceFrame(1.0)` — `simTime` unchanged
4. `resume()` + `advanceFrame(1.0)` — `simTime` advances again
5. `done` becomes `true` after sufficient `advanceFrame` calls to complete linearLine
6. `applyConfig()` without `pause()` throws
7. `applyConfig()` while paused — `metrics` updates immediately without step
8. `rewind(token)` — `simTime` returns to `token.clockTime`; `done` resets to false
9. `advanceFrame` respects `MAX_STEPS_PER_FRAME` — never runs more than 500 steps per call
10. shock events accumulate in `shocks` array; cleared on re-init

**Required data-testid (none — headless hook, no DOM)**

**Accept:** 10 vitest tests green; no DOM/canvas required.

---

### D2 — `twinLayout.js` (pure position computation)

**Files:**
- `src/layout/autoLayout.js` — generalized to accept any node/edge arrays (small change)
- `src/twin/ui/twinLayout.js`
- `src/twin/ui/twinLayout.test.js`

**autoLayout.js generalization:**
```js
// New overload (backwards-compatible):
export function computeTwinLayout(nodes, edges, overrides = {})
// where nodes = [{id}], edges = [{from_node_id, to_node_id}]
// Same DAG-position algorithm as computeLayout; only the input shape differs.
```

**twinLayout.js exports:**
```js
computeTwinLayout(config, overrides)  // delegates to autoLayout.computeTwinLayout
loadTwinLayoutOverrides(configHash)   // localStorage get, max 10 entries, LRU-evict
saveTwinLayoutOverrides(configHash, overrides)
unitPositions(flowState, carrierState, config, nodePositions, now)
  // → Map<unitId, {x: number, y: number, z: number}>
```

**Tests (vitest):**
1. Linear 3-node config → nodes ordered with strictly increasing x
2. Override shifts one node; others at default positions
3. `unitPositions` — unit at midpoint of travel time → lerp fraction ~0.5, position midway
4. `unitPositions` — unit in `segmentHeld` → positioned at toNode
5. `unitPositions` — unit in `stationBuffer` → near station node position
6. `loadTwinLayoutOverrides` — 11th save evicts oldest (max 10)

**Required data-testid (none — pure functions)**

**Accept:** 6+ vitest tests green; no browser dependency; `unitPositions` returns
plain `{x,y,z}` objects, not `THREE.Vector3`.

---

### D3 — `TwinCanvas` (3D scene)

**Files:**
- `src/twin/ui/TwinCanvas.jsx`
- `src/twin/ui/UnitStream.jsx`
- `src/twin/ui/CarrierAgents.jsx`
- `src/twin/ui/TrackSegmentLines.jsx`
- `src/scene/LocationNode.jsx` — **modified**: add optional `fillRatio` prop
  (default undefined → existing behavior unchanged; when set, passes to
  `fillStateMat`/color; ~10-line addition, zero regression risk)

**TwinCanvas.jsx:**
```jsx
<Canvas>
  <SceneAtmosphere />
  <BuildingShells />
  <SetDressing />
  {config.stations.map(s => (
    <LocationNode key={s.id}
      loc={toLocationShape(s)}       // adapter: Station → LocationNode-compatible shape
      pos={layout.get(s.node_id)}
      fillRatio={metrics?.bufferFullness?.[s.id] ?? 0}
      isSelected={selectedStation === s.id}
      onSelect={() => setSelectedStation(s.id)}
    />
  ))}
  <TrackSegmentLines segments={config.segments} nodePositions={layout}
    flowState={engineState.flowState} />
  <UnitStream engineStateRef={engineStateRef} nodePositions={layout} config={config} />
  <CarrierAgents engineStateRef={engineStateRef} nodePositions={layout} config={config} />
  <ScenePostFX isMobile={false} />
  <OrbitControls />
</Canvas>
```

**`toLocationShape(station)`** — thin adapter converting `Station` to the shape
`LocationNode` expects (`{id, name, type, floor, zone}`). Not a full reimplementation.

**UnitStream.jsx** — reuses `InstancedMesh` + `useFrame` pattern from
`ParticleStream.jsx`:
```jsx
useFrame(() => {
  const positions = unitPositions(
    engineStateRef.current?.flowState,
    engineStateRef.current?.carrierState,
    config, nodePositions, engineStateRef.current?.clock.now()
  );
  // update InstancedMesh matrix for each unit
  positions.forEach(({x,y,z}, i) => {
    dummy.position.set(x, y + 0.2, z);
    dummy.updateMatrix();
    mesh.current.setMatrixAt(i, dummy.matrix);
  });
  mesh.current.instanceMatrix.needsUpdate = true;
});
```

**CarrierAgents.jsx** — same pattern; colors per carrier state:
- idle = grey (`#888`)
- loaded = blue (`#2266cc`)
- held_at_dest = red (`#cc2222`)
- returning = dim-blue (`#7799bb`)

**TrackSegmentLines.jsx** — `Line` (drei) per passive segment; tube per carrier segment:
- Occupancy = `(segmentUnits.length + segmentHeld.length) / segment.capacity`
- Color: `fillStateColor(occupancy)` from factoryMaterials

**Verify before moving on:**  `npm run dev`, navigate `/twin`, confirm canvas loads
with stations visible and units animating. No Playwright gate yet (D10 handles E2E).

**Required data-testid:**
- `data-testid="twin-canvas"` — on the `<div>` wrapping the Canvas

**Accept:** canvas renders without console errors; units visibly animate on linearLine
fixture at default speed; buffer fill colors visible on stations; `layerPurity.test.js`
still passes.

---

### D3.5 — `TwinApp` + route (moved up from D9)

**Files:**
- `src/twin/ui/TwinApp.jsx`
- `src/twin/ui/index.js`
- `src/main.jsx` — add 4-line pathname check

**TwinApp.jsx:**
```jsx
export default function TwinApp() {
  const [config] = useState(() => makeLinearLineFixture());
  return (
    <TwinProvider config={config}>
      <div style={{ width:'100vw', height:'100vh', position:'relative' }}>
        <TwinCanvas />
        {/* D4+ panels mount here */}
      </div>
    </TwinProvider>
  );
}
```

**main.jsx change:**
```js
const isTwin = window.location.pathname.startsWith('/twin');
root.render(isTwin ? <TwinApp /> : <App />);
```

**Required data-testid:**
- `data-testid="twin-app"` — on the outer div in TwinApp

**Accept:** `/twin` shows canvas; `/` shows M800 app unchanged; no React Router dep added.

---

### D4 — `SimControls` + `WipHeatmap` + `HeadcountPanel`

**Files:**
- `src/twin/ui/SimControls.jsx`
- `src/twin/ui/WipHeatmap.jsx`
- `src/twin/ui/HeadcountPanel.jsx`

**SimControls.jsx** — horizontal strip at bottom:
```
[▶ Play] [⏸ Pause] [▶| Step] [×1] [×5] [×10] [×100]
Sim time: 0:04:30 · WIP: 3 · [⏪ Rewind] · Status: RUNNING / DONE
```
- Play/Pause: `twinHook.pause()` / `twinHook.resume()`
- Step: pause → one `step(engineStateRef.current)` → re-pause (single-frame advance)
- Speed buttons: `twinHook.setSpeed(n)` (n = 1|5|10|100)
- Rewind: `snapshot(engineStateRef.current)` → store token; click again →
  `twinHook.rewind(token)` (shows "(rewound to T=X)" banner)

**WipHeatmap.jsx** — floating panel:
- `Object.entries(metrics.bufferFullness)` → per-station badge
- Badge color: CSS background from `fillStateColor(ratio)` (inline style)
- Text: `stationName (filled/cap)`, e.g. `"Station B (2/2)"`

**HeadcountPanel.jsx**:
- `People: N` from `metrics.peopleRequired`
- `AMR fleet: N` from `metrics.amrFleet`
- Per-segment carrier utilization progress bar (0–100%)

**Required data-testid (all in D4):**
- `data-testid="sim-controls"` — SimControls outer div
- `data-testid="play-btn"` — play/pause toggle
- `data-testid="speed-1"`, `"speed-5"`, `"speed-10"`, `"speed-100"` — speed buttons
- `data-testid="sim-time"` — time display element
- `data-testid="done-badge"` — shown only when `done === true` (e.g. "DONE ✓")
- `data-testid="rewind-btn"` — rewind button
- `data-testid="wip-heatmap"` — WipHeatmap outer div
- `data-testid="fill-{stationId}"` — per-station badge div, `data-fill={ratio}`
- `data-testid="headcount-panel"` — HeadcountPanel outer div

**Accept:**
- Play/pause button toggles `paused` state visually.
- Speed ×100 completes the linearLine order; `done-badge` appears.
- WipHeatmap shows station badges with non-zero fill during a run.
- HeadcountPanel shows nonzero `peopleRequired` for linearLine (staffed stations).

---

### D5 — `ShockConsole`

**Files:**
- `src/twin/ui/ShockConsole.jsx`

**ShockConsole.jsx** — collapsible panel, bottom-left:
- Renders `twinHook.shocks` array
- Each row: `[HH:MM:SS] DEADLOCK — cycle: station_assem → seg_case → ...`
- Expand on click → `shock.members` list
- Acknowledge (mark read) button — local component state, no engine mutation
- Collapsed state shows unread count badge

**Required data-testid:**
- `data-testid="shock-console"` — outer div
- `data-testid="shock-count"` — unread count badge (text content = number)
- `data-testid="shock-row"` — each shock row (use `data-testid` on the `<li>`)

**Accept:**
- Load kitting-stall fixture → `shock-count` shows "1".
- Load linearLine → `shock-count` shows "0".

---

### D6 — `ProcessForm` (pause-and-apply)

**Files:**
- `src/twin/ui/ProcessForm.jsx`

**ProcessForm state machine:** Idle → Editing → Applied → Idle

```
Idle: shows current takt values (read-only display)
  → user clicks "Edit" → Editing

Editing: twin auto-pauses; shows "(paused for edit)" banner; inputs enabled
  → user clicks "Apply" → validates, calls applyConfig, → Applied (then Idle)
  → user clicks "Cancel" → resume, discard changes → Idle
  (NOT auto-paused on onChange — pauses only when user explicitly clicks "Edit")
```

**Kind-driven fields:**

| kind | fields | derived readout |
|------|--------|-----------------|
| `transform` | `takt_seconds`, `automation_level` | `effectiveSlots`, `capacityPerHour` |
| `assembly` | `takt_seconds`, BOM pairs `{material: count}` | `capacityPerHour` |
| `inspect` | `takt_seconds`, `pass_rate` (0–1) | `capacityPerHour`, expected yield |
| `hold` | `dwell_seconds` | throughput = slots/dwell |
| `store` | (no time — external pull) | — |
| `label`/`seal` | `takt_seconds` | `capacityPerHour` |

Derived readout updates on every keystroke (runs derive formula inline — no engine step).
**Never** renders a `capacity_per_hour` raw input field.

**Required data-testid:**
- `data-testid="process-form"` — outer form div
- `data-testid="process-tab-{processId}"` — per-process tab button
- `data-testid="edit-btn"` — enter edit mode
- `data-testid="takt-input"` — takt_seconds input
- `data-testid="apply-btn"` — apply changes
- `data-testid="cancel-btn"` — cancel changes
- `data-testid="paused-banner"` — banner shown while in Editing state
- `data-testid="station-{stationId}"` — clickable station in TwinCanvas (for test
  navigation; add to `LocationNode`'s outer `<group>` as a DOM attribute via
  userData or an overlaid `<Html>` element from drei)

**Accept:**
- Click station → ProcessForm shows correct kind-driven fields.
- Click Edit on Station B (transform/work process); change takt 60→30; click Apply;
  `paused-banner` disappears; sim resumes; `HeadcountPanel` `capacityPerHour` changes.
- Click Cancel → takt unchanged; sim resumes.
- `paused-banner` is visible only during Editing state.

---

### D10 — Playwright golden-path tests

**File:** `tests/twin.spec.js`

```js
test.describe('Twin UI — golden path', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/twin');
    await page.waitForSelector('[data-testid="twin-canvas"]');
  });

  test('canvas renders', async ({ page }) => {
    await expect(page.locator('[data-testid="twin-app"]')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('sim-time advances', async ({ page }) => {
    const t0 = await page.locator('[data-testid="sim-time"]').textContent();
    await page.waitForTimeout(1500);
    const t1 = await page.locator('[data-testid="sim-time"]').textContent();
    expect(t1).not.toBe(t0);
  });

  test('speed ×100 completes order and done-badge appears', async ({ page }) => {
    await page.click('[data-testid="speed-100"]');
    // done-badge appears once the linearLine order completes (3 units × bottleneck 60s)
    await page.waitForSelector('[data-testid="done-badge"]', { timeout: 15000 });
    await expect(page.locator('[data-testid="done-badge"]')).toBeVisible();
  });

  test('zero shocks on linearLine run', async ({ page }) => {
    await page.click('[data-testid="speed-100"]');
    await page.waitForSelector('[data-testid="done-badge"]', { timeout: 15000 });
    const count = await page.locator('[data-testid="shock-count"]').textContent();
    expect(count.trim()).toBe('0');
  });

  test('pause-and-apply takt: sim pauses on Edit click, resumes after Apply', async ({ page }) => {
    // Click station B to open inspector
    // (station-B renders as an HTML overlay `data-testid="station-station_b"` via drei <Html>)
    await page.click('[data-testid="station-station_b"]');
    await page.waitForSelector('[data-testid="process-form"]');
    // Click Edit — twin pauses
    await page.click('[data-testid="edit-btn"]');
    await expect(page.locator('[data-testid="paused-banner"]')).toBeVisible();
    const t0 = await page.locator('[data-testid="sim-time"]').textContent();
    await page.waitForTimeout(600);
    const t1 = await page.locator('[data-testid="sim-time"]').textContent();
    expect(t1).toBe(t0);   // frozen while editing
    // Apply
    await page.fill('[data-testid="takt-input"]', '30');
    await page.click('[data-testid="apply-btn"]');
    await expect(page.locator('[data-testid="paused-banner"]')).not.toBeVisible();
    await page.waitForTimeout(1000);
    const t2 = await page.locator('[data-testid="sim-time"]').textContent();
    expect(t2).not.toBe(t1);   // running again
  });
});
```

**Accept:** All 5 Playwright tests green in headless Chromium (SwiftShader). Existing
3 M800 factory.spec.js tests also still green.

---

## Files to Create / Modify

### New files

| File | Phase | Purpose |
|------|-------|---------|
| `src/twin/ui/useTwin.js` | D1 | Hook: initState/step/restore lifecycle |
| `src/twin/ui/useTwin.test.js` | D1 | Vitest: 10 tests |
| `src/twin/ui/twinLayout.js` | D2 | DAG → positions; unitPositions() |
| `src/twin/ui/twinLayout.test.js` | D2 | Vitest: 6 tests |
| `src/twin/ui/TwinCanvas.jsx` | D3 | R3F Canvas + 3D layers |
| `src/twin/ui/UnitStream.jsx` | D3 | InstancedMesh: units from flowState |
| `src/twin/ui/CarrierAgents.jsx` | D3 | InstancedMesh: carrier state |
| `src/twin/ui/TrackSegmentLines.jsx` | D3 | Segment lines colored by occupancy |
| `src/twin/ui/TwinApp.jsx` | D3.5 | Root page component |
| `src/twin/ui/index.js` | D3.5 | Barrel export |
| `src/twin/ui/SimControls.jsx` | D4 | Play/Pause/Speed/Rewind strip |
| `src/twin/ui/WipHeatmap.jsx` | D4 | Buffer fullness badges |
| `src/twin/ui/HeadcountPanel.jsx` | D4 | peopleRequired / amrFleet |
| `src/twin/ui/ShockConsole.jsx` | D5 | Shock event list |
| `src/twin/ui/ProcessForm.jsx` | D6 | Kind-driven editor, pause-and-apply |
| `tests/twin.spec.js` | D10 | Playwright: 5 golden-path tests |

### Modified files

| File | Phase | Change |
|------|-------|--------|
| `src/layout/autoLayout.js` | D2 | Add `computeTwinLayout(nodes, edges, overrides)` overload |
| `src/scene/LocationNode.jsx` | D3 | Add optional `fillRatio` prop (~10 lines) |
| `src/main.jsx` | D3.5 | Add `/twin` pathname check (~4 lines) |

---

## Acceptance Criteria (Full Part D)

- [ ] `npm test` (vitest): 205 + 16 new unit tests green; no regressions.
- [ ] `npm run test:e2e`: all 8 Playwright tests green (3 existing + 5 new twin).
- [ ] `/twin` route loads; `data-testid="twin-app"` visible.
- [ ] Units animate in TwinCanvas on linearLine fixture.
- [ ] Buffer fullness heatmap: colors update during run.
- [ ] Speed ×100: `done-badge` appears; run completes without hang or jank.
- [ ] Shock console: 0 shocks on linearLine; 1 shock on kitting-stall fixture.
- [ ] ProcessForm: Edit → paused-banner; Apply takt change → sim resumes; in-flight
      units preserved; derived readout (`capacityPerHour`) changes correctly.
- [ ] ProcessForm: never shows a `capacity_per_hour` raw input.
- [ ] Rewind: snapshot before run; advance 5 ticks; rewind; advance 5 ticks again →
      identical simTime sequence (vitest test in `useTwin.test.js`).
- [ ] Existing M800 app at `/`: all 3 existing Playwright tests still green.
- [ ] `layerPurity.test.js` passes: no `src/twin/engine/**` import of `react`/`ui`.
- [ ] No React Router added to `package.json`.

---

## Architectural Risks and Tradeoffs (post-critic)

### R1 — RAF loop + MAX_STEPS_PER_FRAME cap
**Risk:** At speed ×100 on a long-running sim, the per-frame step budget
(500 steps) may not advance simulation time far enough to "feel" fast.
**Mitigation:** 500 steps × typical 10s/step advance = 5,000 sim-seconds per
frame (83 sim-minutes). The linearLine fixture completes in ~285s, so at ×100 it
finishes in <3 frames. The cap only bites on pathological fixtures with many
very-short steps. Expose a `MAX_STEPS_PER_FRAME` constant for tuning if needed.

### R2 — Metrics read consistency
**Risk:** Metrics read from a partially-mutated state (some units moved, buffers
not yet drained).
**Mitigation:** `liveMetrics()` is called **once per frame, at the end of the
step loop**, from the same sync JS execution context — after all step mutations
for that frame have completed. No separate interval means no cross-frame race.

### R3 — `unit.location` field is a stub
The `Unit` domain object has `location.type` but it is never updated by the
engine. `unitPositions()` scans `flowState` maps as the authoritative source.
This is correct for Part D. Updating `unit.location` to stay in sync is a
potential Part E cleanup (would enable direct unit lookup without map scans).

### R4 — `LocationNode.jsx` backward compatibility
Adding `fillRatio` prop is purely additive (default undefined → existing behavior).
The M800 app never passes `fillRatio`, so it is unaffected.

### R5 — Playwright WebGL in CI (existing mitigation intact)
`playwright.config.js` already enables SwiftShader. New tests use `data-testid`
on DOM overlay elements, not 3D pixel assertions — CI-robust.

### R6 — `autoLayout.js` generalization risk
Adding `computeTwinLayout` as a new export does not touch `computeLayout`
(the M800 function). Both share the DAG algorithm. Zero regression risk if
the implementation is additive. The M800 Playwright tests catch any breakage.

---

## Sequencing

```
D1 useTwin hook (headless vitest)
  └─► D2 twinLayout + unitPositions (headless vitest)
        └─► D3 TwinCanvas (3D, manual verify)
              └─► D3.5 TwinApp + route (E2E testable from here)
                    └─► D4 SimControls + WipHeatmap + HeadcountPanel
                          └─► D5 ShockConsole
                                └─► D6 ProcessForm (pause-and-apply)
                                      └─► D10 Playwright tests
                                            └─► Part E: SchemaMatrix, TrackEditor, CarrierPool
```

Land each phase behind its tests (vitest or manual) before proceeding.

---

## Definition of Done (Part D)

- 16 new vitest tests green (D1: 10, D2: 6); total 221.
- 5 new Playwright tests green (D10); total 8 including existing.
- `/twin` route live with TwinCanvas, SimControls, WipHeatmap, HeadcountPanel,
  ShockConsole, ProcessForm all functional on linearLine fixture.
- Pause-and-apply, rewind all functional.
- No regressions in existing M800 app, layerPurity guard, or §15 grep guard.
