# Project TODOs

## [x] DONE: Metrics & Analytics Dashboard
- **What**: Live analytics rail panel (`MetricsDashboard.jsx`) — realised throughput (units/hr), WIP in system, completion % + ETA, theoretical bottleneck, throughput/WIP sparklines, and per-order progress bars.
- **How**: Pure series maths in `metricsHistory.js` (pushSample / throughputPerHour / etaSeconds / orderProgress / sparklinePoints), fed by an enriched per-frame metrics snapshot (`useTwin` now attaches `simTime`, `unitsInSystem`, and an `orders` progress array). The panel samples on sim-time advance and resets on config swap/rewind.

## [x] DONE: Bulk Config Import / Export
- **What**: Toolbar “⤓ Data” menu (`ImportExportMenu.jsx`) to export the whole factory as JSON or just node coordinates as CSV, and to import either back (config replaces the live factory; coordinates reposition nodes).
- **How**: Pure parse/serialise + validate in `configIO.js` (`exportConfigJSON` / `importConfigJSON` / `exportCoordinatesCSV` / `parseCoordinatesCSV` / `importCoordinatesCSV`). Imports round-trip through `toDraft → buildConfig → validateFactoryConfig`, so a bad file is rejected with a message instead of corrupting state.

## [x] DONE: Improved Track / Topology Editor + measured coordinates
- **What**: The network editor now edits **node positions in metres** (x = width, y = floor height, z = depth) alongside segment topology; the Config panel’s Network tab gained the same x/y/z fields per node.
- **Why coordinates matter**: positions live in `config.layout_overrides` (keyed by node id, in metres) so a layout can be traced from the **engineering drawing** and every machine placed exactly. Export the coordinates CSV, edit against the floor plan, re-import.
- **Foundation fix**: `layout_overrides` were previously **dropped** on every Config-panel apply, TrackEditor apply, and DB reload (`toDraft`/`buildConfig`/`makeFactoryConfig` ignored them). They now survive every round-trip and are normalised to finite metres (`normalizeLayoutOverrides`). Regression-locked by tests in `configDraft.test.js` and `configIO.test.js`.

## [ ] TODO: Dynamic Camera Presets
- **What**: Interactive camera presets (cinematic orbit, floor zoom-ins, ASRS focus view) triggered by buttons.
- **Why**: Allows users and executives to easily zoom into areas of interest without manually panning and zooming.
- **Pros**: Polished, professional demo showcase experience; guides user attention to bottlenecks.
- **Cons**: Adds camera math and transition interpolation complexity.
- **Context**: In the initial 3D digital twin dashboard, the user manual navigation uses OrbitControls. Camera presets will automate focus transitions when diagnostic warnings are clicked. Start by interpolating OrbitControls target and position vectors using React state and `useFrame` updates.
- **Depends on / blocked by**: MVP implementation of stacked floors and conveyor bridge (`FactoryTwin.jsx`).

## [x] TODO: Local Storage Persistence
- **What**: Persist dashboard simulation states, tick speed configurations, and active shock events in localStorage.
- **Why**: Saves the user from having to re-configure shock states and timeline settings every time they refresh the page.
- **Pros**: Better user experience; seamless development reloading.
- **Cons**: Minor synchronization complexity to hook browser state into the custom simulation engine.
- **Context**: The simulation engine manages ticks, timeline speed, and shock injections via `usePullEngine`. Hooks can listen for simulation changes and write seeds/event state into browser localStorage, restoring them on initialization.
- **Depends on / blocked by**: `usePullEngine.js` state hook MVP.
