// Event types (§5.1) — deterministic, frozen records.
//
// The engine emits these to the event log. Tie-breaking by stable key ensures
// reproducibility. All timestamps are in seconds.

export const EVENT_TYPE = Object.freeze({
  UNIT_CREATED: 'unit_created',
  UNIT_MOVED: 'unit_moved',
  STATION_STARTED: 'station_started',
  STATION_COMPLETED: 'station_completed',
  UNIT_EXITED: 'unit_exited',
  SCRAPPED: 'scrapped',
  SHOCK_RAISED: 'shock_raised',
});

/**
 * @param {string} type           EVENT_TYPE
 * @param {number} timestamp      seconds
 * @param {object} [data]         event-specific fields
 */
function makeEvent(type, timestamp, data = {}) {
  return Object.freeze({
    type,
    timestamp,
    ...data,
  });
}

export function unitCreated(timestamp, unitId, orderId, material) {
  return makeEvent(EVENT_TYPE.UNIT_CREATED, timestamp, {
    unit_id: unitId,
    order_id: orderId,
    material,
  });
}

export function unitMoved(timestamp, unitId, fromLocation, toLocation) {
  return makeEvent(EVENT_TYPE.UNIT_MOVED, timestamp, {
    unit_id: unitId,
    from_location: fromLocation,
    to_location: toLocation,
  });
}

export function stationStarted(timestamp, stationId, processId, unitId) {
  return makeEvent(EVENT_TYPE.STATION_STARTED, timestamp, {
    station_id: stationId,
    process_id: processId,
    unit_id: unitId,
  });
}

export function stationCompleted(timestamp, stationId, processId, unitId) {
  return makeEvent(EVENT_TYPE.STATION_COMPLETED, timestamp, {
    station_id: stationId,
    process_id: processId,
    unit_id: unitId,
  });
}

export function unitExited(timestamp, unitId, exitId, material) {
  return makeEvent(EVENT_TYPE.UNIT_EXITED, timestamp, {
    unit_id: unitId,
    exit_id: exitId,
    material,
  });
}

export function scrapped(timestamp, unitId) {
  return makeEvent(EVENT_TYPE.SCRAPPED, timestamp, {
    unit_id: unitId,
  });
}

export function shockRaised(timestamp, reason, members = []) {
  return makeEvent(EVENT_TYPE.SHOCK_RAISED, timestamp, {
    reason,
    members,
  });
}

/**
 * Sort events by timestamp, then by stable key for deterministic ordering.
 */
export function sortEvents(events) {
  return [...events].sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    // Tie-break by type order.
    const typeOrder = [
      EVENT_TYPE.UNIT_CREATED,
      EVENT_TYPE.UNIT_MOVED,
      EVENT_TYPE.STATION_STARTED,
      EVENT_TYPE.STATION_COMPLETED,
      EVENT_TYPE.UNIT_EXITED,
      EVENT_TYPE.SCRAPPED,
      EVENT_TYPE.SHOCK_RAISED,
    ];
    const aType = typeOrder.indexOf(a.type);
    const bType = typeOrder.indexOf(b.type);
    if (aType !== bType) return aType - bType;

    // For same type/time, use id fields if present.
    const aId = a.unit_id || a.station_id || a.order_id || '';
    const bId = b.unit_id || b.station_id || b.order_id || '';
    return aId.localeCompare(bId);
  });
}
