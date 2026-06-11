import { useRef, useState, useCallback, useEffect } from 'react';
import { initState, step, peekNextEventTime } from '../engine/engine.js';
import { liveMetrics } from '../engine/aggregator.js';
import { restore, snapshot } from '../engine/mode/snapshot.js';
import { validateFactoryConfig } from '../engine/validator.js';

/**
 * useTwin — hook driving initState/step directly (not makeTwin).
 * Provides full rewind support via restore(), pause-and-apply config edits,
 * speed control, and per-frame metrics computation.
 *
 * @param {object} config     FactoryConfig
 * @param {object} [opts]     { seed?: number }
 * @returns {object}          { advanceFrame, pause, resume, setSpeed, applyConfig,
 *                              rewind, simTime, metrics, shocks, paused, done,
 *                              _engineState }
 */
export function useTwin(config, opts = {}) {
  const engineStateRef = useRef(null);        // mutable engine state
  const speedRef = useRef(1);
  const pausedRef = useRef(false);

  const [simTime, setSimTime] = useState(0);
  const [metrics, setMetrics] = useState(null);
  const [shocks, setShocks] = useState([]);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);

  // Live event feed: ring buffer of notable engine events (unit exits, scrap,
  // shocks, order completions). Kept in a ref so the per-frame appends are
  // cheap; eventsVersion bumps so consumers re-render.
  const EVENT_FEED_CAP = 100;
  const feedRef = useRef([]);
  const prevOrderStatusRef = useRef(new Map());
  const [eventsVersion, setEventsVersion] = useState(0);

  const pushFeed = (items) => {
    if (!items.length) return false;
    const next = feedRef.current.concat(items);
    feedRef.current = next.length > EVENT_FEED_CAP ? next.slice(next.length - EVENT_FEED_CAP) : next;
    return true;
  };

  // Initialize (or re-initialize on config identity change).
  useEffect(() => {
    const { state, events: e0 } = initState(config, opts);
    engineStateRef.current = state;
    setSimTime(state.clock.now());
    setDone(false);
    setShocks([]);
    feedRef.current = [];
    prevOrderStatusRef.current = new Map();
    setEventsVersion((v) => v + 1);

    // Collect t=0 shocks from init events.
    const s0 = e0.filter((e) => e.type === 'shock_raised');
    if (s0.length) setShocks(s0);
  }, [config, JSON.stringify(opts)]);

  // Called each RAF frame by TwinProvider.
  const advanceFrame = useCallback((wallDeltaSeconds) => {
    if (pausedRef.current || !engineStateRef.current) return;

    const state = engineStateRef.current;
    const targetSim = state.clock.now() + wallDeltaSeconds * speedRef.current;
    const MAX_STEPS_PER_FRAME = 500;
    let steps = 0;
    const newShocks = [];
    // Feed accumulators for this frame. unit_exited bursts coalesce into one
    // "+N completed" item (at 100× hundreds can land in a single frame).
    let exitedCount = 0;
    let exitedLast = null;
    const frameFeed = [];

    // Pace the event-driven engine against the wall-clock budget: process every
    // event whose time is within [now, targetSim], then advance the clock
    // smoothly to targetSim (units interpolate between events on screen). This
    // prevents the sim from teleporting to completion in a single frame.
    while (steps++ < MAX_STEPS_PER_FRAME) {
      const tNext = peekNextEventTime(state);

      // No events remain (complete or deadlocked): let step() emit the
      // terminal done/shock signal once, then stop.
      if (tNext === Infinity) {
        const result = step(state);
        for (const ev of result.events) {
          if (ev.type === 'shock_raised') { newShocks.push(ev); frameFeed.push(ev); }
          else if (ev.type === 'unit_exited') { exitedCount++; exitedLast = ev; }
          else if (ev.type === 'scrapped') frameFeed.push(ev);
        }
        setDone(true);
        break;
      }

      // Next event is beyond this frame's budget — glide the clock to
      // targetSim (units interpolate on screen) and wait for the next frame.
      if (tNext > targetSim) {
        if (state.clock.now() < targetSim) state.clock.setTime(targetSim);
        break;
      }

      const result = step(state);
      // step() mutates state in place and returns same ref.
      for (const ev of result.events) {
        if (ev.type === 'shock_raised') { newShocks.push(ev); frameFeed.push(ev); }
        else if (ev.type === 'unit_exited') { exitedCount++; exitedLast = ev; }
        else if (ev.type === 'scrapped') frameFeed.push(ev);
      }
      if (result.done) {
        setDone(true);
        break;
      }
    }

    // Compute metrics once per frame from the now-current state.
    const m = liveMetrics(config, state.flowState, state.carrierState);
    // Enrich with run-state the analytics dashboard needs: WIP in system and a
    // lightweight per-order progress snapshot (counters live on engine state).
    m.simTime = state.clock.now();
    m.unitsInSystem = state.govState.wipCount;
    m.orders = state.orders.map((o) => ({
      id: o.id,
      quantity: o.quantity,
      units_created: o.units_created,
      units_completed: o.units_completed,
      scrap: o.scrap,
      status: o.status,
    }));
    setSimTime(state.clock.now());
    setMetrics(m);
    if (newShocks.length) setShocks((prev) => [...prev, ...newShocks]);

    // Feed: coalesced exits, scraps/shocks, and order-status transitions.
    if (exitedCount > 0) {
      frameFeed.push({
        type: 'units_completed',
        timestamp: exitedLast.timestamp,
        count: exitedCount,
        unit_id: exitedCount === 1 ? exitedLast.unit_id : null,
        material: exitedLast.material,
      });
    }
    for (const o of m.orders) {
      const prev = prevOrderStatusRef.current.get(o.id);
      if (prev !== undefined && prev !== o.status && (o.status === 'completed' || o.status === 'short')) {
        frameFeed.push({ type: 'order_' + o.status, timestamp: state.clock.now(), order_id: o.id });
      }
      prevOrderStatusRef.current.set(o.id, o.status);
    }
    if (pushFeed(frameFeed)) setEventsVersion((v) => v + 1);
  }, [config]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
  }, []);

  const setSpeed = useCallback((s) => {
    speedRef.current = s;
  }, []);

  // Pause-and-apply: swap config while preserving in-flight state.
  // Caller must call pause() first.
  const applyConfig = useCallback(
    (newConfig) => {
      if (!pausedRef.current) throw new Error('call pause() before applyConfig()');
      const v = validateFactoryConfig(newConfig);
      if (v.errors.length) throw new Error(`Invalid config: ${v.errors[0]}`);

      const s = engineStateRef.current;
      s.config = newConfig;
      s.stationMap = new Map(newConfig.stations.map((st) => [st.id, st]));
      s.processMap = new Map(newConfig.processes.map((p) => [p.id, p]));
      s.nodeToStation = new Map(newConfig.stations.map((st) => [st.node_id, st]));

      const intakeNodes = new Set(newConfig.nodes.filter((n) => n.type === 'intake').map((n) => n.id));
      s.intakeSegments = newConfig.segments.filter((sg) => intakeNodes.has(sg.from_node_id));
      s.exitIds = new Set(newConfig.exits.map((e) => e.id));
      s.flowState._config = newConfig;

      // Update metrics immediately with new config.
      setMetrics(liveMetrics(newConfig, s.flowState, s.carrierState));
    },
    []
  );

  // Rewind: restore(token, config) → replace engine state in place.
  const rewind = useCallback(
    (token) => {
      engineStateRef.current = restore(token, config);
      setSimTime(token.clockTime);
      setDone(false);
      pausedRef.current = false;
      setPaused(false);
      setShocks([]);
      feedRef.current = [];
      prevOrderStatusRef.current = new Map();
      setEventsVersion((v) => v + 1);
    },
    [config]
  );

  return {
    advanceFrame,
    pause,
    resume,
    setSpeed,
    applyConfig,
    rewind,
    simTime,
    metrics,
    shocks,
    paused,
    done,
    events: feedRef.current,
    eventsVersion,
    _engineState: () => engineStateRef.current,
  };
}
