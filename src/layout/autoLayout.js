// Option B: Derive 3D positions from site / floor / block / zone hierarchy.
// Returns { location_id → { x, y, z } }
// y = elevation (floor). x, z = horizontal plane (top-down layout).
// Manual overrides from localStorage are merged on top — those win.

const FLOOR_Y = { GF: 0, FF: 5, SF: 10, '3F': 15, '4F': 20 };

// Per-location explicit positions (auto-layout baseline).
// x/z are the top-down coordinates. y is computed from floor.
// Layout intent: KMP left cluster (x < 0), WH right cluster (x > 0).
// Z axis: negative = "back" (lifts/VRC), positive = "front" (main flow).
const BASELINE = {
  'EXTERNAL-SUPPLIER':    { x: -42, z: 0  },
  'LOC-KMP-GF-GATE':      { x: -34, z: 0  },
  'LOC-KMP-GF-DOCK3':     { x: -28, z: 0  },
  'LOC-KMP-GF-IQC':       { x: -22, z: 0  },
  'LOC-KMP-GF-LIFT':      { x: -20, z: -4 },
  'LOC-KMP-GF-VRC':       { x: -20, z: 4  },
  'LOC-KMP-GF-SMT':       { x: -14, z: 4  },
  'LOC-KMP-GF-FCT':       { x: -10, z: 4  },

  'LOC-KMP-FF-LIFT':      { x: -20, z: -4 },
  'LOC-KMP-FF-ESTORE':    { x: -16, z: -4 },
  'LOC-KMP-FF-VRC':       { x: -20, z: 4  },

  'LOC-KMP-SF-LIFT':      { x: -20, z: -4 },
  'LOC-KMP-SF-VRC':       { x: -20, z: 4  },
  'LOC-KMP-SF-A-TRSS':    { x: -14, z: 0  },
  'LOC-KMP-SF-B-WIP':     { x: -8,  z: 0  },
  'LOC-KMP-SF-B-1P':      { x: -4,  z: 0  },
  'LOC-KMP-SF-SFG-PACK':  { x: 0,   z: 0  },
  'LOC-KMP-SF-RAMP':      { x: 3,   z: 0  },
  'LOC-KMP-SF-STAIR':     { x: -10, z: -4 },

  'LOC-KMP-3F-FAT':       { x: -14, z: 0  },
  'LOC-KMP-3F-STAIR':     { x: -10, z: -4 },

  // WH material lift (column at x=27, z=-4 — opposite side of WH from ASRS)
  'LOC-WH-GF-LIFT':       { x: 27,  z: -4 },
  'LOC-WH-FF-LIFT':       { x: 27,  z: -4 },
  'LOC-WH-SF-LIFT':       { x: 27,  z: -4 },
  'LOC-WH-3F-LIFT':       { x: 27,  z: -4 },
  'LOC-WH-4F-LIFT':       { x: 27,  z: -4 },

  'LOC-WH-SF-RAMP':       { x: 6,   z: 0  },

  'LOC-WH-GF-ASRS-IN':    { x: 10,  z: -3 },
  'LOC-WH-GF-ASRS-OUT':   { x: 10,  z: 3  },
  'LOC-WH-GF-ASRS':       { x: 12,  z: 0  },
  'LOC-WH-GF-FG-ASRS':    { x: 14,  z: 4  },
  // VC + Pack live only on FF (Line A) and SF (Line B) — no GF instance.
  'LOC-WH-FF-VC':         { x: 17,  z: 0  },
  'LOC-WH-FF-PACK':       { x: 21,  z: 0  },
  'LOC-WH-SF-VC':         { x: 17,  z: 0  },
  'LOC-WH-SF-PACK':       { x: 21,  z: 0  },
  'LOC-WH-GF-IQC':        { x: 26,  z: 0  },
  'LOC-WH-GF-INWARD':     { x: 29,  z: 0  },
  'LOC-WH-GF-GATE':       { x: 34,  z: 0  },
  'LOC-WH-GF-DISPATCH':   { x: 20,  z: 6  },

  'LOC-CUSTOMER':          { x: 42,  z: 0  },
};

const OVERRIDE_KEY = 'm800_layout_overrides';

export function loadOverrides() {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveOverrides(overrides) {
  try {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
  } catch { /* ignore */ }
}

export function resetOverrides() {
  try {
    localStorage.removeItem(OVERRIDE_KEY);
  } catch { /* ignore */ }
}

// Returns { location_id → THREE.Vector3-compatible { x, y, z } }
export function computeLayout(locationNodes, overrides = {}) {
  const layout = {};

  for (const loc of locationNodes) {
    const id = loc.location_id;
    // y = floor elevation
    const y = FLOOR_Y[loc.floor] ?? 0;

    // Start from baseline, then apply override
    const base = BASELINE[id] || { x: 0, z: 0 };
    const over = overrides[id] || {};

    layout[id] = {
      x: over.x ?? base.x,
      y,
      z: over.z ?? base.z,
    };
  }

  return layout;
}

// Generalized DAG layout: assign positions to any nodes in a directed graph.
// Performs topological sort and assigns x = depth * LANE_WIDTH, z = index * LANE_DEPTH.
// y is always 0 (ground level); the Twin UI can assign y per-story if needed.
// overrides = { nodeId: { x, z } } are applied after baseline.
const LANE_WIDTH = 15;
const LANE_DEPTH = 8;

function topologicalSort(nodes, edges) {
  const adj = new Map(nodes.map((n) => [n.id, []]));
  const inDegree = new Map(nodes.map((n) => [n.id, 0]));

  for (const edge of edges) {
    if (!adj.has(edge.from_node_id)) continue;
    adj.get(edge.from_node_id).push(edge.to_node_id);
    inDegree.set(edge.to_node_id, (inDegree.get(edge.to_node_id) || 0) + 1);
  }

  const queue = [...nodes].filter((n) => inDegree.get(n.id) === 0);
  const sorted = [];
  while (queue.length) {
    const node = queue.shift();
    sorted.push(node.id);
    for (const next of adj.get(node.id)) {
      inDegree.set(next, inDegree.get(next) - 1);
      if (inDegree.get(next) === 0) {
        queue.push(...nodes.filter((n) => n.id === next));
      }
    }
  }
  return sorted;
}

export function computeTwinLayout(nodes, edges, overrides = {}) {
  const sorted = topologicalSort(nodes, edges);

  // Assign depths (x position)
  const depths = new Map();
  for (const id of sorted) {
    let maxInDepth = -1;
    for (const edge of edges) {
      if (edge.to_node_id === id && depths.has(edge.from_node_id)) {
        maxInDepth = Math.max(maxInDepth, depths.get(edge.from_node_id));
      }
    }
    depths.set(id, maxInDepth + 1);
  }

  // Group by depth and assign z positions within each layer
  const byDepth = new Map();
  for (const id of sorted) {
    const d = depths.get(id);
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d).push(id);
  }

  const layout = {};
  for (const [d, ids] of byDepth) {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const over = overrides[id] || {};
      layout[id] = {
        x: over.x ?? d * LANE_WIDTH,
        y: over.y ?? 0,
        z: over.z ?? (i - Math.floor(ids.length / 2)) * LANE_DEPTH,
      };
    }
  }

  return layout;
}
