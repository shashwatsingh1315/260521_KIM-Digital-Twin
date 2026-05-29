// carriers.js — carrier pool round-trip physics (§7.3, §8.1.3).
//
// Each carrier-served segment has a dedicated pool. Carriers execute:
//   idle → (load_seconds) → loaded traversal → (unload_seconds) → empty return → idle
// If the destination input buffer is full at drop time, the carrier stays
// held_at_dest (shrinks effective fleet; deadlock input for Part B).
// Shift-gated pools (person/forklift) only dispatch during shift hours;
// AMR pools dispatch 24/7.

/**
 * Initialise carrier runtime state from config.
 * Returns a Map<poolId, { pool, seg, pickupQueue, carriers }>.
 */
export function makeCarrierState(config) {
  const pools = new Map();
  for (const seg of config.segments) {
    if (seg.transport.class !== 'carrier') continue;
    const poolId = seg.transport.pool_id;
    const pool = config.carrierPools.find((p) => p.id === poolId);
    if (!pool) continue;
    const carriers = Array.from({ length: pool.count }, (_, i) => ({
      id: `${poolId}:c${i}`,
      state: 'idle',          // 'idle' | 'loaded' | 'held_at_dest' | 'returning'
      unit: null,
      drop_at: Infinity,      // when the loaded carrier arrives at destination
      free_at: Infinity,      // when the returning carrier becomes idle again
    }));
    pools.set(poolId, { pool, seg, pickupQueue: [], carriers });
  }
  return { pools };
}

/**
 * Add a unit to the FIFO pickup queue of the carrier pool serving seg.
 */
export function enqueueForCarrier(carrierState, seg, unit) {
  const entry = carrierState.pools.get(seg.transport.pool_id);
  if (entry) entry.pickupQueue.push(unit);
}

/**
 * Assign idle carriers to units in the pickup queue.
 * Respects shift-gating: shift_gated pools only work during shift hours.
 * Call this after any event that may free a carrier or add to the queue.
 */
export function dispatchCarriers(carrierState, config, now) {
  for (const entry of carrierState.pools.values()) {
    const { pool, seg, pickupQueue, carriers } = entry;
    if (!isCarrierAvailable(pool, config, now)) continue;
    for (const carrier of carriers) {
      if (pickupQueue.length === 0) break;
      if (carrier.state !== 'idle') continue;
      const unit = pickupQueue.shift();
      carrier.state = 'loaded';
      carrier.unit = unit;
      carrier.drop_at = now + loadSec(pool) + traverseSec(seg, pool.speed_loaded_m_per_min);
      carrier.free_at = Infinity;
    }
  }
}

/**
 * Process carrier arrivals at time t: try to deliver units to destination buffers.
 * If buffer full → carrier transitions to held_at_dest (stays busy, doesn't free).
 * Returns list of { unit, stationId } for units successfully delivered.
 */
export function processCarrierDrops(carrierState, flowState, config, t) {
  const nodeToStation = new Map(config.stations.map((s) => [s.node_id, s]));
  const deliveries = [];
  for (const entry of carrierState.pools.values()) {
    for (const carrier of entry.carriers) {
      if (carrier.state === 'loaded' && carrier.drop_at === t) {
        const d = attemptDelivery(carrier, entry, flowState, nodeToStation, t);
        if (d) deliveries.push(d);
      }
    }
  }
  return deliveries;
}

/**
 * Retry held-at-dest carriers after input buffers have been freed.
 * Returns list of { unit, stationId } for newly delivered units.
 */
export function tryFlushCarrierHeld(carrierState, flowState, config, now) {
  const nodeToStation = new Map(config.stations.map((s) => [s.node_id, s]));
  const deliveries = [];
  for (const entry of carrierState.pools.values()) {
    for (const carrier of entry.carriers) {
      if (carrier.state !== 'held_at_dest') continue;
      const d = attemptDelivery(carrier, entry, flowState, nodeToStation, now);
      if (d) deliveries.push(d);
    }
  }
  return deliveries;
}

/**
 * Mark returning carriers as idle when their return trip completes at time t.
 */
export function processCarrierReturns(carrierState, t) {
  for (const { carriers } of carrierState.pools.values()) {
    for (const carrier of carriers) {
      if (carrier.state === 'returning' && carrier.free_at === t) {
        carrier.state = 'idle';
        carrier.free_at = Infinity;
      }
    }
  }
}

/**
 * Earliest future event time from all carrier pools.
 * Only counts loaded (drop_at) and returning (free_at) carriers.
 */
export function nextCarrierEventTime(carrierState) {
  let min = Infinity;
  for (const { carriers } of carrierState.pools.values()) {
    for (const c of carriers) {
      if (c.state === 'loaded' && c.drop_at < min) min = c.drop_at;
      if (c.state === 'returning' && c.free_at < min) min = c.free_at;
    }
  }
  return min;
}

// --- internal helpers ---

function attemptDelivery(carrier, entry, flowState, nodeToStation, now) {
  const { pool, seg } = entry;
  const destStation = nodeToStation.get(seg.to_node_id);
  if (!destStation) return null;
  const buf = flowState.stationBuffers.get(destStation.id);
  if (!buf || buf.length >= destStation.entry_buffer_capacity) {
    // Buffer full — carrier waits (held_at_dest, drop_at cleared so it isn't a future event).
    carrier.state = 'held_at_dest';
    carrier.drop_at = Infinity;
    return null;
  }
  buf.push(carrier.unit);
  const delivered = { unit: carrier.unit, stationId: destStation.id };
  carrier.state = 'returning';
  carrier.free_at = now + unloadSec(pool) + traverseSec(seg, pool.speed_empty_m_per_min);
  carrier.drop_at = Infinity;
  carrier.unit = null;
  return delivered;
}

function loadSec(pool) {
  return pool.load_unload_seconds / 2;
}

function unloadSec(pool) {
  return pool.load_unload_seconds / 2;
}

function traverseSec(seg, speedMPerMin) {
  return (seg.length_m / speedMPerMin) * 60;
}

function isCarrierAvailable(pool, config, now) {
  if (!pool.shift_gated) return true; // AMR: always available
  const shift = config.shifts?.[0];
  if (!shift) return true;
  const cycleSec = 24 * 3600;
  const shiftSec = shift.duration_hours * 3600;
  return (now % cycleSec) < shiftSec;
}
