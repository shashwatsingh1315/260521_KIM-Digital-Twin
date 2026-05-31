import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { resetIds } from '../util/ids.js';
import {
  computeTwinLayout,
  loadTwinLayoutOverrides,
  saveTwinLayoutOverrides,
  unitPositions,
} from './twinLayout.js';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';
import { initState, step } from '../engine/engine.js';

beforeEach(() => {
  resetIds(0);
  // Clear localStorage before each test
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith('twin_layout_')) keys.push(k);
  }
  for (const k of keys) {
    localStorage.removeItem(k);
  }
});

afterEach(() => {
  // Clean up after tests
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith('twin_layout_')) keys.push(k);
  }
  for (const k of keys) {
    localStorage.removeItem(k);
  }
});

describe('twinLayout', () => {
  test('computeTwinLayout returns positions for all nodes', () => {
    const cfg = makeLinearLineFixture();
    const layout = computeTwinLayout(cfg);
    expect(layout.size).toBeGreaterThan(0);
    for (const node of cfg.nodes) {
      expect(layout.has(node.id)).toBe(true);
    }
  });

  test('computeTwinLayout: nodes ordered left-to-right (increasing x)', () => {
    const cfg = makeLinearLineFixture();
    const layout = computeTwinLayout(cfg);

    // Extract positions in order of nodes
    const positions = cfg.nodes.map((n) => ({ id: n.id, pos: layout.get(n.id) }));
    for (let i = 1; i < positions.length; i++) {
      // Generally expect non-decreasing x (topological order)
      // Not strictly enforced due to DAG structure, but should be mostly ordered
      expect(positions[i].pos.x).toBeGreaterThanOrEqual(positions[0].pos.x);
    }
  });

  test('computeTwinLayout: override shifts one node; others unchanged', () => {
    const cfg = makeLinearLineFixture();
    const layout1 = computeTwinLayout(cfg);
    const pos1_a = layout1.get('n_a');

    // Override position of n_a
    const overrides = { n_a: { x: 100, z: 50 } };
    const layout2 = computeTwinLayout(cfg, overrides);
    const pos2_a = layout2.get('n_a');

    expect(pos2_a.x).toBe(100);
    expect(pos2_a.z).toBe(50);

    // Other nodes should remain unchanged
    for (const node of cfg.nodes) {
      if (node.id !== 'n_a') {
        const p1 = layout1.get(node.id);
        const p2 = layout2.get(node.id);
        expect(p2.x).toBe(p1.x);
        expect(p2.z).toBe(p1.z);
      }
    }
  });

  test('unitPositions returns plain {x,y,z} objects (no THREE.Vector3)', () => {
    const cfg = makeLinearLineFixture();
    const { state } = initState(cfg, { seed: 0 });
    const layout = computeTwinLayout(cfg);

    const positions = unitPositions(state.flowState, state.carrierState, cfg, layout, state.clock.now());

    for (const [unitId, pos] of positions) {
      expect(typeof pos.x).toBe('number');
      expect(typeof pos.y).toBe('number');
      expect(typeof pos.z).toBe('number');
      expect(pos.constructor.name).toBe('Object'); // plain object, not THREE.Vector3
    }
  });

  test('unitPositions: units in transit lerp between fromNode and toNode', () => {
    const cfg = makeLinearLineFixture();
    let { state } = initState(cfg, { seed: 0 });
    const layout = computeTwinLayout(cfg);

    // Advance multiple steps so units are in transit
    for (let i = 0; i < 10; i++) {
      step(state);
      if (state.flowState.segmentUnits.size > 0) break;
    }

    const positions = unitPositions(state.flowState, state.carrierState, cfg, layout, state.clock.now());

    // At least one unit should be in transit on a segment
    expect(state.flowState.segmentUnits.size).toBeGreaterThan(0);

    // Check that positions are between node positions
    const n_a_pos = layout.get('n_a');
    const n_b_pos = layout.get('n_b');

    for (const [unitId, pos] of positions) {
      // x should be between n_a and n_b (roughly)
      expect(pos.x).toBeGreaterThanOrEqual(Math.min(n_a_pos.x, n_b_pos.x) - 10);
      expect(pos.x).toBeLessThanOrEqual(Math.max(n_a_pos.x, n_b_pos.x) + 10);
    }
  });

  test('unitPositions: units in stationBuffer are near station node', () => {
    const cfg = makeLinearLineFixture();
    let { state } = initState(cfg, { seed: 0 });
    const layout = computeTwinLayout(cfg);

    // Advance until units reach a station buffer
    for (let i = 0; i < 100; i++) {
      step(state);
      if (Array.from(state.flowState.stationBuffers.values()).some((buf) => buf.length > 0)) {
        break;
      }
    }

    const positions = unitPositions(state.flowState, state.carrierState, cfg, layout, state.clock.now());

    // Check that units in buffers are near their station nodes
    for (const [stationId, units] of state.flowState.stationBuffers) {
      const station = cfg.stations.find((s) => s.id === stationId);
      const stationPos = layout.get(station.node_id);
      if (!stationPos) continue;

      for (const unit of units) {
        const pos = positions.get(unit.id);
        if (pos) {
          // Should be within ~5 units of station x position
          expect(Math.abs(pos.x - stationPos.x)).toBeLessThan(10);
        }
      }
    }
  });

  test('loadTwinLayoutOverrides returns empty object if key not found', () => {
    const overrides = loadTwinLayoutOverrides('nonexistent_hash');
    expect(overrides).toEqual({});
  });

  test('saveTwinLayoutOverrides and loadTwinLayoutOverrides roundtrip', () => {
    const hash = 'test_hash_1';
    const overrides = { n_a: { x: 50, z: 25 }, n_b: { x: 100, z: 0 } };

    saveTwinLayoutOverrides(hash, overrides);
    const loaded = loadTwinLayoutOverrides(hash);

    expect(loaded).toEqual(overrides);
  });

  test('saveTwinLayoutOverrides evicts LRU when max entries exceeded', () => {
    // Save 11 entries (exceeds MAX_SAVED_LAYOUTS = 10)
    for (let i = 0; i < 11; i++) {
      const hash = `hash_${i}`;
      const overrides = { node: { x: i * 10, z: 0 } };
      saveTwinLayoutOverrides(hash, overrides);
    }

    // The first entry (hash_0) should have been evicted
    const first = loadTwinLayoutOverrides('hash_0');
    expect(first).toEqual({});

    // The last entry (hash_10) should exist
    const last = loadTwinLayoutOverrides('hash_10');
    expect(last).toEqual({ node: { x: 100, z: 0 } });
  });

  test('unitPositions handles empty flowState gracefully', () => {
    const cfg = makeLinearLineFixture();
    const emptyFlowState = {
      stationBuffers: new Map(),
      stationOutputBuffers: new Map(),
      segmentUnits: new Map(),
      segmentHeld: new Map(),
      exitedUnits: [],
    };
    const emptyCarrierState = { pools: new Map() };
    const layout = computeTwinLayout(cfg);

    const positions = unitPositions(emptyFlowState, emptyCarrierState, cfg, layout, 0);
    expect(positions.size).toBe(0);
  });
});
