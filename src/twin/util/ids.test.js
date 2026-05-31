import { describe, test, expect, beforeEach } from 'vitest';
import { newId, resetIds } from './ids.js';
import { invariant } from './assert.js';

describe('ids', () => {
  beforeEach(() => resetIds(0));

  test('produces sequential prefixed ids', () => {
    expect(newId('unit')).toBe('unit-1');
    expect(newId('unit')).toBe('unit-2');
    expect(newId('order')).toBe('order-3');
  });

  test('resetIds makes generation deterministic across runs', () => {
    const first = [newId('u'), newId('u'), newId('u')];
    resetIds(0);
    const second = [newId('u'), newId('u'), newId('u')];
    expect(second).toEqual(first);
  });

  test('resetIds accepts a seed offset', () => {
    resetIds(10);
    expect(newId('x')).toBe('x-11');
  });
});

describe('invariant', () => {
  test('passes silently when condition is truthy', () => {
    expect(() => invariant(true, 'should not throw')).not.toThrow();
  });

  test('throws with a prefixed message when falsy', () => {
    expect(() => invariant(false, 'boom')).toThrow('[twin] boom');
  });
});
