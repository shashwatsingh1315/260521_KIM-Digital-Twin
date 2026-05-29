// snapshot.js — immutable versioned checkpoint of engine state (Part C2).
//
// snapshot(state) → token   — deep-frozen, structurally-copied engine state
// restore(token, config)    → state — live mutable engine state from token
//
// Enables deterministic rewind: restore(snapshot(state)) then step N times
// produces the exact same event log as the original N steps from that point.

import { makeClock } from '../clock.js';
import { makeRng } from '../../util/rng.js';

// ---- Serialization helpers ----

function cloneUnit(u) {
  if (!u) return null;
  const out = { ...u };
  if (u._kit) out._kit = u._kit.map(cloneUnit);
  return out;
}

function cloneSlot(slot) {
  const out = {
    busy: slot.busy,
    unit_id: slot.unit_id,
    process_id: slot.process_id,
    station_id: slot.station_id,
    completion_time: slot.completion_time,
  };
  if (slot._unit !== undefined) out._unit = cloneUnit(slot._unit);
  return out;
}

function cloneCarrier(c) {
  return {
    id: c.id,
    state: c.state,
    unit: cloneUnit(c.unit),
    drop_at: c.drop_at,
    free_at: c.free_at,
  };
}

// ---- Public API ----

/**
 * Capture a frozen checkpoint of engine state.
 * config is NOT included in the token — pass it to restore().
 * @param {object} state  engine state from initState/step
 * @returns {object} frozen token
 */
export function snapshot(state) {
  const { clock, rng, orders, govState, schedState, flowState, carrierState } = state;

  const schedSlots = [];
  for (const [key, slotArr] of schedState.slots) {
    schedSlots.push({ key, slots: slotArr.map(cloneSlot) });
  }

  const stationBuffers = [];
  for (const [id, units] of flowState.stationBuffers) {
    stationBuffers.push([id, units.map(cloneUnit)]);
  }
  const stationOutputBuffers = [];
  for (const [id, units] of flowState.stationOutputBuffers) {
    stationOutputBuffers.push([id, units.map(cloneUnit)]);
  }
  const segmentUnits = [];
  for (const [id, entries] of flowState.segmentUnits) {
    segmentUnits.push([id, entries.map((e) => ({ unit: cloneUnit(e.unit), arrival_time: e.arrival_time }))]);
  }
  const segmentHeld = [];
  for (const [id, entries] of flowState.segmentHeld) {
    segmentHeld.push([id, entries.map((e) => ({ unit: cloneUnit(e.unit) }))]);
  }
  const exitedUnits = flowState.exitedUnits.map((e) => ({
    unit: cloneUnit(e.unit), exit_id: e.exit_id, time: e.time,
  }));

  const carrierPools = [];
  for (const [poolId, entry] of carrierState.pools) {
    carrierPools.push({
      poolId,
      pickupQueue: entry.pickupQueue.map(cloneUnit),
      carriers: entry.carriers.map(cloneCarrier),
    });
  }

  return Object.freeze({
    clockTime: clock.now(),
    rngSeed: rng.seed(),
    orders: orders.map((o) => ({ ...o })),
    govState: { wipCount: govState.wipCount },
    schedSlots,
    stationBuffers,
    stationOutputBuffers,
    segmentUnits,
    segmentHeld,
    exitedUnits,
    carrierPools,
  });
}

/**
 * Reconstruct live engine state from a snapshot token.
 * The returned state is ready to pass to step().
 * @param {object} token  from snapshot()
 * @param {object} config FactoryConfig (same one used to produce the token)
 * @returns {object} engine state
 */
export function restore(token, config) {
  const clock = makeClock(token.clockTime);
  const rng = makeRng(token.rngSeed);

  const orders = token.orders.map((o) => ({ ...o }));
  const govState = { wipCount: token.govState.wipCount };

  // Rebuild schedState.
  const schedSlots = new Map();
  for (const { key, slots } of token.schedSlots) {
    schedSlots.set(key, slots.map(cloneSlot));
  }
  const schedState = { slots: schedSlots };

  // Rebuild flowState.
  const stationBuffers = new Map(token.stationBuffers.map(([id, units]) => [id, units.map(cloneUnit)]));
  const stationOutputBuffers = new Map(token.stationOutputBuffers.map(([id, units]) => [id, units.map(cloneUnit)]));
  const segmentUnits = new Map(token.segmentUnits.map(([id, entries]) =>
    [id, entries.map((e) => ({ unit: cloneUnit(e.unit), arrival_time: e.arrival_time }))]));
  const segmentHeld = new Map(token.segmentHeld.map(([id, entries]) =>
    [id, entries.map((e) => ({ unit: cloneUnit(e.unit) }))]));
  const exitedUnits = token.exitedUnits.map((e) => ({
    unit: cloneUnit(e.unit), exit_id: e.exit_id, time: e.time,
  }));

  const flowState = { stationBuffers, stationOutputBuffers, segmentUnits, segmentHeld, exitedUnits };
  flowState._config = config;

  // Rebuild carrierState.
  const pools = new Map();
  for (const { poolId, pickupQueue, carriers } of token.carrierPools) {
    const seg = config.segments.find((s) => s.transport.class === 'carrier' && s.transport.pool_id === poolId);
    const pool = config.carrierPools.find((p) => p.id === poolId);
    if (!pool || !seg) continue;
    pools.set(poolId, {
      pool,
      seg,
      pickupQueue: pickupQueue.map(cloneUnit),
      carriers: carriers.map(cloneCarrier),
    });
  }
  const carrierState = { pools };

  // Lookup tables derived from config (not snapshotted).
  const stationMap = new Map(config.stations.map((s) => [s.id, s]));
  const processMap = new Map(config.processes.map((p) => [p.id, p]));
  const nodeToStation = new Map(config.stations.map((s) => [s.node_id, s]));
  const intakeNodes = new Set(config.nodes.filter((n) => n.type === 'intake').map((n) => n.id));
  const intakeSegments = config.segments.filter((s) => intakeNodes.has(s.from_node_id));
  const exitIds = new Set(config.exits.map((e) => e.id));

  return {
    config, rng, clock, orders, govState, schedState, flowState, carrierState,
    stationMap, processMap, nodeToStation, intakeSegments, exitIds,
  };
}
