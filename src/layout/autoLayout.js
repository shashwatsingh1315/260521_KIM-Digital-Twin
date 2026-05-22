// Option B: Derive 3D positions from site / floor / block / zone hierarchy.
// Returns { location_id → { x, y, z } }
// y = elevation (floor). x, z = horizontal plane (top-down layout).
// Manual overrides from localStorage are merged on top — those win.

const FLOOR_Y = { GF: 0, FF: 5, SF: 10, '3F': 15 };

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

  'LOC-KMP-3F-FAT':       { x: -14, z: 0  },

  'LOC-WH-SF-RAMP':       { x: 6,   z: 0  },

  'LOC-WH-GF-ASRS-IN':    { x: 10,  z: -3 },
  'LOC-WH-GF-ASRS-OUT':   { x: 10,  z: 3  },
  'LOC-WH-GF-ASRS':       { x: 12,  z: 0  },
  'LOC-WH-GF-FG-ASRS':    { x: 14,  z: 4  },
  'LOC-WH-GF-VC':         { x: 17,  z: 0  },
  'LOC-WH-GF-PACK':       { x: 21,  z: 0  },
  // FF Line A and SF Line B — same x/z column as GF, elevated by floor y
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
