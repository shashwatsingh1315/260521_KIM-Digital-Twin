# KIM Digital Twin — Factory Pull System

A real-time 3D visualization and physics simulation of the M800 smart meter manufacturing facility, modelling the complete material flow from supplier gate to customer shipment across two sites: **KMP Plant** (electronics manufacturing) and **Warehouse ASRS** (value-creation + final packaging).

The simulation is a genuine discrete-event physics engine — not just a visualisation. It calculates exact takt times, conveyor backpressure, carrier round-trips, shift-gated staffing, and deadlock conditions. Invalid factory configurations are rejected at startup.

### What the engine models

- **Pull discipline** — units are admitted only when the bottleneck can accept them (WIP cap enforced)
- **Physical routing** — material moves like trains on track; segments have capacity; full segments block upstream flow
- **Takt scheduling** — each process at each station has a takt time; parallel slots run concurrently
- **Carrier transport** — AGVs/forklifts/people do FIFO pickup, traverse loaded, return empty; shift-gated for people
- **Assembly (N→1)** — fungible component kits are consumed; a new product unit is born at the station
- **Deadlock detection** — circular-wait graph detects kitting stalls, buffer lock-ups, carrier hold loops
- **What-if forking** — freeze any simulation moment and branch it independently with a different seed
- **Pause-and-apply** — stop mid-run, edit takt times or process definitions, resume without data loss

---

## Quick Start

### Prerequisites
- Node.js 18+
- (Optional) A [Neon](https://neon.tech) PostgreSQL database for config persistence

### Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Optional | Neon Postgres connection string. If omitted, the app runs fully in-memory — configs are not saved across reloads. |

For local development, create a `.env` file at the repo root:

```
DATABASE_URL=postgres://...
```

---

## App Modes

The app has two modes served from the same build:

| URL | Mode | Description |
|-----|------|-------------|
| `/` | **Deterministic Twin** (default) | Full discrete-event engine with pause-and-edit, WIP heatmap, shock injection, and carrier physics. Start here. |
| `/legacy` | Legacy 3D Prototype | Early M800-specific 3D scene. Kept for reference; not actively developed. |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Vite, hot-reload) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 18 |
| 3D Graphics | Three.js 0.160 + @react-three/fiber + @react-three/drei |
| Build | Vite 5 |
| Unit Tests | Vitest 1.6 |
| E2E Tests | Playwright 1.44 |
| Backend / Persistence | Vercel Serverless + Neon PostgreSQL |

---

## Where to start

| Goal | Start here |
|------|-----------|
| **Understand the system at a glance** | This README → [ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| **Model a new factory in code** | [factory-config-guide.md](docs/factory-config-guide.md) — walks through data collection → code, with examples |
| **Navigate the codebase cold** | [CODE_STRUCTURE.md](docs/CODE_STRUCTURE.md) — annotated file tree |
| **Run or add tests** | [TESTING.md](docs/TESTING.md) |
| **Understand design decisions** | [factory-twin-v2-architecture.md](docs/designs/factory-twin-v2-architecture.md) — authoritative design doc (domain model, 23 resolved decisions) |
| **Upgrade 3D machine models** | [3d_upgrade_guide.md](3d_upgrade_guide.md) |

## Documentation

| Document | What it covers |
|----------|---------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Engine design, data flow, unit lifecycle, WIP cap, formulas, deadlock, fork mode |
| [docs/CODE_STRUCTURE.md](docs/CODE_STRUCTURE.md) | Annotated file tree |
| [docs/TESTING.md](docs/TESTING.md) | How to run and extend the test suite |
| [docs/factory-config-guide.md](docs/factory-config-guide.md) | How to model a real factory (data collection → code) |
| [docs/designs/factory-twin-v2-architecture.md](docs/designs/factory-twin-v2-architecture.md) | Full authoritative design doc (domain model, 23 resolved decisions) |
| [3d_upgrade_guide.md](3d_upgrade_guide.md) | How to upgrade grey-box machine models to detailed 3D |

---

## Project Structure (top level)

```
src/twin/          Deterministic engine + UI (new, actively developed)
src/components/    Legacy 3D prototype components
src/scene/         Legacy Three.js scene graph
api/               Vercel serverless functions (config persistence)
tests/             Playwright E2E tests
docs/              Architecture, guides, and design docs
```

See [docs/CODE_STRUCTURE.md](docs/CODE_STRUCTURE.md) for the full annotated tree.
