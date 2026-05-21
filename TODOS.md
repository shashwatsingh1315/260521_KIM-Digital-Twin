# Project TODOs

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
