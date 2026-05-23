// Transport-column graph. Every floor-crossing material move MUST route through
// one of these columns. The router in `src/scene/PathRouter.js` consumes this
// declaration; never edit routing rules elsewhere — change the column set here
// or the per-location override map below.
//
// Each record describes ONE physical column (a lift shaft, an ASRS rack, a
// stair, or the SF cross-building bridge). The `floors` array lists which
// floors that column actually services.

export const TRANSPORT_COLUMNS = [
  // KMP — production building
  { id: 'KMP-LIFT',  type: 'lift',   site: 'KMP', x: -20, z: -4, floors: ['GF', 'FF', 'SF'] },
  { id: 'KMP-VRC',   type: 'vrc',    site: 'KMP', x: -20, z:  4, floors: ['GF', 'FF', 'SF'] },
  { id: 'KMP-STAIR', type: 'stair',  site: 'KMP', x: -10, z: -4, floors: ['SF', '3F']      },

  // WH — warehouse building
  { id: 'WH-LIFT',   type: 'lift',   site: 'WH',  x:  27, z: -4, floors: ['GF', 'FF', 'SF', '3F', '4F'] },
  { id: 'WH-ASRS',   type: 'asrs',   site: 'WH',  x:  12, z:  0, floors: ['GF', 'FF', 'SF', '3F', '4F'] },

  // Cross-building bridge at SF level. `endpoints` are the two on-floor
  // landings; the router stops at each landing rather than the centerline.
  {
    id: 'BRIDGE-SF',
    type: 'bridge',
    site: null,
    x: 4.5, z: 0,
    floors: ['SF'],
    endpoints: {
      KMP: { x: 3, z: 0 },
      WH:  { x: 6, z: 0 },
    },
  },
];

// Per-leaf-location overrides. By default the router picks the nearest column
// servicing the source/destination floor; entries here force a specific column.
// Use only when "nearest" picks the wrong column (e.g., ASRS in/out should
// always use the ASRS crane, never the dedicated WH lift even if it's closer).
export const LOCATION_COLUMN_OVERRIDES = {
  'LOC-WH-GF-ASRS-IN':  'WH-ASRS',
  'LOC-WH-GF-ASRS-OUT': 'WH-ASRS',
  'LOC-WH-GF-FG-ASRS':  'WH-ASRS',
};

// Map a column id → record (constant-time lookup).
export const COLUMNS_BY_ID = Object.fromEntries(TRANSPORT_COLUMNS.map(c => [c.id, c]));

// Helper: which columns service a given floor at a given site?
export function columnsForFloor(site, floor) {
  return TRANSPORT_COLUMNS.filter(c =>
    (c.site === null || c.site === site) && c.floors.includes(floor),
  );
}
