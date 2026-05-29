// Engine core — deterministic event-driven simulation (§5, §8).
//
// runTwin(config, options) → { states, events, summary }
// Pure function: no I/O, no Date.now(), no Math.random() outside makeRng.

import { makeClock } from './clock.js';
import { sortEvents, unitCreated, stationStarted, stationCompleted, unitExited, scrapped } from './events.js';
import { makeSchedulerState, nextEventTime, dueCompletions, startSlot, freeSlot, freeSlotCount } from './taktScheduler.js';
import { makeFlowState, launchOnSegment, nextArrivalTime, applyArrivals, drainOutputBuffers } from './flow.js';
import { applyProcess, checkAssemblyKit, assembleUnit } from './processApply.js';
import { tryAdmit, derivedWipCap } from './releaseGovernor.js';
import { procesExits, computeSummary } from './aggregator.js';
import { makeRng } from '../util/rng.js';

/**
 * Run a complete simulation to completion (or maxTime).
 * @param {object} config  FactoryConfig
 * @param {object} [opts]  { seed?: number, maxTime?: number }
 * @returns {{ states, events, summary }}
 */
export function runTwin(config, opts = {}) {
  const { seed = 0, maxTime = Infinity } = opts;
  const rng = makeRng(seed);
  const clock = makeClock(0);

  // Mutable runtime copies of orders.
  const orders = config.orders.map((o) => ({
    ...o,
    units_created: 0,
    units_completed: 0,
    scrap: 0,
    status: 'pending',
  }));

  const govState = { wipCount: 0 };
  const schedState = makeSchedulerState(config);
  const flowState = makeFlowState(config);
  flowState._config = config; // aggregator needs it for exit-kind lookup

  // Build lookup tables used in the inner loop.
  const stationMap = new Map(config.stations.map((s) => [s.id, s]));
  const processMap = new Map(config.processes.map((p) => [p.id, p]));
  const nodeToStation = new Map(config.stations.map((s) => [s.node_id, s]));
  const intakeNodes = new Set(config.nodes.filter((n) => n.type === 'intake').map((n) => n.id));

  // Find intake segment: from intake node to the first station.
  const intakeSegments = config.segments.filter((s) => intakeNodes.has(s.from_node_id));

  const allEvents = [];
  const states = [];

  // Helper: try to start eligible units from input buffers into free scheduler slots.
  function startEligible(now) {
    for (const station of config.stations) {
      const buf = flowState.stationBuffers.get(station.id);
      if (!buf || buf.length === 0) continue;

      for (const stProc of station.processes) {
        if (freeSlotCount(schedState, station.id, stProc.process_id) === 0) continue;

        const proc = processMap.get(stProc.process_id);

        if (proc && proc.kind === 'assembly') {
          // Assembly: start only when a full kit is in the buffer.
          const { complete, kitUnits } = checkAssemblyKit(buf, proc.bom);
          if (!complete) continue;
          // Consume the kit from the buffer immediately on start.
          const kitIds = new Set(kitUnits.map((u) => u.id));
          flowState.stationBuffers.set(station.id, buf.filter((u) => !kitIds.has(u.id)));
          // Decrement wipCount for consumed component units.
          govState.wipCount -= kitUnits.length;
          // Mark component orders' units as "consumed" (fulfilled by assembly).
          for (const ku of kitUnits) {
            const compOrder = orders.find((o) => o.id === ku.order_id);
            if (compOrder) {
              compOrder.units_completed++;
              if (compOrder.units_completed >= compOrder.units_created &&
                  compOrder.units_created >= compOrder.quantity) {
                compOrder.status = 'completed';
              }
            }
          }
          // Start slot with a sentinel unit (kit metadata).
          const sentinelUnit = { id: `kit@${now}`, material: proc.output_material, order_id: null, next_process: stProc.process_id, _kit: kitUnits };
          const slot = startSlot(schedState, station.id, stProc.process_id, sentinelUnit.id, now, stProc.takt_seconds);
          if (!slot) continue;
          slot._unit = sentinelUnit;
          allEvents.push(stationStarted(now, station.id, stProc.process_id, `kit@${now}`));
          continue;
        }

        // Normal unit: find the first buffered unit that needs this process.
        const idx = buf.findIndex((u) => u.next_process === stProc.process_id);
        if (idx === -1) continue;

        const [unit] = buf.splice(idx, 1);
        const slot = startSlot(schedState, station.id, stProc.process_id, unit.id, now, stProc.takt_seconds);
        slot._unit = unit; // store unit on slot for retrieval at completion
        allEvents.push(stationStarted(now, station.id, stProc.process_id, unit.id));
      }
    }
  }

  // Helper: get the segment leading from a station node to the next destination.
  function outboundSegments(stationNodeId) {
    return config.segments.filter((s) => s.from_node_id === stationNodeId);
  }

  // Helper: advance a unit's next_process pointer.
  function advanceNextProcess(unit, orderId) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return null;
    const idx = order.process_sequence.indexOf(unit.next_process);
    if (idx === -1 || idx === order.process_sequence.length - 1) return null;
    return order.process_sequence[idx + 1];
  }

  // Helper: route a completed unit onto an outbound segment or output buffer.
  function routeUnit(unit, stationId, now) {
    const station = stationMap.get(stationId);
    const segs = outboundSegments(station.node_id);
    const exitIds = new Set(config.exits.map((e) => e.id));

    if (segs.length === 0) return;

    if (!unit.next_process) {
      // Route to ship exit segment.
      const shipSeg = segs.find((s) => {
        const exit = config.exits.find((e) => e.id === s.to_node_id);
        return exit && exit.kind === 'ship';
      });
      if (shipSeg) launchOnSegment(flowState, shipSeg, unit, now);
      return;
    }

    // Route based on next_process: find a station that does it.
    for (const seg of segs) {
      if (exitIds.has(seg.to_node_id)) continue;
      const dest = nodeToStation.get(seg.to_node_id);
      if (dest && dest.processes.some((sp) => sp.process_id === unit.next_process)) {
        launchOnSegment(flowState, seg, unit, now);
        return;
      }
    }

    // Fallback for single-path DAGs.
    launchOnSegment(flowState, segs[0], unit, now);
  }

  // Admit the first batch of units before the loop.
  function admitUnits(now) {
    let admitted;
    do {
      admitted = tryAdmit(govState, config, orders, now);
      if (admitted) {
        allEvents.push(unitCreated(now, admitted.id, admitted.order_id, admitted.material));
        // Place unit on the intake segment leading to its first station.
        const firstProcess = admitted.next_process;
        const seg = intakeSegments.find((s) => {
          const dest = nodeToStation.get(s.to_node_id);
          return dest && dest.processes.some((sp) => sp.process_id === firstProcess);
        }) || intakeSegments[0];
        if (seg) launchOnSegment(flowState, seg, admitted, now);
      }
    } while (admitted);
  }

  // Main loop.
  admitUnits(0);
  startEligible(0);

  let iterations = 0;
  const MAX_ITER = 100000;

  while (iterations++ < MAX_ITER) {
    const hasActiveOrders = orders.some(
      (o) => o.status === 'pending' || o.status === 'in_progress',
    );
    if (!hasActiveOrders) break;
    if (clock.now() >= maxTime) break;

    const tSched = nextEventTime(schedState);
    const tFlow = nextArrivalTime(flowState);
    const t = Math.min(tSched, tFlow);

    if (t === Infinity) break; // stall / deadlock

    clock.setTime(t);

    // 1. Apply segment arrivals.
    applyArrivals(flowState, config, t);

    // 2. Process scheduler completions at t.
    const completions = dueCompletions(schedState, t);
    for (const slot of completions) {
      const unit = slot._unit;
      freeSlot(slot);
      allEvents.push(stationCompleted(t, slot.station_id, slot.process_id, unit.id));

      const proc = processMap.get(slot.process_id);

      if (proc.kind === 'assembly') {
        // Kit was consumed at start; _unit holds the sentinel with _kit.
        const kitUnits = unit._kit || [];
        // Find the product order (FIFO: first pending/in_progress whose sequence includes this assembly).
        const productOrder = orders.find(
          (o) => o.process_sequence.includes(slot.process_id) &&
                 o.status !== 'completed' && o.status !== 'short' &&
                 o.units_created < o.quantity,
        );
        if (productOrder) {
          const newUnit = assembleUnit({ process: proc, kitUnits, productOrder, now: t });
          productOrder.units_created++;
          if (productOrder.status === 'pending') productOrder.status = 'in_progress';
          govState.wipCount++; // new product unit enters WIP
          newUnit.next_process = (() => {
            const idx = productOrder.process_sequence.indexOf(slot.process_id);
            return idx < productOrder.process_sequence.length - 1
              ? productOrder.process_sequence[idx + 1]
              : null;
          })();
          allEvents.push(unitCreated(t, newUnit.id, newUnit.order_id, newUnit.material));
          routeUnit(newUnit, slot.station_id, t);
        }
        continue;
      }

      const result = applyProcess({ unit, process: proc, order: orders.find((o) => o.id === unit.order_id), allOrders: orders, rng });

      if (result.scrap) {
        allEvents.push(scrapped(t, unit.id));
        const scrapSeg = config.segments.find((s) => {
          const exit = config.exits.find((e) => e.id === s.to_node_id);
          return exit && exit.kind === 'scrap' && s.from_node_id === stationMap.get(slot.station_id).node_id;
        });
        if (scrapSeg) {
          launchOnSegment(flowState, scrapSeg, unit, t);
        } else {
          // Direct scrap: treat as immediate exit.
          const scrapExit = config.exits.find((e) => e.kind === 'scrap');
          if (scrapExit) {
            flowState.exitedUnits.push({ unit, exit_id: scrapExit.id, time: t });
          }
        }
      } else if (result.keep) {
        const kept = result.keep;
        kept.next_process = advanceNextProcess(kept, kept.order_id);
        routeUnit(kept, slot.station_id, t);
      }
    }

    // 3. Process exits via aggregator.
    const exitEvents = procesExits(flowState, orders, govState);
    for (const ev of exitEvents) {
      if (ev.type === 'unit_exited') {
        allEvents.push(unitExited(ev.timestamp, ev.unit_id, ev.exit_id, ''));
      } else {
        allEvents.push(scrapped(ev.timestamp, ev.unit_id));
      }
    }

    // 4. Admit new units.
    admitUnits(t);

    // 5. Start eligible units from buffers.
    startEligible(t);

    states.push({ time: t });
  }

  // Finalize order statuses.
  for (const order of orders) {
    if (order.status === 'in_progress') {
      if (order.units_completed >= order.quantity) order.status = 'completed';
      else order.status = 'short';
    }
  }

  return Object.freeze({
    states,
    events: sortEvents(allEvents),
    summary: computeSummary(config, orders, clock.now()),
    orders,
  });
}
