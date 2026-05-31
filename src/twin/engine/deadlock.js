// deadlock.js — waiting-for graph cycle detection → shock_raised (§8.1.6).
//
// Called when the engine stalls (t === Infinity) with active orders.
// Builds a waiting-for graph from engine state, detects cycles via DFS.
// A cycle = deadlock → emit one shock_raised with cycle members and reason.
// No cycle = benign starvation (work simply ran out) → return [] (no shock).

import { shockRaised } from './events.js';

/**
 * Inspect engine state for deadlock. Returns an array of shock events (0 or 1).
 */
export function detectDeadlock(flowState, carrierState, config, orders, now) {
  const active = orders.filter(
    (o) => o.status === 'pending' || o.status === 'in_progress',
  );
  if (active.length === 0) return [];

  // If there are no units anywhere in the system, it's pure starvation —
  // the orders just couldn't be fulfilled (e.g. missing components).
  if (!hasUnitsInSystem(flowState, carrierState)) return [];

  const edges = buildWaitingForGraph(flowState, carrierState, config);
  const cycle = findCycle(edges);
  if (!cycle) return [];

  return [shockRaised(now, 'deadlock: circular wait', cycle)];
}

// ── graph construction ──────────────────────────────────────────────────────

function buildWaitingForGraph(flowState, carrierState, config) {
  const nodeToStation = new Map(config.stations.map((s) => [s.node_id, s]));
  const segMap = new Map(config.segments.map((s) => [s.id, s]));
  const processMap = new Map(config.processes.map((p) => [p.id, p]));
  const edges = new Map();

  function addEdge(from, to) {
    if (from === to) return; // self-loops don't form deadlocks
    if (!edges.has(from)) edges.set(from, new Set());
    edges.get(from).add(to);
  }

  // 1. Station output blocked → waiting for outbound segment to clear.
  //    The segment is full because the downstream station's buffer is full.
  for (const station of config.stations) {
    const outBuf = flowState.stationOutputBuffers.get(station.id);
    if (!outBuf || outBuf.length === 0) continue;
    for (const seg of config.segments.filter((s) => s.from_node_id === station.node_id)) {
      const occ = (flowState.segmentUnits.get(seg.id)?.length ?? 0) +
                  (flowState.segmentHeld.get(seg.id)?.length ?? 0);
      if (occ >= seg.capacity) {
        const destStation = nodeToStation.get(seg.to_node_id);
        if (destStation) {
          addEdge(`station:${station.id}`, `station:${destStation.id}`);
        }
      }
    }
  }

  // 2. Segment with held arrivals → blocked by destination buffer full.
  //    The destination station can't drain its buffer (output blocked) → cycle candidate.
  for (const [segId, held] of flowState.segmentHeld.entries()) {
    if (held.length === 0) continue;
    const seg = segMap.get(segId);
    if (!seg) continue;
    const destStation = nodeToStation.get(seg.to_node_id);
    if (!destStation) continue;
    const srcStation = nodeToStation.get(seg.from_node_id);
    // seg is waiting for destStation to free buffer space.
    addEdge(`seg:${segId}`, `station:${destStation.id}`);
    // The upstream station is blocked waiting for the segment to accept a unit.
    if (srcStation) {
      addEdge(`station:${srcStation.id}`, `seg:${segId}`);
    }
  }

  // 3. Assembly kitting stall: station has partial kit; missing component is held
  //    in an inbound segment → that segment is blocked by this station's full buffer.
  for (const station of config.stations) {
    const buf = flowState.stationBuffers.get(station.id);
    if (!buf || buf.length === 0) continue;
    for (const stProc of station.processes) {
      const proc = processMap.get(stProc.process_id);
      if (!proc || proc.kind !== 'assembly') continue;
      const have = new Map();
      for (const u of buf) have.set(u.material, (have.get(u.material) ?? 0) + 1);
      for (const [mat, needed] of Object.entries(proc.bom)) {
        if ((have.get(mat) ?? 0) >= needed) continue;
        // Missing `mat` — check if any unit of that type is held in an inbound segment.
        for (const [segId, held] of flowState.segmentHeld.entries()) {
          const seg = segMap.get(segId);
          if (!seg || seg.to_node_id !== station.node_id) continue;
          if (held.some((h) => h.unit.material === mat)) {
            // station needs mat → mat is in seg → seg is blocked by station's full buffer
            addEdge(`station:${station.id}`, `seg:${segId}`);
            addEdge(`seg:${segId}`, `station:${station.id}`);
          }
        }
      }
    }
  }

  // 4. Carrier held at destination → waiting for destination buffer to free.
  for (const [, entry] of carrierState.pools.entries()) {
    const { seg, carriers } = entry;
    for (const carrier of carriers) {
      if (carrier.state !== 'held_at_dest') continue;
      const destStation = nodeToStation.get(seg.to_node_id);
      if (!destStation) continue;
      addEdge(`carrier:${carrier.id}`, `station:${destStation.id}`);
      const srcStation = nodeToStation.get(seg.from_node_id);
      if (srcStation) {
        addEdge(`station:${srcStation.id}`, `carrier:${carrier.id}`);
      }
    }
  }

  return edges;
}

// ── cycle detection (DFS) ───────────────────────────────────────────────────

function findCycle(edges) {
  const visited = new Set();
  const recStack = new Set();
  const path = [];

  function dfs(node) {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    for (const neighbor of (edges.get(node) || [])) {
      if (!visited.has(neighbor)) {
        const cycle = dfs(neighbor);
        if (cycle) return cycle;
      } else if (recStack.has(neighbor)) {
        const start = path.indexOf(neighbor);
        return path.slice(start); // ordered cycle members
      }
    }

    recStack.delete(node);
    path.pop();
    return null;
  }

  for (const node of edges.keys()) {
    if (!visited.has(node)) {
      const cycle = dfs(node);
      if (cycle) return cycle;
    }
  }
  return null;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function hasUnitsInSystem(flowState, carrierState) {
  for (const buf of flowState.stationBuffers.values()) {
    if (buf.length > 0) return true;
  }
  for (const buf of flowState.stationOutputBuffers.values()) {
    if (buf.length > 0) return true;
  }
  for (const held of flowState.segmentHeld.values()) {
    if (held.length > 0) return true;
  }
  for (const { carriers, pickupQueue } of carrierState.pools.values()) {
    if (pickupQueue.length > 0) return true;
    if (carriers.some((c) => c.state !== 'idle')) return true;
  }
  return false;
}
