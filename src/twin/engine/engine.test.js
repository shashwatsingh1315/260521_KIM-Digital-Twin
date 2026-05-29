import { describe, test, expect } from 'vitest';
import { runTwin } from './engine.js';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';
import { validateFactoryConfig } from './validator.js';

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
