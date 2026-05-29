import { describe, test, expect } from 'vitest';
import { makeRng } from './rng.js';

describe('makeRng', () => {
  test('same seed produces identical sequence', () => {
    const r1 = makeRng(42);
    const r2 = makeRng(42);
    for (let i = 0; i < 20; i++) expect(r1()).toBe(r2());
  });

  test('different seeds produce different sequences', () => {
    const r1 = makeRng(1);
    const r2 = makeRng(2);
    const vals1 = Array.from({ length: 10 }, () => r1());
    const vals2 = Array.from({ length: 10 }, () => r2());
    expect(vals1).not.toEqual(vals2);
  });

  test('output is in [0, 1)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
