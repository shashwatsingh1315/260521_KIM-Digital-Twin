// Engine core — deterministic event-driven simulation (§5, §8).
//
// runTwin(config, options) → { states, events, summary }
// Pure function: no I/O, no Date.now(), no Math.random() outside makeRng.

import { makeClock } from './clock.js';
import { sortEvents, unitCreated, stationStarted, stationCompleted, unitExited, scrapped } from './events.js';
import { makeSchedulerState, nextEventTime, dueCompletions, startSlot, freeSlot, freeSlotCount } from './taktScheduler.js';
import { makeFlowState, launchOnSegment, nextArrivalTime, applyArrivals, drainOutputBuffers, tryFlushHeld } from './flow.js';
import { applyProcess, checkAssemblyKit, assembleUnit } from './processApply.js';
import { tryAdmit, derivedWipCap } from './releaseGovernor.js';
import { procesExits, computeSummary } from './aggregator.js';
import { makeRng } from '../util/rng.js';
import {
  makeCarrierState, enqueueForCarrier, dispatchCarriers,
  processCarrierDrops, processCarrierReturns, tryFlushCarrierHeld,
  nextCarrierEventTime,
} from './carriers.js';

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
  const carrierState = makeCarrierState(config);

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

  // Helper: route a completed unit onto an outbound segment.
  // If the segment is full, the unit waits in the station's output buffer instead.
  function routeUnit(unit, stationId, now) {
    const station = stationMap.get(stationId);
    const segs = outboundSegments(station.node_id);
    const exitIds = new Set(config.exits.map((e) => e.id));

    if (segs.length === 0) return;

    let targetSeg = null;

    if (!unit.next_process) {
      targetSeg = segs.find((s) => {
        const exit = config.exits.find((e) => e.id === s.to_node_id);
        return exit && exit.kind === 'ship';
      });
    } else {
      for (const seg of segs) {
        if (exitIds.has(seg.to_node_id)) continue;
        const dest = nodeToStation.get(seg.to_node_id);
        if (dest && dest.processes.some((sp) => sp.process_id === unit.next_process)) {
          targetSeg = seg;
          break;
        }
      }
      if (!targetSeg) targetSeg = segs[0];
    }

    if (targetSeg) {
      if (targetSeg.transport.class === 'carrier') {
        // Carrier segment — enqueue unit for carrier pickup (always succeeds).
        enqueueForCarrier(carrierState, targetSeg, unit);
      } else {
        const arr = launchOnSegment(flowState, targetSeg, unit, now);
        if (arr === null) {
          // Outbound segment full — wait in the station output buffer.
          flowState.stationOutputBuffers.get(stationId)?.push(unit);
        }
      }
    }
  }

  // Drain output-buffer units destined for carrier segments into carrier pickup queues.
  function drainCarrierOutputBuffers(stationMap, flowState, carrierState, config) {
    for (const station of config.stations) {
      const outBuf = flowState.stationOutputBuffers.get(station.id);
      if (!outBuf || outBuf.length === 0) continue;
      const segs = outboundSegments(station.node_id);
      const remaining = [];
      for (const unit of outBuf) {
        const seg = segs.find((s) => s.transport.class === 'carrier' &&
          (() => {
            const dest = nodeToStation.get(s.to_node_id);
            return dest && dest.processes.some((sp) => sp.process_id === unit.next_process);
          })());
        if (seg) {
          enqueueForCarrier(carrierState, seg, unit);
        } else {
          remaining.push(unit);
        }
      }
      flowState.stationOutputBuffers.set(station.id, remaining);
    }
  }

  // Admit the next batch of units from pending orders.
  // Stops if the intake segment is full (no space to launch).
  function admitUnits(now) {
    let admitted;
    do {
      admitted = tryAdmit(govState, config, orders, now);
      if (admitted) {
        const firstProcess = admitted.next_process;
        const seg = intakeSegments.find((s) => {
          const dest = nodeToStation.get(s.to_node_id);
          return dest && dest.processes.some((sp) => sp.process_id === firstProcess);
        }) || intakeSegments[0];
        if (seg) {
          const arr = launchOnSegment(flowState, seg, admitted, now);
          if (arr === null) {
            // Intake segment full — undo this admission and stop.
            govState.wipCount--;
            const ord = orders.find((o) => o.id === admitted.order_id);
            if (ord) {
              ord.units_created--;
              if (ord.units_created === 0) ord.status = 'pending';
            }
            admitted = null;
            break;
          }
        }
        allEvents.push(unitCreated(now, admitted.id, admitted.order_id, admitted.material));
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
    const tCarrier = nextCarrierEventTime(carrierState);
    const t = Math.min(tSched, tFlow, tCarrier);

    if (t === Infinity) break; // stall / deadlock

    clock.setTime(t);

    // 1. Apply segment arrivals and carrier returns/drops at t.
    applyArrivals(flowState, config, t);
    processCarrierReturns(carrierState, t);
    const carrierDeliveries = processCarrierDrops(carrierState, flowState, config, t);
    dispatchCarriers(carrierState, config, t);

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

    // 6. Drain held arrivals and carrier-held deliveries into freed buffers; drain output buffers.
    tryFlushHeld(flowState, config);
    tryFlushCarrierHeld(carrierState, flowState, config, t);
    drainOutputBuffers(flowState, config, t);
    // Drain output-buffer units queued for carrier pickup.
    drainCarrierOutputBuffers(stationMap, flowState, carrierState, config);
    dispatchCarriers(carrierState, config, t);

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
