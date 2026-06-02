// twinLayout.js — DAG-based position assignment + unit position computation.
//
// Exports:
//   computeTwinLayout(config, overrides) → {nodeId: {x,y,z}}
//   loadTwinLayoutOverrides(configHash) → overrides object
//   saveTwinLayoutOverrides(configHash, overrides)
//   unitPositions(flowState, carrierState, config, nodePositions, now)
//     → Map<unitId, {x,y,z}>

import { computeTwinLayout as dagLayout } from '../../layout/autoLayout.js';

// localStorage-backed layout overrides (max 10 entries, LRU eviction).
const MAX_SAVED_LAYOUTS = 10;
const OVERRIDE_PREFIX = 'twin_layout_';

function configHash(cfg) {
  // Simple hash: count of stations × count of segments
  return `${cfg.stations.length}_${cfg.segments.length}`;
}

export function loadTwinLayoutOverrides(hash) {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDE_PREFIX + hash) || '{}');
  } catch {
    return {};
  }
}

export function saveTwinLayoutOverrides(hash, overrides) {
  try {
    // Evict LRU if we exceed max saved layouts
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(OVERRIDE_PREFIX)) keys.push(k);
    }
    if (keys.length >= MAX_SAVED_LAYOUTS) {
      // Remove the first (oldest) one
      localStorage.removeItem(keys[0]);
    }
    localStorage.setItem(OVERRIDE_PREFIX + hash, JSON.stringify(overrides));
  } catch { /* ignore */ }
}

/**
 * Compute 3D positions from FactoryConfig DAG of nodes/segments.
 * @param {object} config  FactoryConfig
 * @param {object} [overrides]  {nodeId: {x,z}} manual position overrides
 * @returns {Map<nodeId, {x,y,z}>}
 */
export function computeTwinLayout(config, overrides = {}) {
  const layout = dagLayout(config.nodes, config.segments, overrides);
  // dagLayout returns object {nodeId: {x,y,z}}, convert to Map for efficient lookup
  return new Map(Object.entries(layout));
}

export function orthogonalPath(from, to) {
  const pts = [ { x: from.x, y: from.y, z: from.z } ];
  
  if (Math.abs(from.y - to.y) > 0.01) {
    // Elevator: go vertical first
    pts.push({ x: from.x, y: to.y, z: from.z });
  }

  // Same floor: Manhattan routing (X then Z)
  if (Math.abs(from.x - to.x) > 0.01 && Math.abs(from.z - to.z) > 0.01) {
    pts.push({ x: to.x, y: to.y, z: from.z });
  }

  pts.push({ x: to.x, y: to.y, z: to.z });
  return pts;
}

export function interpolateOrthogonal(pts, t) {
  let totalLen = 0;
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i+1];
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
    segs.push({ p1, p2, len });
    totalLen += len;
  }
  
  if (totalLen === 0) return { ...pts[0] };

  const targetDist = Math.max(0, Math.min(1, t)) * totalLen;
  let accumulated = 0;

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (accumulated + seg.len >= targetDist || i === segs.length - 1) {
      const segT = seg.len > 0 ? (targetDist - accumulated) / seg.len : 0;
      return {
        x: seg.p1.x + (seg.p2.x - seg.p1.x) * segT,
        y: seg.p1.y + (seg.p2.y - seg.p1.y) * segT,
        z: seg.p1.z + (seg.p2.z - seg.p1.z) * segT,
      };
    }
    accumulated += seg.len;
  }
  return { ...pts[pts.length - 1] };
}

/**
 * Compute 3D positions of all in-flight units at a given time.
 * @param {object} flowState
 * @param {object} carrierState
 * @param {object} config     FactoryConfig
 * @param {Map} nodePositions  from computeTwinLayout
 * @param {number} now         current simulation time (seconds)
 * @returns {Map<unitId, {x,y,z}>}
 */
export function unitPositions(flowState, carrierState, config, nodePositions, now) {
  const positions = new Map();
  const segmentMap = new Map(config.segments.map((s) => [s.id, s]));
  const nodeMap = new Map(config.nodes.map((n) => [n.id, n]));
  const stationMap = new Map(config.stations.map((s) => [s.node_id, s]));

  // Helper: interpolate position along a segment path.
  function positionOnSegment(fromId, toId, t) {
    const from = nodePositions.get(fromId);
    const to = nodePositions.get(toId);
    if (!from || !to) return { x: 0, y: 0, z: 0 };
    const pts = orthogonalPath(from, to);
    return interpolateOrthogonal(pts, t);
  }

  // Units in transit on segments
  for (const [segId, units] of flowState.segmentUnits) {
    const seg = segmentMap.get(segId);
    if (!seg) continue;

    const travelSeconds = (seg.length_m / seg.transport.speed_m_per_min) * 60;

    for (const entry of units) {
      const { unit, arrival_time } = entry;
      const launchTime = arrival_time - travelSeconds;
      const t = (now - launchTime) / travelSeconds;
      const pos = positionOnSegment(seg.from_node_id, seg.to_node_id, t);
      // Slightly above the ground to avoid z-fighting
      pos.y += 0.2;
      positions.set(unit.id, pos);
    }
  }

  // Units held on segments (arrived but destination buffer full)
  for (const [segId, entries] of flowState.segmentHeld) {
    const seg = segmentMap.get(segId);
    if (!seg) continue;

    for (const entry of entries) {
      const { unit } = entry;
      const toPos = nodePositions.get(seg.to_node_id);
      if (toPos) {
        positions.set(unit.id, { x: toPos.x, y: toPos.y + 0.2, z: toPos.z });
      }
    }
  }

  // Units in station input buffers
  for (const [stationId, units] of flowState.stationBuffers) {
    const station = stationMap.get(stationId);
    if (!station) continue;

    const stationPos = nodePositions.get(station.node_id);
    if (!stationPos) continue;

    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      // Offset by slot index perpendicular to main flow (x-direction)
      positions.set(unit.id, {
        x: stationPos.x + (i - Math.floor(units.length / 2)) * 1.5,
        y: stationPos.y + 0.3,
        z: stationPos.z,
      });
    }
  }

  // Units in station output buffers (similar offset)
  for (const [stationId, units] of flowState.stationOutputBuffers) {
    const station = stationMap.get(stationId);
    if (!station) continue;

    const stationPos = nodePositions.get(station.node_id);
    if (!stationPos) continue;

    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      // Offset in the +z direction to distinguish from input buffer
      positions.set(unit.id, {
        x: stationPos.x,
        y: stationPos.y + 0.3,
        z: stationPos.z + 2 + (i - Math.floor(units.length / 2)) * 1.5,
      });
    }
  }

  // Carrier-transported units
  for (const [poolId, entry] of carrierState.pools) {
    const { seg, carriers } = entry;
    if (!seg) continue;

    for (const carrier of carriers) {
      if (!carrier.unit || carrier.state === 'idle') continue;

      // Unit is being transported by this carrier
      const unit = carrier.unit;

      if (carrier.state === 'loaded') {
        // In transit: lerp from seg.from to seg.to based on drop_at timing
        const loadTime = carrier.drop_at - (seg.length_m / carrier.speed_loaded) * 60;
        const dropTime = carrier.drop_at;
        const traverseTime = dropTime - loadTime;
        const t = Math.min(1, (now - loadTime) / traverseTime);
        const pos = positionOnSegment(seg.from_node_id, seg.to_node_id, t);
        pos.y += 0.2;
        positions.set(unit.id, pos);
      } else if (carrier.state === 'held_at_dest') {
        // Waiting at destination for buffer to have space
        const toPos = nodePositions.get(seg.to_node_id);
        if (toPos) {
          positions.set(unit.id, { x: toPos.x, y: toPos.y + 0.2, z: toPos.z });
        }
      } else if (carrier.state === 'returning') {
        // Empty return trip (no unit shown, but for completeness)
      }
    }
  }

  return positions;
}
