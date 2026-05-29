// Tests for the step-oriented engine API (Part C1).

import { describe, test, expect, beforeEach } from 'vitest';
import { resetIds } from '../../util/ids.js';
import { initState, step, runTwin } from '../engine.js';
import { sortEvents } from '../events.js';
import { makeLinearLineFixture } from '../../fixtures/linearLine.js';

beforeEach(() => resetIds(0));

describe('initState + step', () => {
  test('initState returns state and events', () => {
    const cfg = makeLinearLineFixture();
    const { state, events } = initState(cfg, { seed: 0 });
    expect(state).toBeDefined();
    expect(Array.isArray(events)).toBe(true);
  });

  test('t=0 events include unit_created for admitted units', () => {
    const cfg = makeLinearLineFixture();
    const { events } = initState(cfg, { seed: 0 });
    expect(events.some((e) => e.type === 'unit_created')).toBe(true);
  });

  test('step returns state, events, and done', () => {
    const cfg = makeLinearLineFixture();
    const { state } = initState(cfg, { seed: 0 });
    const result = step(state);
    expect(result).toHaveProperty('state');
    expect(result).toHaveProperty('events');
    expect(result).toHaveProperty('done');
  });

  test('step loop produces same summary as runTwin', () => {
    resetIds(0);
    const cfg = makeLinearLineFixture();
    const { summary: batchSummary } = runTwin(cfg, { seed: 0 });

    resetIds(0);
    const cfg2 = makeLinearLineFixture();
    let { state, events: initEvents } = initState(cfg2, { seed: 0 });
    const allEvents = [...initEvents];
    let done = false;
    let iters = 0;
    while (!done && iters++ < 100000) {
      const result = step(state);
      state = result.state;
      for (const ev of result.events) allEvents.push(ev);
      done = result.done;
    }

    // Manually finalize orders.
    for (const order of state.orders) {
      if (order.status === 'in_progress') {
        if (order.units_completed >= order.quantity) order.status = 'completed';
        else order.status = 'short';
      }
    }

    expect(state.orders.reduce((s, o) => s + o.units_completed, 0))
      .toBe(batchSummary.units_shipped);
  });

  test('step loop produces identical event types to runTwin', () => {
    resetIds(0);
    const cfg = makeLinearLineFixture();
    const { events: batchEvents } = runTwin(cfg, { seed: 0 });

    resetIds(0);
    const cfg2 = makeLinearLineFixture();
    let { state, events: initEvents } = initState(cfg2, { seed: 0 });
    const allEvents = [...initEvents];
    let done = false;
    let iters = 0;
    while (!done && iters++ < 100000) {
      const result = step(state);
      state = result.state;
      for (const ev of result.events) allEvents.push(ev);
      done = result.done;
    }

    const batchTypes = batchEvents.map((e) => e.type);
    const stepTypes = sortEvents(allEvents).map((e) => e.type);
    expect(stepTypes).toEqual(batchTypes);
  });

  test('done=true when all orders complete', () => {
    const cfg = makeLinearLineFixture();
    let { state } = initState(cfg, { seed: 0 });
    let done = false;
    let iters = 0;
    while (!done && iters++ < 100000) {
      ({ state, done } = step(state));
    }
    expect(done).toBe(true);
    expect(iters).toBeLessThan(100000);
  });
});
