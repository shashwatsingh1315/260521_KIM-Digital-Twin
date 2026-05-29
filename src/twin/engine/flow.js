// flow.js — unit movement through passive segments and station buffers (§8.1.3).
//
// Models the physical network: units travel along segments at conveyor speed,
// land in station input buffers (or exit nodes), and respect capacity limits.

/**
 * Build initial flow state from config.
 * stationBuffers: Map<stationId, Unit[]>   — FIFO input queue at each station
 * segmentUnits:   Map<segId, {unit, arrival_time}[]>  — in-transit units
 * exitedUnits:    {unit, exitId, time}[]   — accumulated, consumed by aggregator
 */
export function makeFlowState(config) {
  const stationBuffers = new Map();
  const stationOutputBuffers = new Map();
  for (const station of config.stations) {
    stationBuffers.set(station.id, []);
    stationOutputBuffers.set(station.id, []);
  }
  const segmentUnits = new Map();
  for (const seg of config.segments) {
    segmentUnits.set(seg.id, []);
  }
  return { stationBuffers, stationOutputBuffers, segmentUnits, exitedUnits: [] };
}

/**
 * Place a unit onto a passive segment. Records its arrival time at the destination.
 * speed_m_per_min → travel_seconds = length_m / (speed/60)
 */
export function launchOnSegment(flowState, segment, unit, now) {
  const travelSeconds = (segment.length_m / segment.transport.speed_m_per_min) * 60;
  const arrivalTime = now + travelSeconds;
  flowState.segmentUnits.get(segment.id).push({ unit, arrival_time: arrivalTime });
  return arrivalTime;
}

/**
 * Earliest arrival time across all in-transit segments.
 */
export function nextArrivalTime(flowState) {
  let min = Infinity;
  for (const inTransit of flowState.segmentUnits.values()) {
    for (const { arrival_time } of inTransit) {
      if (arrival_time < min) min = arrival_time;
    }
  }
  return min;
}

/**
 * Process all segment arrivals at time t.
 * For each unit arriving at t:
 *   - If destination is a station node → push to that station's input buffer.
 *   - If destination is an exit → push to exitedUnits.
 * config is needed to resolve node → station and node → exit mappings.
 * Returns list of {unit, stationId} for units that just entered a station buffer.
 */
export function applyArrivals(flowState, config, t) {
  // Build lookup: node_id → station
  const nodeToStation = new Map();
  for (const station of config.stations) {
    nodeToStation.set(station.node_id, station);
  }
  // Build lookup: exit_id → exit
  const exitIds = new Set(config.exits.map((e) => e.id));

  const arrivals = [];

  for (const [segId, inTransit] of flowState.segmentUnits.entries()) {
    const seg = config.segments.find((s) => s.id === segId);
    const arriving = inTransit.filter((e) => e.arrival_time === t);
    const remaining = inTransit.filter((e) => e.arrival_time !== t);
    flowState.segmentUnits.set(segId, remaining);

    for (const { unit } of arriving) {
      const destId = seg.to_node_id;
      if (exitIds.has(destId)) {
        flowState.exitedUnits.push({ unit, exit_id: destId, time: t });
      } else {
        const station = nodeToStation.get(destId);
        if (station) {
          flowState.stationBuffers.get(station.id).push(unit);
          arrivals.push({ unit, stationId: station.id });
        }
      }
    }
  }

  return arrivals;
}

/**
 * Move units from stationOutputBuffers onto outbound segments.
 * Returns segment arrival times scheduled.
 */
export function drainOutputBuffers(flowState, config, now) {
  const nodeToOutbound = new Map();
  for (const seg of config.segments) {
    if (!nodeToOutbound.has(seg.from_node_id)) {
      nodeToOutbound.set(seg.from_node_id, []);
    }
    nodeToOutbound.get(seg.from_node_id).push(seg);
  }

  for (const station of config.stations) {
    const outBuf = flowState.stationOutputBuffers.get(station.id);
    if (!outBuf || outBuf.length === 0) continue;
    const outSegs = nodeToOutbound.get(station.node_id) || [];
    if (outSegs.length === 0) continue;

    while (outBuf.length > 0) {
      const unit = outBuf.shift();
      // Route by next_process: find the segment whose destination station does that process.
      const seg = chooseOutboundSegment(outSegs, unit, config);
      if (seg) {
        launchOnSegment(flowState, seg, unit, now);
      }
    }
  }
}

/**
 * Choose the outbound segment for a unit based on its next_process.
 * For linear lines there's one outbound segment; for multi-path, pick the one
 * whose destination station handles next_process (or first exit if no next_process).
 */
function chooseOutboundSegment(outSegs, unit, config) {
  if (!unit.next_process) {
    // Route to any exit segment.
    const exitIds = new Set(config.exits.map((e) => e.id));
    const exitSeg = outSegs.find((s) => exitIds.has(s.to_node_id));
    return exitSeg || outSegs[0];
  }

  const nodeToStation = new Map();
  for (const station of config.stations) {
    nodeToStation.set(station.node_id, station);
  }

  for (const seg of outSegs) {
    const destStation = nodeToStation.get(seg.to_node_id);
    if (destStation && destStation.processes.some((sp) => sp.process_id === unit.next_process)) {
      return seg;
    }
  }

  // Fallback: first segment (works for linear/DAG).
  return outSegs[0];
}
