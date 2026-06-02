# 🗄️ Neon Relational Database Migration & Code Plan

We have successfully migrated and initialized the Neon database with the complete **relational schema** matching the application's physical structure, operating assets, processes, materials, controls, and runtime entities. 

All tables are now fully defined and seeded with the baseline data from `src/data/m800_model.js`.

---

## 1. What was done on the Neon Database
We executed DDL and seeding scripts directly on the Neon database instance, creating the following **20 relational tables** in the `public` schema:

### Physical Structure & Assets
* **`location_nodes`**: Persists all 51 physical zones, sites, floors, lifts, and assembly docks with capacity limits and initial fill ratios.
* **`paths`**: Persists the 43 physical transport links connecting locations (including travel times, distances, and movement modes).
* **`stations`**: Persists all 19 operating workstations, capacity metrics, and operator configurations.
* **`resources`**: Persists the 12 operating assets (trucks, stackers, lifts, cranes, operators) and home locations.

### Process & Control Logic
* **`processes`**: Persists the 27 manufacturing processes, cycle times (seconds), and input/output material states.
* **`route_steps`**: Persists all 34 sequence steps mapping routes from suppliers to finished goods.
* **`materials`**: Persists the 26 raw materials, consumables, and subassemblies.
* **`material_states`**: Persists the 39 distinct lifecycles of material states.
* **`containers`**: Persists the 12 physical containers (ESD bins, pallets, Leap bins).
* **`quality_gates`**: Persists the 14 inspection gates, checks, and recording methods.
* **`system_events`**: Persists the 20 transaction hooks linked to SAP/MES systems.

### Live Twin & Simulation Runtime
* **`inventory_positions`**: Tracks real-time stock quantities across locations.
* **`live_status`**: Tracks workstation, path, and resource state statuses ('active', 'blocked', 'unknown').
* **`event_log`**: Tracks audit logs of moves, scans, quality results, and releases.
* **`scenario_overrides`**: Stores what-if shock configurations and rate multipliers.
* **`sim_rates`**: Holds flow rates (units/tick) for each transport path.
* **`simulation_runs`**: Stores historical simulation run executions and summaries.
* **`simulation_snapshots`**: Stores step-by-step buffer levels and particles during runs for replays.
* **`user_preferences`**: Persists layout coordinates, current tick position, and toggled scenarios.
* **`factory_configs`**: Retained for backward compatibility.

---

## 2. Detailed Code Modification Plan (Proposed)

To transition the application from hardcoded JS configurations and `localStorage` to this fully relational Neon database, the codebase must be modified. Below is the proposed phase-by-phase implementation plan:

### Phase 1: API Route Infrastructure (`api/`)

Currently, `api/config.js` is the only database handler. We will create two new API handlers:

1. **`api/factory-data.js`**:
   * **`GET`**: Runs a single database connection using the Neon serverless client to load the entire physical model (`location_nodes`, `paths`, `stations`, `processes`, `materials`, etc.) via a batch query.
   * **`POST`**: Dynamic updates to core layouts.

2. **`api/simulation.js`**:
   * **`POST /api/simulation/run`**: Initializes a simulation run entry in `simulation_runs` and returns a `run_id`.
   * **`POST /api/simulation/snapshots`**: Persists incremental buffer states and particle layouts into `simulation_snapshots` in batches of 50 ticks to reduce HTTP latency.
   * **`GET /api/simulation/runs`**: Returns all previous simulation runs for dashboard analysis.

3. **`api/preferences.js`**:
   * **`GET /api/preferences`**: Loads layout overrides and UI state for the `'default'` user.
   * **`POST /api/preferences`**: Upserts layout overrides, active scenarios, and current ticks into `user_preferences`.

### Phase 2: Frontend Data Loader Integration (`src/`)

Currently, components import data statically:
`import { location_node, path } from './data/m800_model.js'`

We will refactor this to load dynamically:
1. **Create a Data Context (`src/context/FactoryContext.jsx`)**:
   * Fetch all schema objects from `/api/factory-data` and settings from `/api/preferences` on initial load.
   * Expose standard arrays as context state.
2. **Refactor UI Components**:
   * Update references in layout builders, 3D renderers, and dropdowns to pull from the `FactoryContext` instead of static JS module imports.

### Phase 3: Connect Simulation Engine to Persistence

Currently, the engine in `src/twin/engine/engine.js` runs in-memory and saves layout details in `localStorage`.
1. **Simulation Init**: On starting the engine, execute a `POST` request to `/api/simulation/run` with the configuration snapshot.
2. **Tick Snapshots**: Every $N$ ticks (e.g. 50 ticks), post the buffer status and active particle arrays to `/api/simulation/snapshots` asynchronously.
3. **Run Completion**: When the simulation finishes or is stopped, update the `simulation_runs` summary object (Total Completed, Total Scrap, Peak Bottlenecks).

---

## 3. Recommended Next Step
If you approve the code modifications described above, please confirm and we will implement the API and React context changes to activate database persistence across the app.
