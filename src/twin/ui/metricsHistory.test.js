import { describe, test, expect } from 'vitest';
import {
  pushSample, throughputPerHour, etaSeconds, orderProgress,
  formatDuration, sparklinePoints,
} from './metricsHistory.js';

describe('metricsHistory — pushSample', () => {
  test('appends in order without mutating the input', () => {
    const h0 = [];
    const h1 = pushSample(h0, { t: 0, completed: 0, wip: 0 });
    const h2 = pushSample(h1, { t: 5, completed: 1, wip: 2 });
    expect(h0).toEqual([]);
    expect(h2.length).toBe(2);
    expect(h2[1].t).toBe(5);
  });

  test('ignores non-increasing timestamps', () => {
    const h = pushSample(pushSample([], { t: 10, completed: 1, wip: 0 }), { t: 10, completed: 9, wip: 9 });
    expect(h.length).toBe(1);
    expect(h[0].completed).toBe(1);
  });

  test('caps the series length, keeping the most recent', () => {
    let h = [];
    for (let t = 0; t < 10; t++) h = pushSample(h, { t, completed: t, wip: 0 }, 4);
    expect(h.length).toBe(4);
    expect(h[h.length - 1].t).toBe(9);
    expect(h[0].t).toBe(6);
  });
});

describe('metricsHistory — throughputPerHour', () => {
  test('computes units/hour from completed deltas', () => {
    const h = [
      { t: 0, completed: 0, wip: 0 },
      { t: 3600, completed: 10, wip: 0 },
    ];
    expect(throughputPerHour(h)).toBeCloseTo(10);
  });

  test('honours the trailing window', () => {
    const h = [
      { t: 0, completed: 0, wip: 0 },
      { t: 3600, completed: 100, wip: 0 },   // outside a 600s window
      { t: 3900, completed: 101, wip: 0 },   // +1 unit in 300s → 12/hr
    ];
    expect(throughputPerHour(h, 600)).toBeCloseTo(12);
  });

  test('returns 0 with insufficient data', () => {
    expect(throughputPerHour([])).toBe(0);
    expect(throughputPerHour([{ t: 0, completed: 0, wip: 0 }])).toBe(0);
  });
});

describe('metricsHistory — etaSeconds', () => {
  test('remaining / rate, scaled to seconds', () => {
    expect(etaSeconds(10, 10)).toBeCloseTo(3600);
  });
  test('zero remaining → 0', () => {
    expect(etaSeconds(0, 10)).toBe(0);
  });
  test('stalled line → Infinity', () => {
    expect(etaSeconds(5, 0)).toBe(Infinity);
  });
});

describe('metricsHistory — orderProgress', () => {
  test('aggregates target / completed / remaining', () => {
    const p = orderProgress([
      { quantity: 20, units_completed: 5, scrap: 1 },
      { quantity: 20, units_completed: 20, scrap: 0 },
    ]);
    expect(p.target).toBe(40);
    expect(p.completed).toBe(25);
    expect(p.remaining).toBe(15);
    expect(p.scrapped).toBe(1);
    expect(p.fraction).toBeCloseTo(25 / 40);
  });

  test('empty orders are safe', () => {
    expect(orderProgress([])).toEqual({ target: 0, completed: 0, scrapped: 0, remaining: 0, fraction: 0 });
  });
});

describe('metricsHistory — formatDuration', () => {
  test('Infinity renders as a dash', () => {
    expect(formatDuration(Infinity)).toBe('—');
  });
  test('compact h/m/s', () => {
    expect(formatDuration(3700)).toBe('1h 1m');
    expect(formatDuration(125)).toBe('2m 5s');
    expect(formatDuration(42)).toBe('42s');
  });
});

describe('metricsHistory — sparklinePoints', () => {
  test('empty series → empty string', () => {
    expect(sparklinePoints([], 100, 20)).toBe('');
  });
  test('maps first/last to the horizontal extents', () => {
    const pts = sparklinePoints([0, 10], 100, 20).split(' ');
    expect(pts.length).toBe(2);
    expect(pts[0].startsWith('0.0,')).toBe(true);
    expect(pts[1].startsWith('100.0,')).toBe(true);
  });
});

describe('metricsHistory — fmtClock', () => {
  test('formats hh:mm:ss', async () => {
    const { fmtClock } = await import('./metricsHistory.js');
    expect(fmtClock(0)).toBe('00:00:00');
    expect(fmtClock(3661)).toBe('01:01:01');
    expect(fmtClock(59.9)).toBe('00:00:59');
  });
});

describe('metricsHistory — trendDelta', () => {
  test('null with too little history', async () => {
    const { trendDelta } = await import('./metricsHistory.js');
    expect(trendDelta([], 60)).toBeNull();
    expect(trendDelta([{ t: 0, wip: 1 }, { t: 5, wip: 2 }], 60)).toBeNull();
  });

  test('positive when recent window averages higher', async () => {
    const { trendDelta } = await import('./metricsHistory.js');
    // prior window (t 0..50): wip 2; recent window (t 60..110): wip 4 → +1.0
    const h = [];
    for (let t = 0; t <= 50; t += 10) h.push({ t, wip: 2 });
    for (let t = 60; t <= 110; t += 10) h.push({ t, wip: 4 });
    const d = trendDelta(h, 50, (s) => s.wip);
    expect(d).toBeGreaterThan(0.9);
    expect(d).toBeLessThan(1.1);
  });

  test('zero for a flat series', async () => {
    const { trendDelta } = await import('./metricsHistory.js');
    const h = [];
    for (let t = 0; t <= 120; t += 10) h.push({ t, wip: 3 });
    expect(trendDelta(h, 50, (s) => s.wip)).toBe(0);
  });
});

describe('metricsHistory — sparklineAreaPath / seriesMinMax', () => {
  test('empty series → empty path', async () => {
    const { sparklineAreaPath } = await import('./metricsHistory.js');
    expect(sparklineAreaPath([], 100, 20)).toBe('');
  });

  test('closed path starts and ends on the baseline', async () => {
    const { sparklineAreaPath } = await import('./metricsHistory.js');
    const p = sparklineAreaPath([0, 5, 10], 100, 20);
    expect(p.startsWith('M0.0,20')).toBe(true);
    expect(p.endsWith('Z')).toBe(true);
    expect(p).toContain('L100.0,20');
  });

  test('seriesMinMax finds extremes', async () => {
    const { seriesMinMax } = await import('./metricsHistory.js');
    expect(seriesMinMax([3, -1, 7])).toEqual({ min: -1, max: 7 });
    expect(seriesMinMax([])).toEqual({ min: 0, max: 0 });
  });
});
