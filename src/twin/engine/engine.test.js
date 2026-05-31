import { describe, test, expect } from 'vitest';
import { runTwin, initState, step, peekNextEventTime } from './engine.js';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';
import { validateFactoryConfig } from './validator.js';

describe('peekNextEventTime', () => {
  test('returns the next event time without mutating the clock', () => {
    const { state } = initState(makeLinearLineFixture());
    const before = state.clock.now();
    const tNext = peekNextEventTime(state);
    expect(tNext).toBeGreaterThan(before);
    expect(Number.isFinite(tNext)).toBe(true);
    // Clock is untouched by peeking.
    expect(state.clock.now()).toBe(before);
  });

  test('matches the time step() advances the clock to', () => {
    const { state } = initState(makeLinearLineFixture());
    const tNext = peekNextEventTime(state);
    step(state);
    expect(state.clock.now()).toBe(tNext);
  });

  test('returns Infinity once all orders are complete', () => {
    const { state } = initState(makeLinearLineFixture());
    // Drive to completion.
    for (let i = 0; i < 10000; i++) {
      const { done } = step(state);
      if (done) break;
    }
    expect(peekNextEventTime(state)).toBe(Infinity);
  });
});

describe('runTwin', () => {
  test('accepts valid linearLine config', () => {
    const cfg = makeLinearLineFixture();
    const validation = validateFactoryConfig(cfg);
    expect(validation.errors).toHaveLength(0);
  });

  test('returns states, events, and summary', () => {
    const cfg = makeLinearLineFixture();
    const result = runTwin(cfg);

    expect(result).toHaveProperty('states');
    expect(result).toHaveProperty('events');
    expect(result).toHaveProperty('summary');
    expect(Array.isArray(result.states)).toBe(true);
    expect(Array.isArray(result.events)).toBe(true);
  });

  test('has frozen result', () => {
    const cfg = makeLinearLineFixture();
    const result = runTwin(cfg);
    expect(Object.isFrozen(result)).toBe(true);
  });

  test('summary includes metrics', () => {
    const cfg = makeLinearLineFixture();
    const result = runTwin(cfg);
    expect(result.summary).toHaveProperty('final_time');
    expect(result.summary).toHaveProperty('orders_completed');
    expect(result.summary).toHaveProperty('total_orders');
  });
});
