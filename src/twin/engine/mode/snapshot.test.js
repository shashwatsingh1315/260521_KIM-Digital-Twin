// Tests for snapshot / restore (Part C2).
//
// Key property: restore(snapshot(state)) then step N times produces
// the exact same event log as the original N steps from that checkpoint.

import { describe, test, expect, beforeEach } from 'vitest';
import { resetIds } from '../../util/ids.js';
import { initState, step } from '../engine.js';
import { sortEvents } from '../events.js';
import { snapshot, restore } from './snapshot.js';
import { makeLinearLineFixture } from '../../fixtures/linearLine.js';
import { makeAssemblyLineFixture } from '../../fixtures/assemblyLine.js';

beforeEach(() => resetIds(0));

describe('snapshot + restore', () => {
  test('snapshot returns a frozen token', () => {
    const cfg = makeLinearLineFixture();
    const { state } = initState(cfg, { seed: 0 });
    const token = snapshot(state);
    expect(Object.isFrozen(token)).toBe(true);
  });

  test('restore returns a live state that can be stepped', () => {
    const cfg = makeLinearLineFixture();
    const { state } = initState(cfg, { seed: 0 });
    const token = snapshot(state);
    const restored = restore(token, cfg);
    const result = step(restored);
    expect(result).toHaveProperty('events');
    expect(result).toHaveProperty('done');
  });

  test('rewind determinism: restore then N steps == original N steps (linear line)', () => {
    resetIds(0);
    const cfg = makeLinearLineFixture();
    let { state, events: e0 } = initState(cfg, { seed: 0 });

    // Advance 3 ticks to get past t=0.
    const preEvents = [...e0];
    for (let i = 0; i < 3; i++) {
      const r = step(state);
      state = r.state;
      for (const ev of r.events) preEvents.push(ev);
    }

    // Snapshot at this checkpoint.
    const token = snapshot(state);

    // Run 10 more ticks from original state.
    const origEvents = [];
    let s1 = state;
    for (let i = 0; i < 10; i++) {
      const r = step(s1);
      s1 = r.state;
      for (const ev of r.events) origEvents.push(ev);
      if (r.done) break;
    }

    // Restore and run the same 10 ticks.
    const s2 = restore(token, cfg);
    const replayEvents = [];
    let sr = s2;
    for (let i = 0; i < 10; i++) {
      const r = step(sr);
      sr = r.state;
      for (const ev of r.events) replayEvents.push(ev);
      if (r.done) break;
    }

    // Must produce identical event logs.
    const orig = sortEvents(origEvents).map((e) => ({ type: e.type, timestamp: e.timestamp }));
    const replay = sortEvents(replayEvents).map((e) => ({ type: e.type, timestamp: e.timestamp }));
    expect(replay).toEqual(orig);
  });

  test('snapshot does not share mutable state with original (isolation)', () => {
    const cfg = makeLinearLineFixture();
    let { state } = initState(cfg, { seed: 0 });
    const token = snapshot(state);

    // Advance original state several ticks.
    for (let i = 0; i < 5; i++) {
      const r = step(state);
      state = r.state;
      if (r.done) break;
    }

    // Restore token — should reflect the pre-advance checkpoint, not post.
    const restored = restore(token, cfg);
    expect(restored.clock.now()).toBe(token.clockTime);
    expect(restored.govState.wipCount).toBe(token.govState.wipCount);
  });

  test('snapshot preserves in-flight units on segments', () => {
    const cfg = makeLinearLineFixture();
    let { state, events: initEvents } = initState(cfg, { seed: 0 });
    // Advance one tick so units are in transit.
    const r = step(state);
    state = r.state;

    const token = snapshot(state);
    const restored = restore(token, cfg);

    // Count in-transit units in both.
    let origInTransit = 0;
    for (const [, units] of state.flowState.segmentUnits) origInTransit += units.length;
    let restoredInTransit = 0;
    for (const [, units] of restored.flowState.segmentUnits) restoredInTransit += units.length;

    expect(restoredInTransit).toBe(origInTransit);
  });

  test('rewind works on assembly line (rng state preserved)', () => {
    resetIds(0);
    const cfg = makeAssemblyLineFixture();
    let { state } = initState(cfg, { seed: 42 });

    // Advance until inspection events appear (rng consumed).
    let ticked = 0;
    while (ticked < 20) {
      const r = step(state);
      state = r.state;
      ticked++;
      if (r.done) break;
    }

    const token = snapshot(state);

    // Run 8 more ticks from original.
    const origEvents = [];
    let s1 = state;
    for (let i = 0; i < 8; i++) {
      const r = step(s1);
      s1 = r.state;
      for (const ev of r.events) origEvents.push(ev);
      if (r.done) break;
    }

    // Restore and replay.
    const s2 = restore(token, cfg);
    const replayEvents = [];
    let sr = s2;
    for (let i = 0; i < 8; i++) {
      const r = step(sr);
      sr = r.state;
      for (const ev of r.events) replayEvents.push(ev);
      if (r.done) break;
    }

    const orig = sortEvents(origEvents).map((e) => ({ type: e.type, timestamp: e.timestamp }));
    const replay = sortEvents(replayEvents).map((e) => ({ type: e.type, timestamp: e.timestamp }));
    expect(replay).toEqual(orig);
  });
});
