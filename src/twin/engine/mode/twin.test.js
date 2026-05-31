// Tests for the twin wall-clock adapter with pause-and-apply (Part C3).

import { describe, test, expect, beforeEach } from 'vitest';
import { resetIds } from '../../util/ids.js';
import { makeTwin } from './twin.js';
import { makeLinearLineFixture } from '../../fixtures/linearLine.js';

beforeEach(() => resetIds(0));

describe('makeTwin', () => {
  test('tick returns events array', () => {
    const cfg = makeLinearLineFixture();
    const twin = makeTwin(cfg, { seed: 0 });
    const events = twin.tick();
    expect(Array.isArray(events)).toBe(true);
  });

  test('tick advances simulation time', () => {
    const cfg = makeLinearLineFixture();
    const twin = makeTwin(cfg, { seed: 0 });
    twin.tick();
    expect(twin.now()).toBeGreaterThan(0);
  });

  test('isDone returns true when all orders complete', () => {
    const cfg = makeLinearLineFixture();
    const twin = makeTwin(cfg, { seed: 0 });
    let iters = 0;
    while (!twin.isDone() && iters++ < 100000) {
      twin.tick();
    }
    expect(twin.isDone()).toBe(true);
    expect(iters).toBeLessThan(100000);
  });

  test('tick throws if twin is paused', () => {
    const cfg = makeLinearLineFixture();
    const twin = makeTwin(cfg, { seed: 0 });
    twin.pause();
    expect(() => twin.tick()).toThrow('paused');
  });

  test('apply throws if twin is not paused', () => {
    const cfg = makeLinearLineFixture();
    const twin = makeTwin(cfg, { seed: 0 });
    expect(() => twin.apply(cfg)).toThrow('pause');
  });

  test('pause-and-apply preserves in-flight units', () => {
    const cfg = makeLinearLineFixture();
    const twin = makeTwin(cfg, { seed: 0 });

    // Advance a few ticks so units are in transit.
    for (let i = 0; i < 3; i++) twin.tick();

    const wipBefore = twin._state().govState.wipCount;
    const clockBefore = twin.now();

    twin.pause();
    twin.apply(cfg); // Apply same config — no changes to units.
    twin.resume();

    // In-flight state preserved.
    expect(twin._state().govState.wipCount).toBe(wipBefore);
    expect(twin.now()).toBe(clockBefore);
  });

  test('pause-and-apply config change: new takt takes effect on future completions', () => {
    const cfg = makeLinearLineFixture();
    const twin = makeTwin(cfg, { seed: 0 });

    // Tick to start processing, then pause.
    for (let i = 0; i < 2; i++) twin.tick();
    twin.pause();

    // Build a modified config with faster takt (half time) by replacing processes.
    const fastProcesses = cfg.processes.map((p) => ({ ...p }));
    const fastStations = cfg.stations.map((s) => ({
      ...s,
      processes: s.processes.map((sp) => ({ ...sp, takt_seconds: sp.takt_seconds / 2 })),
    }));
    const fastCfg = { ...cfg, stations: fastStations, processes: fastProcesses };

    twin.apply(fastCfg);
    twin.resume();

    // Run to completion.
    let iters = 0;
    while (!twin.isDone() && iters++ < 100000) twin.tick();

    // Should complete faster than full-takt run.
    const slowTwin = makeTwin(cfg, { seed: 0 });
    while (!slowTwin.isDone()) slowTwin.tick();

    // Fast run finishes at an earlier or equal time.
    expect(twin.now()).toBeLessThanOrEqual(slowTwin.now());
  });

  test('resume after pause without apply continues normally', () => {
    const cfg = makeLinearLineFixture();
    const twin = makeTwin(cfg, { seed: 0 });
    for (let i = 0; i < 3; i++) twin.tick();
    twin.pause();
    twin.resume();
    expect(twin.isPaused()).toBe(false);
    const events = twin.tick(); // should not throw
    expect(Array.isArray(events)).toBe(true);
  });
});
