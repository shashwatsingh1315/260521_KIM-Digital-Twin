// flow.js — unit movement through passive segments and station buffers (§8.1.3).
//
// Models the physical network: units travel along segments at conveyor speed,
// land in station input buffers (or exit nodes), and respect capacity limits.
//
// Back-pressure rules:
//   - Segment occupancy (in-transit + held) ≤ segment.capacity.
//   - Station input buffer ≤ station.entry_buffer_capacity.
//   - If input buffer is full on arrival, unit waits on the segment (segmentHeld).
//   - If outbound segment is full on dispatch, unit waits in stationOutputBuffers.

/**
 * Build initial flow state from config.
 * stationBuffers:       Map<stationId, Unit[]>   — FIFO input queue
 * stationOutputBuffers: Map<stationId, Unit[]>   — completed units waiting for segment room
 * segmentUnits:         Map<segId, {unit, arrival_time}[]> — in-transit units
 * segmentHeld:          Map<segId, {unit}[]>     — arrived but destination buffer full
 * exitedUnits:          {unit, exit_id, time}[]  — consumed by aggregator
 */
export function makeFlowState(config) {
  const stationBuffers = new Map();
  const stationOutputBuffers = new Map();
  for (const station of config.stations) {
    stationBuffers.set(station.id, []);
    stationOutputBuffers.set(station.id, []);
  }
  const segmentUnits = new Map();
  const segmentHeld = new Map();
  for (const seg of config.segments) {
    segmentUnits.set(seg.id, []);
    segmentHeld.set(seg.id, []);
  }
  return { stationBuffers, stationOutputBuffers, segmentUnits, segmentHeld, exitedUnits: [] };
}

// Total units occupying a segment (in-transit + held at destination).
function segmentOccupancy(flowState, segId) {
  return (flowState.segmentUnits.get(segId)?.length ?? 0) +
         (flowState.segmentHeld.get(segId)?.length ?? 0);
}

/**
 * Place a unit onto a passive segment.
 * Returns arrival_time if there is room, null if the segment is at capacity.
 */
export function launchOnSegment(flowState, segment, unit, now) {
  if (segmentOccupancy(flowState, segment.id) >= segment.capacity) return null;
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

// Build per-call lookup tables for arrival routing.
function makeFlowCtx(config) {
  const nodeToStation = new Map(config.stations.map((s) => [s.node_id, s]));
  const exitIds = new Set(config.exits.map((e) => e.id));
  const segMap = new Map(config.segments.map((s) => [s.id, s]));
  const outByNode = new Map();
  for (const seg of config.segments) {
    if (!outByNode.has(seg.from_node_id)) outByNode.set(seg.from_node_id, []);
    outByNode.get(seg.from_node_id).push(seg);
  }
  return { nodeToStation, exitIds, segMap, outByNode };
}

/**
 * Deliver a unit that has reached `destId` (the to_node of the segment it was on).
 *   - exit node      → record as exited.
 *   - station input  → push to input buffer if there is room.
 *   - relay node      (junction/buffer: neither station nor exit) → forward onto an
 *                     outbound passive segment toward the unit's next process.
 *   - dead node       (no outbound) → consumed (nothing to do).
 * Returns true if handled; false if the unit must wait (held on its inbound
 * segment) because the destination buffer or the relay's outbound segment is full.
 */
function deliverArrival(flowState, config, ctx, destId, unit, now, arrivals) {
  if (ctx.exitIds.has(destId)) {
    flowState.exitedUnits.push({ unit, exit_id: destId, time: now });
    return true;
  }

  const station = ctx.nodeToStation.get(destId);
  if (station) {
    const buf = flowState.stationBuffers.get(station.id);
    if (buf.length < station.entry_buffer_capacity) {
      buf.push(unit);
      arrivals.push({ unit, stationId: station.id });
      return true;
    }
    return false; // input buffer full — hold on inbound segment
  }

  // Relay node: forward onto an outbound segment (a junction/buffer has no buffer
  // of its own; it just passes units through to the next hop).
  const outSegs = ctx.outByNode.get(destId) || [];
  if (outSegs.length === 0) return true; // dead-end node with no outbound: consume
  const outSeg = chooseOutboundSegment(outSegs, unit, config);
  if (outSeg.transport.class !== 'passive') {
    // Carrier hops are enqueued by the engine, not launched here. Hold rather
    // than silently drop so the unit is not lost at the relay.
    return false;
  }
  const arr = launchOnSegment(flowState, outSeg, unit, now);
  return arr !== null; // outbound segment full → hold on inbound segment
}

/**
 * Process all segment arrivals at time t.
 * If the destination input buffer (or a relay's outbound segment) is full, the
 * unit is placed in segmentHeld (still counts toward segment occupancy —
 * blocking upstream launches).
 * Returns list of {unit, stationId} for units that entered a station buffer.
 */
export function applyArrivals(flowState, config, t) {
  const ctx = makeFlowCtx(config);
  const arrivals = [];

  for (const [segId, inTransit] of flowState.segmentUnits.entries()) {
    const arriving = inTransit.filter((e) => e.arrival_time === t);
    if (arriving.length === 0) continue;
    flowState.segmentUnits.set(segId, inTransit.filter((e) => e.arrival_time !== t));

    const seg = ctx.segMap.get(segId);
    for (const { unit } of arriving) {
      const delivered = deliverArrival(flowState, config, ctx, seg.to_node_id, unit, t, arrivals);
      if (!delivered) flowState.segmentHeld.get(segId).push({ unit });
    }
  }

  return arrivals;
}

/**
 * Try to move held arrivals into their destination (station buffer or, for a
 * relay node, its outbound segment). Called after startEligible frees buffer
 * slots and after segments drain.
 * Returns list of {unit, stationId} that successfully entered a station buffer.
 */
export function tryFlushHeld(flowState, config, now = 0) {
  const ctx = makeFlowCtx(config);
  const arrivals = [];

  for (const [segId, held] of flowState.segmentHeld.entries()) {
    if (held.length === 0) continue;
    const seg = ctx.segMap.get(segId);
    if (!seg) continue;

    const remaining = [];
    for (const entry of held) {
      const delivered = deliverArrival(flowState, config, ctx, seg.to_node_id, entry.unit, now, arrivals);
      if (!delivered) remaining.push(entry);
    }
    flowState.segmentHeld.set(segId, remaining);
  }

  return arrivals;
}

/**
 * Try to move units from stationOutputBuffers onto outbound segments.
 * Respects segment capacity — units that cannot launch stay in the output buffer.
 * Called each tick; on the next tick it retries if the segment freed up.
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

    const remaining = [];
    for (const unit of outBuf) {
      const seg = chooseOutboundSegment(outSegs, unit, config);
      if (!seg) {
        remaining.push(unit);
        continue;
      }
      if (seg.transport.class !== 'passive') {
        // Carrier segment — engine handles carrier enqueuing separately.
        remaining.push(unit);
        continue;
      }
      const arr = launchOnSegment(flowState, seg, unit, now);
      if (arr === null) {
        remaining.push(unit); // Segment still full
      }
    }
    flowState.stationOutputBuffers.set(station.id, remaining);
  }
}

/**
 * Choose the outbound segment for a unit based on its next_process.
 */
function chooseOutboundSegment(outSegs, unit, config) {
  if (!unit.next_process) {
    const exitIds = new Set(config.exits.map((e) => e.id));
    return outSegs.find((s) => exitIds.has(s.to_node_id)) || outSegs[0];
  }

  const nodeToStation = new Map(config.stations.map((s) => [s.node_id, s]));
  for (const seg of outSegs) {
    const destStation = nodeToStation.get(seg.to_node_id);
    if (destStation && destStation.processes.some((sp) => sp.process_id === unit.next_process)) {
      return seg;
    }
  }
  return outSegs[0];
}
