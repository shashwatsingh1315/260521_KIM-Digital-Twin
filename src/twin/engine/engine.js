// Engine core — deterministic event-driven simulation (§5, §8).
//
// Public API:
//   initState(config, opts) → { state, events }   — create initial state + t=0 events
//   step(state)             → { state, events, done } — advance one tick
//   runTwin(config, opts)   → { states, events, summary } — thin batch loop over step

import { makeClock } from './clock.js';
import { sortEvents, unitCreated, stationStarted, stationCompleted, unitExited, scrapped } from './events.js';
import { makeSchedulerState, nextEventTime, dueCompletions, startSlot, freeSlot, freeSlotCount } from './taktScheduler.js';
import { makeFlowState, launchOnSegment, nextArrivalTime, applyArrivals, drainOutputBuffers, tryFlushHeld } from './flow.js';
import { applyProcess, checkAssemblyKit, assembleUnit } from './processApply.js';
import { tryAdmit, derivedWipCap } from './releaseGovernor.js';
import { procesExits, computeSummary } from './aggregator.js';
import { makeRng } from '../util/rng.js';
import { detectDeadlock } from './deadlock.js';
import {
  makeCarrierState, enqueueForCarrier, dispatchCarriers,
  processCarrierDrops, processCarrierReturns, tryFlushCarrierHeld,
  nextCarrierEventTime,
} from './carriers.js';

// ---- Helpers that operate on an explicit engine state ----

function startEligible(state, events, now) {
  const { config, orders, govState, schedState, flowState, processMap } = state;
  for (const station of config.stations) {
    const buf = flowState.stationBuffers.get(station.id);
    if (!buf || buf.length === 0) continue;

    for (const stProc of station.processes) {
      if (freeSlotCount(schedState, station.id, stProc.process_id) === 0) continue;

      const proc = processMap.get(stProc.process_id);

      if (proc && proc.kind === 'assembly') {
        const { complete, kitUnits } = checkAssemblyKit(buf, proc.bom);
        if (!complete) continue;
        const kitIds = new Set(kitUnits.map((u) => u.id));
        flowState.stationBuffers.set(station.id, buf.filter((u) => !kitIds.has(u.id)));
        govState.wipCount -= kitUnits.length;
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
        const sentinelUnit = { id: `kit@${now}`, material: proc.output_material, order_id: null, next_process: stProc.process_id, _kit: kitUnits };
        const slot = startSlot(schedState, station.id, stProc.process_id, sentinelUnit.id, now, stProc.takt_seconds);
        if (!slot) continue;
        slot._unit = sentinelUnit;
        events.push(stationStarted(now, station.id, stProc.process_id, `kit@${now}`));
        continue;
      }

      const idx = buf.findIndex((u) => u.next_process === stProc.process_id);
      if (idx === -1) continue;

      const [unit] = buf.splice(idx, 1);
      const slot = startSlot(schedState, station.id, stProc.process_id, unit.id, now, stProc.takt_seconds);
      slot._unit = unit;
      events.push(stationStarted(now, station.id, stProc.process_id, unit.id));
    }
  }
}

function outboundSegments(state, stationNodeId) {
  return state.config.segments.filter((s) => s.from_node_id === stationNodeId);
}

function advanceNextProcess(state, unit, orderId) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return null;
  const idx = order.process_sequence.indexOf(unit.next_process);
  if (idx === -1 || idx === order.process_sequence.length - 1) return null;
  return order.process_sequence[idx + 1];
}

function routeUnit(state, unit, stationId, now) {
  const { config, flowState, carrierState, stationMap, nodeToStation, exitIds } = state;
  const station = stationMap.get(stationId);
  const segs = outboundSegments(state, station.node_id);

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
      enqueueForCarrier(carrierState, targetSeg, unit);
    } else {
      const arr = launchOnSegment(flowState, targetSeg, unit, now);
      if (arr === null) {
        flowState.stationOutputBuffers.get(stationId)?.push(unit);
      }
    }
  }
}

function drainCarrierOutputBuffers(state) {
  const { config, flowState, carrierState, nodeToStation } = state;
  for (const station of config.stations) {
    const outBuf = flowState.stationOutputBuffers.get(station.id);
    if (!outBuf || outBuf.length === 0) continue;
    const segs = outboundSegments(state, station.node_id);
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

function admitUnits(state, events, now) {
  const { config, orders, govState, flowState, intakeSegments, nodeToStation } = state;
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
      events.push(unitCreated(now, admitted.id, admitted.order_id, admitted.material));
    }
  } while (admitted);
}

// ---- Public API ----

/**
 * Create initial engine state from a FactoryConfig.
 * Runs the t=0 bootstrap (admit + start eligible).
 * @returns {{ state, events }}
 */
export function initState(config, opts = {}) {
  const { seed = 0 } = opts;
  const rng = makeRng(seed);
  const clock = makeClock(0);

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
  flowState._config = config;
  const carrierState = makeCarrierState(config);

  const stationMap = new Map(config.stations.map((s) => [s.id, s]));
  const processMap = new Map(config.processes.map((p) => [p.id, p]));
  const nodeToStation = new Map(config.stations.map((s) => [s.node_id, s]));
  const intakeNodes = new Set(config.nodes.filter((n) => n.type === 'intake').map((n) => n.id));
  const intakeSegments = config.segments.filter((s) => intakeNodes.has(s.from_node_id));
  const exitIds = new Set(config.exits.map((e) => e.id));

  const state = {
    config, rng, clock, orders, govState, schedState, flowState, carrierState,
    stationMap, processMap, nodeToStation, intakeSegments, exitIds,
  };

  const events = [];
  admitUnits(state, events, 0);
  startEligible(state, events, 0);

  return { state, events };
}

/**
 * Advance one simulation tick (to the next event time).
 * Mutates state in place and returns the same reference plus emitted events.
 * @returns {{ state, events, done: boolean }}
 */
/**
 * Peek the time of the next pending event without mutating state.
 * Returns Infinity when no events remain (idle / deadlocked / complete).
 * Used by real-time pacing (the UI) to advance the clock smoothly between
 * events instead of teleporting to each event time.
 * @returns {number} seconds, or Infinity
 */
export function peekNextEventTime(state) {
  const { orders, schedState, flowState, carrierState } = state;
  const hasActiveOrders = orders.some(
    (o) => o.status === 'pending' || o.status === 'in_progress',
  );
  if (!hasActiveOrders) return Infinity;
  return Math.min(
    nextEventTime(schedState),
    nextArrivalTime(flowState),
    nextCarrierEventTime(carrierState),
  );
}

export function step(state) {
  const { config, rng, clock, orders, govState, schedState, flowState, carrierState,
          stationMap, processMap } = state;
  const events = [];

  const hasActiveOrders = orders.some(
    (o) => o.status === 'pending' || o.status === 'in_progress',
  );
  if (!hasActiveOrders) return { state, events, done: true };

  const tSched = nextEventTime(schedState);
  const tFlow = nextArrivalTime(flowState);
  const tCarrier = nextCarrierEventTime(carrierState);
  const t = Math.min(tSched, tFlow, tCarrier);

  if (t === Infinity) {
    const shocks = detectDeadlock(flowState, carrierState, config, orders, clock.now());
    for (const ev of shocks) events.push(ev);
    return { state, events, done: true };
  }

  clock.setTime(t);

  // 1. Arrivals and carrier events.
  applyArrivals(flowState, config, t);
  processCarrierReturns(carrierState, t);
  processCarrierDrops(carrierState, flowState, config, t);
  dispatchCarriers(carrierState, config, t);

  // 2. Scheduler completions.
  const completions = dueCompletions(schedState, t);
  for (const slot of completions) {
    const unit = slot._unit;
    freeSlot(slot);
    events.push(stationCompleted(t, slot.station_id, slot.process_id, unit.id));

    const proc = processMap.get(slot.process_id);

    if (proc.kind === 'assembly') {
      const kitUnits = unit._kit || [];
      const productOrder = orders.find(
        (o) => o.process_sequence.includes(slot.process_id) &&
               o.status !== 'completed' && o.status !== 'short' &&
               o.units_created < o.quantity,
      );
      if (productOrder) {
        const newUnit = assembleUnit({ process: proc, kitUnits, productOrder, now: t });
        productOrder.units_created++;
        if (productOrder.status === 'pending') productOrder.status = 'in_progress';
        govState.wipCount++;
        newUnit.next_process = (() => {
          const idx = productOrder.process_sequence.indexOf(slot.process_id);
          return idx < productOrder.process_sequence.length - 1
            ? productOrder.process_sequence[idx + 1]
            : null;
        })();
        events.push(unitCreated(t, newUnit.id, newUnit.order_id, newUnit.material));
        routeUnit(state, newUnit, slot.station_id, t);
      }
      continue;
    }

    const result = applyProcess({ unit, process: proc, order: orders.find((o) => o.id === unit.order_id), allOrders: orders, rng });

    if (result.scrap) {
      events.push(scrapped(t, unit.id));
      const scrapSeg = config.segments.find((s) => {
        const exit = config.exits.find((e) => e.id === s.to_node_id);
        return exit && exit.kind === 'scrap' && s.from_node_id === stationMap.get(slot.station_id).node_id;
      });
      if (scrapSeg) {
        launchOnSegment(flowState, scrapSeg, unit, t);
      } else {
        const scrapExit = config.exits.find((e) => e.kind === 'scrap');
        if (scrapExit) {
          flowState.exitedUnits.push({ unit, exit_id: scrapExit.id, time: t });
        }
      }
    } else if (result.keep) {
      const kept = result.keep;
      kept.next_process = advanceNextProcess(state, kept, kept.order_id);
      routeUnit(state, kept, slot.station_id, t);
    }
  }

  // 3. Exits.
  const exitEvents = procesExits(flowState, orders, govState);
  for (const ev of exitEvents) {
    if (ev.type === 'unit_exited') {
      events.push(unitExited(ev.timestamp, ev.unit_id, ev.exit_id, ''));
    } else {
      events.push(scrapped(ev.timestamp, ev.unit_id));
    }
  }

  // 4. Admit new units.
  admitUnits(state, events, t);

  // 5. Start eligible.
  startEligible(state, events, t);

  // 6. Flush held / output buffers.
  tryFlushHeld(flowState, config);
  tryFlushCarrierHeld(carrierState, flowState, config, t);
  drainOutputBuffers(flowState, config, t);
  drainCarrierOutputBuffers(state);
  dispatchCarriers(carrierState, config, t);

  return { state, events, done: false };
}

/**
 * Run a complete simulation to completion (or maxTime).
 * Thin loop over initState + step.
 * @param {object} config  FactoryConfig
 * @param {object} [opts]  { seed?: number, maxTime?: number }
 * @returns {{ states, events, summary }}
 */
export function runTwin(config, opts = {}) {
  const { maxTime = Infinity } = opts;

  let { state, events: initEvents } = initState(config, opts);
  const allEvents = [...initEvents];
  const states = [];

  let iterations = 0;
  const MAX_ITER = 100000;

  while (iterations++ < MAX_ITER) {
    if (state.clock.now() >= maxTime) break;
    const result = step(state);
    state = result.state;
    for (const ev of result.events) allEvents.push(ev);
    if (!result.done) states.push({ time: state.clock.now() });
    if (result.done) break;
  }

  // Finalize order statuses.
  for (const order of state.orders) {
    if (order.status === 'in_progress') {
      if (order.units_completed >= order.quantity) order.status = 'completed';
      else order.status = 'short';
    }
  }

  return Object.freeze({
    states,
    events: sortEvents(allEvents),
    summary: computeSummary(config, state.orders, state.clock.now()),
    orders: state.orders,
  });
}
