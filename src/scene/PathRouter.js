import * as THREE from 'three';
import { location_node } from '../data/m800_model.js';
import {
  TRANSPORT_COLUMNS,
  COLUMNS_BY_ID,
  LOCATION_COLUMN_OVERRIDES,
  columnsForFloor,
} from '../data/transport_topology.js';

// ─── Path router ──────────────────────────────────────────────────────────
// Pure module. Given a `from`/`to` location ID and the current layout map,
// returns an ordered list of `THREE.Vector3` waypoints. Particles and path
// lines both consume this — there's exactly one routing implementation in the
// codebase.
//
// Routing rule:
//   1. Same-floor → straight line.
//   2. Same site, different floor → route through nearest transport column
//      that services both floors.
//   3. Cross-site, different floor → route source-column → SF (each side's
//      column) → SF bridge → dest-column at SF → dest-column at dest floor.
//
// Y offset on every waypoint so the polyline sits above the floor.

const Y_OFFSET = 0.4;

const LOC_BY_ID = Object.fromEntries(location_node.map(l => [l.location_id, l]));

function v3(x, y, z) {
  return new THREE.Vector3(x, y + Y_OFFSET, z);
}

// Distance² between an (x, z) point and a column.
function distSqXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

// Pick the column servicing (site, floor) closest to (x, z). Honours overrides.
function nearestColumn(locId, layout) {
  // Override first
  const override = LOCATION_COLUMN_OVERRIDES[locId];
  if (override && COLUMNS_BY_ID[override]) return COLUMNS_BY_ID[override];

  const loc = LOC_BY_ID[locId];
  if (!loc) return null;
  const pos = layout[locId];
  if (!pos) return null;

  const candidates = columnsForFloor(loc.site, loc.floor);
  if (!candidates.length) return null;

  // Bridge type has the lowest priority — pick a real vertical column first.
  const vertical = candidates.filter(c => c.type !== 'bridge');
  const pool = vertical.length ? vertical : candidates;

  let best = pool[0];
  let bestD = distSqXZ(pos, best);
  for (let i = 1; i < pool.length; i++) {
    const d = distSqXZ(pos, pool[i]);
    if (d < bestD) {
      best = pool[i];
      bestD = d;
    }
  }
  return best;
}

const FLOOR_Y_MAP = { GF: 0, FF: 5, SF: 10, '3F': 15, '4F': 20 };

function yForFloor(f) {
  return FLOOR_Y_MAP[f] ?? 0;
}

// Resolve the SF cross-building bridge by its endpoints.
function bridgeEndpoint(side) {
  const br = COLUMNS_BY_ID['BRIDGE-SF'];
  return br?.endpoints?.[side];
}

// ─── Main: routeWaypoints ─────────────────────────────────────────────────
// Returns an array of THREE.Vector3 — at least 2 entries.
export function routeWaypoints(fromId, toId, layout) {
  const A = layout[fromId];
  const B = layout[toId];
  const locA = LOC_BY_ID[fromId];
  const locB = LOC_BY_ID[toId];
  if (!A || !B) return [];

  // External (off-site) endpoints don't have floors / sites — straight line.
  const aExternal = !locA || locA.location_type === 'external' || locA.site === 'EXT';
  const bExternal = !locB || locB.location_type === 'external' || locB.site === 'EXT';
  if (aExternal || bExternal) {
    return [v3(A.x, A.y, A.z), v3(B.x, B.y, B.z)];
  }

  // 1) Same floor → straight line.
  if (Math.abs(A.y - B.y) < 0.01) {
    return [v3(A.x, A.y, A.z), v3(B.x, B.y, B.z)];
  }

  const colA = nearestColumn(fromId, layout);
  const colB = nearestColumn(toId, layout);

  // 2) No column resolvable on one side — fall back to straight line
  //    so the renderer doesn't blank out. Real fix is to declare a column.
  if (!colA || !colB) {
    return [v3(A.x, A.y, A.z), v3(B.x, B.y, B.z)];
  }

  // 3) Same column servicing both floors → simple 3-leg route.
  if (colA.id === colB.id) {
    return [
      v3(A.x, A.y, A.z),
      v3(colA.x, A.y, colA.z),
      v3(colA.x, B.y, colA.z),
      v3(B.x, B.y, B.z),
    ];
  }

  // 4) Same site, different column (shouldn't normally happen, but cover it).
  if (colA.site && colB.site && colA.site === colB.site) {
    // Use colA from A's floor up to a floor both columns service.
    const sharedFloors = colA.floors.filter(f => colB.floors.includes(f));
    const shared = sharedFloors[0] ?? colA.floors[0];
    const sy = yForFloor(shared);
    return [
      v3(A.x, A.y, A.z),
      v3(colA.x, A.y, colA.z),
      v3(colA.x, sy, colA.z),
      v3(colB.x, sy, colB.z),
      v3(colB.x, B.y, colB.z),
      v3(B.x, B.y, B.z),
    ];
  }

  // 5) Cross-site → route via the SF bridge.
  const sfY = yForFloor('SF');
  const kmpEnd = bridgeEndpoint('KMP');
  const whEnd  = bridgeEndpoint('WH');
  if (!kmpEnd || !whEnd) {
    return [v3(A.x, A.y, A.z), v3(B.x, B.y, B.z)];
  }
  const aSide = locA.site === 'KMP' ? kmpEnd : whEnd;
  const bSide = locB.site === 'KMP' ? kmpEnd : whEnd;

  return [
    v3(A.x, A.y, A.z),
    v3(colA.x, A.y, colA.z),         // ride source column to floor of origin
    v3(colA.x, sfY,  colA.z),        // climb to SF in source building
    v3(aSide.x, sfY, aSide.z),        // walk to bridge landing on source side
    v3(bSide.x, sfY, bSide.z),        // cross bridge
    v3(colB.x, sfY,  colB.z),        // walk to dest column at SF
    v3(colB.x, B.y, colB.z),         // ride dest column to dest floor
    v3(B.x, B.y, B.z),
  ];
}

// Cumulative arc-length so progress is uniform across a multi-leg route.
function arcLengths(waypoints) {
  const cum = [0];
  for (let i = 1; i < waypoints.length; i++) {
    cum.push(cum[i - 1] + waypoints[i].distanceTo(waypoints[i - 1]));
  }
  return cum;
}

// Sample a position along the polyline by normalised progress (0..1).
// Pass in pre-computed arc-lengths for hot loops.
export function pointAt(waypoints, t, cum) {
  if (!waypoints || waypoints.length === 0) return new THREE.Vector3();
  if (waypoints.length === 1) return waypoints[0].clone();
  const cumulative = cum || arcLengths(waypoints);
  const total = cumulative[cumulative.length - 1];
  if (total <= 0) return waypoints[0].clone();

  const target = THREE.MathUtils.clamp(t, 0, 1) * total;
  // Linear scan — polylines are short (≤ 8 segs).
  for (let i = 1; i < waypoints.length; i++) {
    if (cumulative[i] >= target) {
      const segT = (target - cumulative[i - 1]) / (cumulative[i] - cumulative[i - 1] || 1);
      return new THREE.Vector3().lerpVectors(waypoints[i - 1], waypoints[i], segT);
    }
  }
  return waypoints[waypoints.length - 1].clone();
}

// Expose for callers that want to cache arc-lengths.
export { arcLengths };
