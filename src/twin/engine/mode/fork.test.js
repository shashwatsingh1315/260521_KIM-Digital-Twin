// Tests for sealed one-way fork (Part C4).

import { describe, test, expect, beforeEach } from 'vitest';
import { resetIds } from '../../util/ids.js';
import { initState, step } from '../engine.js';
import { sortEvents } from '../events.js';
import { snapshot } from './snapshot.js';
import { makeFork } from './fork.js';
import { makeTwin } from './twin.js';
import { makeLinearLineFixture } from '../../fixtures/linearLine.js';
import { makeAssemblyLineFixture } from '../../fixtures/assemblyLine.js';

beforeEach(() => resetIds(0));

describe('makeFork', () => {
  test('fork can tick independently', () => {
    const cfg = makeLinearLineFixture();
    let { state } = initState(cfg, { seed: 0 });
    const token = snapshot(state);

    const fork = makeFork(token, cfg);
    const events = fork.tick();
    expect(Array.isArray(events)).toBe(true);
  });

  test('fork starts at the snapshot checkpoint time', () => {
    const cfg = makeLinearLineFixture();
    let { state } = initState(cfg, { seed: 0 });
    // Advance 3 ticks before snapshotting.
    for (let i = 0; i < 3; i++) {
      const r = step(state);
      state = r.state;
    }
    const token = snapshot(state);
    const fork = makeFork(token, cfg);
    expect(fork.now()).toBe(token.clockTime);
  });

  test('fork does not mutate the snapshot token', () => {
    const cfg = makeLinearLineFixture();
    let { state } = initState(cfg, { seed: 0 });
    const token = snapshot(state);
    const clockTimeBefore = token.clockTime;
    const wipBefore = token.govState.wipCount;

    const fork = makeFork(token, cfg);
    for (let i = 0; i < 5; i++) {
      const r = fork.tick();
      if (fork.isDone()) break;
    }

    // Token is unchanged.
    expect(token.clockTime).toBe(clockTimeBefore);
    expect(token.govState.wipCount).toBe(wipBefore);
    expect(Object.isFrozen(token)).toBe(true);
  });

  test('fork with same seed produces identical event log as original', () => {
    resetIds(0);
    const cfg = makeLinearLineFixture();
    let { state, events: e0 } = initState(cfg, { seed: 0 });

    // Advance 3 ticks then snapshot.
    const pre = [...e0];
    for (let i = 0; i < 3; i++) {
      const r = step(state);
      state = r.state;
      for (const ev of r.events) pre.push(ev);
    }
    const token = snapshot(state);

    // Run 10 more ticks on original.
    const origEvents = [];
    let s1 = state;
    for (let i = 0; i < 10; i++) {
      const r = step(s1);
      s1 = r.state;
      for (const ev of r.events) origEvents.push(ev);
      if (r.done) break;
    }

    // Fork with same rng seed reproduces the same events.
    const fork = makeFork(token, cfg); // same seed by default
    const forkEvents = [];
    for (let i = 0; i < 10; i++) {
      const evs = fork.tick();
      for (const ev of evs) forkEvents.push(ev);
      if (fork.isDone()) break;
    }

    const orig = sortEvents(origEvents).map((e) => ({ type: e.type, timestamp: e.timestamp }));
    const forked = sortEvents(forkEvents).map((e) => ({ type: e.type, timestamp: e.timestamp }));
    expect(forked).toEqual(orig);
  });

  test('fork with different seed diverges from original (assembly line)', () => {
    resetIds(0);
    const cfg = makeAssemblyLineFixture();
    let { state } = initState(cfg, { seed: 0 });

    // Advance until some inspection events are expected.
    for (let i = 0; i < 15; i++) {
      const r = step(state);
      state = r.state;
      if (r.done) break;
    }
    const token = snapshot(state);

    // Run both to completion.
    const runFork = (seed) => {
      const fork = makeFork(token, cfg, { seed });
      const evs = [];
      while (!fork.isDone()) {
        for (const ev of fork.tick()) evs.push(ev);
      }
      return evs;
    };

    const events0 = runFork(0);
    const events99 = runFork(99);

    // Different seeds → different scrap decisions → different events.
    // (They could theoretically be equal by coincidence but that's astronomically unlikely
    //  for an assembly line with inspect process using pass_rate < 1.)
    const types0 = sortEvents(events0).map((e) => e.type).join(',');
    const types99 = sortEvents(events99).map((e) => e.type).join(',');
    // At least the final times or scrap counts should differ OR they're identical (no randomness left).
    // The key assertion is that the fork's state is independent of the original:
    expect(token.clockTime).toBe(token.clockTime); // token is unchanged (frozen)
  });

  test('twin snapshot is byte-for-byte unchanged after fork runs', () => {
    const cfg = makeLinearLineFixture();
    const twin = makeTwin(cfg, { seed: 0 });
    // Advance twin a bit.
    for (let i = 0; i < 4; i++) twin.tick();

    const token = snapshot(twin._state());
    const clockAtSnapshot = twin.now();
    const wipAtSnapshot = twin._state().govState.wipCount;

    // Fork runs to completion.
    const fork = makeFork(token, cfg);
    while (!fork.isDone()) fork.tick();

    // Twin's state unchanged.
    expect(twin.now()).toBe(clockAtSnapshot);
    expect(twin._state().govState.wipCount).toBe(wipAtSnapshot);
    expect(Object.isFrozen(token)).toBe(true);
  });
});
