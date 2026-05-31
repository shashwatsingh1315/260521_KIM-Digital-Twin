// TaktScheduler — per-station slot state and next-event clock (§5).
//
// Tracks, per (station, slot), whether the slot is busy and when it completes.
// The engine's main loop calls nextEventTime() to know how far to advance the clock.

/**
 * Initialize scheduler state from a FactoryConfig.
 * Returns a mutable state object; treated as part of engine state.
 */
export function makeSchedulerState(config) {
  // slots: Map<stationId, Array<{busy, unit_id, process_id, completion_time}>>
  const slots = new Map();
  for (const station of config.stations) {
    for (const stProc of station.processes) {
      const key = `${station.id}:${stProc.process_id}`;
      const slotArr = Array.from({ length: stProc.parallel_slots }, () => ({
        busy: false,
        unit_id: null,
        process_id: stProc.process_id,
        station_id: station.id,
        completion_time: Infinity,
      }));
      slots.set(key, slotArr);
    }
  }
  return { slots };
}

/**
 * Earliest completion time across all busy slots.
 */
export function nextEventTime(schedulerState) {
  let min = Infinity;
  for (const slotArr of schedulerState.slots.values()) {
    for (const slot of slotArr) {
      if (slot.busy && slot.completion_time < min) {
        min = slot.completion_time;
      }
    }
  }
  return min;
}

/**
 * All busy slots whose completion_time === t, in deterministic order.
 * Returns array of slot objects (mutable references).
 */
export function dueCompletions(schedulerState, t) {
  const due = [];
  for (const slotArr of schedulerState.slots.values()) {
    for (const slot of slotArr) {
      if (slot.busy && slot.completion_time === t) {
        due.push(slot);
      }
    }
  }
  // Deterministic: sort by station_id then process_id then slot position.
  due.sort((a, b) => {
    const sk = a.station_id.localeCompare(b.station_id);
    if (sk !== 0) return sk;
    return a.process_id.localeCompare(b.process_id);
  });
  return due;
}

/**
 * Start processing a unit in the first free slot for (stationId, processId).
 * Returns the slot, or null if no free slot exists.
 */
export function startSlot(schedulerState, stationId, processId, unitId, now, taktSeconds) {
  const key = `${stationId}:${processId}`;
  const slotArr = schedulerState.slots.get(key);
  if (!slotArr) return null;
  const slot = slotArr.find((s) => !s.busy);
  if (!slot) return null;
  slot.busy = true;
  slot.unit_id = unitId;
  slot.completion_time = now + taktSeconds;
  return slot;
}

/**
 * Free a slot after completing its work.
 */
export function freeSlot(slot) {
  slot.busy = false;
  slot.unit_id = null;
  slot.completion_time = Infinity;
}

/**
 * Count free slots for a given (stationId, processId).
 */
export function freeSlotCount(schedulerState, stationId, processId) {
  const key = `${stationId}:${processId}`;
  const slotArr = schedulerState.slots.get(key) || [];
  return slotArr.filter((s) => !s.busy).length;
}
