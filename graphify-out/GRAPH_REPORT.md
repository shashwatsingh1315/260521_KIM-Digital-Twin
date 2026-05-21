# Graph Report - .  (2026-05-21)

## Corpus Check
- Corpus is ~19,410 words - fits in a single context window. You may not need a graph.

## Summary
- 93 nodes · 91 edges · 16 communities (11 shown, 5 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Pull System & Digital Twin Design|Pull System & Digital Twin Design]]
- [[_COMMUNITY_Package Scripts & Metadata|Package Scripts & Metadata]]
- [[_COMMUNITY_Collections PTP Kanban Feature|Collections PTP Kanban Feature]]
- [[_COMMUNITY_Pull Engine Simulation Hook|Pull Engine Simulation Hook]]
- [[_COMMUNITY_Factory 3D Rendering & Camera|Factory 3D Rendering & Camera]]
- [[_COMMUNITY_Dev Dependencies & Test Config|Dev Dependencies & Test Config]]
- [[_COMMUNITY_FactoryTwin React Component|FactoryTwin React Component]]
- [[_COMMUNITY_Runtime Dependencies|Runtime Dependencies]]
- [[_COMMUNITY_E2E Playwright Tests|E2E Playwright Tests]]
- [[_COMMUNITY_Test Run Results|Test Run Results]]
- [[_COMMUNITY_NewCaseForm Fix|NewCaseForm Fix]]
- [[_COMMUNITY_E2E Auth Bypass Security|E2E Auth Bypass Security]]
- [[_COMMUNITY_UUID Generation Fix|UUID Generation Fix]]
- [[_COMMUNITY_Round Type Fix|Round Type Fix]]

## God Nodes (most connected - your core abstractions)
1. `Digital Twin Wireframe Sketch - Factory Flow & Pull System` - 8 edges
2. `CEO Plan: 3D Factory Pull-System Digital Twin` - 8 edges
3. `scripts` - 6 edges
4. `Collections CRM: Promise-To-Pay & Kanban Board Design Spec` - 5 edges
5. `Collections CRM PTP Kanban Implementation Plan` - 4 edges
6. `usePullEngine()` - 3 edges
7. `CollectionsClient.tsx Kanban Board UI` - 3 edges
8. `refresh_ptp_statuses PostgreSQL RPC Function` - 3 edges
9. `Factory Twin E2E Playwright Test Suite` - 3 edges
10. `App()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `Shock Events: Manual Factory Bottleneck Injection` --semantically_similar_to--> `Shock Injection (Inject Shock / Jam)`  [INFERRED] [semantically similar]
  docs/designs/factory-pull-digital-twin.md → gstack-sketch.html
- `Time Travel Timeline Slider` --semantically_similar_to--> `X-Ray Flow-Pulse & Interactive Time-Traveler Feature`  [INFERRED] [semantically similar]
  gstack-sketch.html → docs/designs/factory-pull-digital-twin.md
- `ASRS Warehouse System (4-Level)` --semantically_similar_to--> `Pull System Flow Logic (MFG-to-ASRS)`  [INFERRED] [semantically similar]
  gstack-sketch.html → docs/designs/factory-pull-digital-twin.md
- `Camera Path Presets (Accepted Scope)` --conceptually_related_to--> `Dynamic Camera Presets TODO`  [INFERRED]
  docs/designs/factory-pull-digital-twin.md → TODOS.md
- `Local Storage Persistence (Accepted Scope)` --conceptually_related_to--> `Local Storage Persistence TODO`  [INFERRED]
  docs/designs/factory-pull-digital-twin.md → TODOS.md

## Hyperedges (group relationships)
- **Collections CRM PTP Full Stack: Spec → Plan → DB → Actions → UI** — specs_collections_ptp_design, plans_collections_ptp_kanban_plan, plans_collections_db_migration, plans_collections_server_actions, plans_collections_client_tsx [INFERRED 0.95]
- **Factory Digital Twin Visualization: CEO Plan + Wireframe + App Entry** — designs_factory_pull_ceo_plan, gstack_sketch_digital_twin_wireframe, index_factory_pull_digital_twin_app [INFERRED 0.85]
- **E2E Test Coverage for Factory Twin: Timeline, Shock, Viewport Canvas** — test_e2e_factory_spec, gstack_sketch_shock_injection, gstack_sketch_timeline_slider [INFERRED 0.75]

## Communities (16 total, 5 thin omitted)

### Community 0 - "Pull System & Digital Twin Design"
Cohesion: 0.13
Nodes (15): Pull System Flow Logic (MFG-to-ASRS), Shock Events: Manual Factory Bottleneck Injection, X-Ray Flow-Pulse & Interactive Time-Traveler Feature, 3D Viewport Panel (OrbitControls Mock), ASRS Warehouse System (4-Level), Bottleneck Diagnosis Console, 2nd Floor Conveyor Bridge, Digital Twin Wireframe Sketch - Factory Flow & Pull System (+7 more)

### Community 1 - "Package Scripts & Metadata"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, preview, test, test:e2e (+2 more)

### Community 2 - "Collections PTP Kanban Feature"
Cohesion: 0.29
Nodes (10): CollectionsClient.tsx Kanban Board UI, Supabase DB Migration for PTP & Escalations, Collections CRM PTP Kanban Implementation Plan, Collections Server Actions (actions.ts), refresh_ptp_statuses PostgreSQL RPC Function, Background Wake-Up: Broken Promise Auto-Transition, Collections CRM: Promise-To-Pay & Kanban Board Design Spec, Kanban Board Columns: Overdue, Snoozed/PTP, Broken Promises (+2 more)

### Community 3 - "Pull Engine Simulation Hook"
Cohesion: 0.27
Nodes (6): runSimulation(), happyStates, hasBlocked, states, usePullEngine(), App()

### Community 4 - "Factory 3D Rendering & Camera"
Cohesion: 0.22
Nodes (10): Camera Path Presets (Accepted Scope), CEO Plan: 3D Factory Pull-System Digital Twin, InstancedMesh Particle Flow (R3F useFrame), Local Storage Persistence (Accepted Scope), WebGL Render Order Hierarchy for Transparent Floors, Client-Side Procedural Simulation Engine (Pre-Calculated Cache), Dynamic Camera Presets TODO, FactoryTwin.jsx Component (+2 more)

### Community 5 - "Dev Dependencies & Test Config"
Cohesion: 0.25
Nodes (8): devDependencies, jsdom, @playwright/test, @types/react, @types/react-dom, vite, @vitejs/plugin-react, vitest

### Community 6 - "FactoryTwin React Component"
Cohesion: 0.25
Nodes (5): CURRENT_VEC, DUMMY, NODES, TARGET_VEC, TwinScene

### Community 7 - "Runtime Dependencies"
Cohesion: 0.29
Nodes (7): dependencies, lucide-react, react, react-dom, @react-three/drei, @react-three/fiber, three

### Community 8 - "E2E Playwright Tests"
Cohesion: 0.40
Nodes (4): canvas, resumeBtn, shockBtn, timelineInput

## Knowledge Gaps
- **47 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+42 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CEO Plan: 3D Factory Pull-System Digital Twin` connect `Factory 3D Rendering & Camera` to `Pull System & Digital Twin Design`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Dev Dependencies & Test Config` to `Package Scripts & Metadata`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _50 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Pull System & Digital Twin Design` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._