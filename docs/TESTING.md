# Testing Guide

---

## Running Tests

### Unit tests (Vitest)

```bash
npm test
```

Runs all `*.test.js` files via Vitest in a jsdom environment. Expect ~30 test files covering the engine, domain types, and utilities.

To run a single file:

```bash
npx vitest run src/twin/engine/flow.test.js
```

To run in watch mode during development:

```bash
npx vitest
```

### End-to-end tests (Playwright)

```bash
npm run test:e2e
```

Requires the dev server to be running (or Playwright will start it automatically — check `playwright.config.js`). Tests live in `tests/`.

---

## Test Coverage Areas

| Area | Test file(s) | What's covered |
|------|-------------|----------------|
| Engine core | `src/twin/engine/engine.test.js` | initState, step, event ordering |
| Unit flow | `src/twin/engine/flow.test.js` | Segment movement, backpressure propagation |
| Process scheduling | `src/twin/engine/taktScheduler.test.js` | Slot allocation, parallel execution |
| Process application | `src/twin/engine/processApply.test.js` | Transform, assembly (BOM kitting), inspect |
| WIP governance | `src/twin/engine/releaseGovernor.test.js` | WIP cap enforcement |
| Carrier physics | `src/twin/engine/carriers.test.js` | Load/traverse/return cycles, shift gating |
| Order completion | `src/twin/engine/aggregator.test.js` | Metrics, scrap counting |
| Deadlock detection | `src/twin/engine/deadlock.test.js` | Circular-wait reporting |
| Config validation | `src/twin/engine/validator.test.js` | Invalid reference rejection, unreachable node detection |
| Domain invariants | `src/twin/domain/domain.test.js` | Type construction guards |
| Utilities | `src/twin/util/ids.test.js`, `rng.test.js` | ID uniqueness, RNG reproducibility |
| E2E golden path | `tests/twin.spec.js` | Canvas renders, sim-time advances, pause-apply |

---

## Test Fixtures

Three pre-built factory configurations live in `src/twin/fixtures/`:

| Fixture | File | What it tests |
|---------|------|--------------|
| `linearLine` | `linearLine.js` | Full M800 value stream: Supplier → IQC → SMT → FCT → 1P → SFG Pack → ASRS → VC → Pack → FAT → Customer |
| `assemblyLine` | `assemblyLine.js` | Multi-BOM assembly with component kitting |
| `carrierLine` | `carrierLine.js` | Carrier-pool transport (forklifts / AGVs) round-trip physics |

Use them in tests like this:

```javascript
import { makeLinearLineFixture } from '../fixtures/linearLine.js';
import { initState, step } from '../engine/engine.js';

const config = makeLinearLineFixture();
const state = initState(config);
// advance 100 ticks
for (let i = 0; i < 100; i++) step(state);
```

---

## Determinism Test Pattern

The engine is deterministic: the same config + seed always produces the same result. Verify this with a snapshot assertion:

```javascript
import { makeLinearLineFixture } from '../fixtures/linearLine.js';
import { initState, step } from '../engine/engine.js';

test('deterministic output', () => {
  const run = () => {
    const state = initState(makeLinearLineFixture(), { seed: 42 });
    for (let i = 0; i < 500; i++) step(state);
    return state.metrics.units_completed;
  };
  expect(run()).toBe(run());
});
```

---

## Adding a New Engine Test

1. Co-locate the test file with the module: `src/twin/engine/myModule.test.js`
2. Import the function directly — no mocking of the engine internals
3. Use a fixture or hand-craft a minimal `FactoryConfig` via the domain/network constructors
4. Assert on `state` fields after running `step()` N times
5. Add a determinism assertion if the new code touches RNG

---

## What Is Not Tested (Yet)

- 3D rendering correctness (Three.js scene output)
- UI component interaction beyond the Playwright golden path
- API endpoint (`api/config.js`) — no integration test with Neon
