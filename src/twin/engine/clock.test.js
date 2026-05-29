import { describe, test, expect } from 'vitest';
import { makeClock } from './clock.js';

describe('makeClock', () => {
  test('starts at initial time', () => {
    const clock = makeClock(10);
    expect(clock.now()).toBe(10);
  });

  test('defaults to 0', () => {
    const clock = makeClock();
    expect(clock.now()).toBe(0);
  });

  test('advances by delta', () => {
    const clock = makeClock(5);
    clock.advance(3);
    expect(clock.now()).toBe(8);
  });

  test('sets absolute time', () => {
    const clock = makeClock(0);
    clock.setTime(100);
    expect(clock.now()).toBe(100);
  });

  test('is frozen', () => {
    const clock = makeClock();
    expect(Object.isFrozen(clock)).toBe(true);
  });
});
