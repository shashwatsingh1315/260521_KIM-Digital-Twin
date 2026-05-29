import { describe, test, expect } from 'vitest';
import { makeSchedulerState, nextEventTime, dueCompletions, startSlot, freeSlot, freeSlotCount } from './taktScheduler.js';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';

describe('taktScheduler', () => {
  test('all idle initially → nextEventTime is Infinity', () => {
    const cfg = makeLinearLineFixture();
    const sched = makeSchedulerState(cfg);
    expect(nextEventTime(sched)).toBe(Infinity);
  });

  test('starts a slot and tracks completion time', () => {
    const cfg = makeLinearLineFixture();
    const sched = makeSchedulerState(cfg);
    const slot = startSlot(sched, 'station_a', 'heat', 'u1', 0, 30);
    expect(slot).not.toBeNull();
    expect(slot.busy).toBe(true);
    expect(slot.completion_time).toBe(30);
    expect(nextEventTime(sched)).toBe(30);
  });

  test('dueCompletions returns slots at given time', () => {
    const cfg = makeLinearLineFixture();
    const sched = makeSchedulerState(cfg);
    startSlot(sched, 'station_a', 'heat', 'u1', 0, 30);
    startSlot(sched, 'station_b', 'treat', 'u2', 0, 60);
    const due30 = dueCompletions(sched, 30);
    expect(due30).toHaveLength(1);
    expect(due30[0].station_id).toBe('station_a');
  });

  test('freeSlot releases for reuse', () => {
    const cfg = makeLinearLineFixture();
    const sched = makeSchedulerState(cfg);
    const slot = startSlot(sched, 'station_a', 'heat', 'u1', 0, 30);
    freeSlot(slot);
    expect(slot.busy).toBe(false);
    expect(nextEventTime(sched)).toBe(Infinity);
    expect(freeSlotCount(sched, 'station_a', 'heat')).toBe(1);
  });

  test('back-to-back: completion at t + takt', () => {
    const cfg = makeLinearLineFixture();
    const sched = makeSchedulerState(cfg);
    const slot = startSlot(sched, 'station_b', 'treat', 'u1', 0, 60);
    const due = dueCompletions(sched, 60);
    expect(due[0].completion_time).toBe(60);
    freeSlot(slot);
    startSlot(sched, 'station_b', 'treat', 'u2', 60, 60);
    expect(nextEventTime(sched)).toBe(120);
  });

  test('dueCompletions is deterministically ordered by station_id', () => {
    const cfg = makeLinearLineFixture();
    const sched = makeSchedulerState(cfg);
    startSlot(sched, 'station_c', 'cool', 'u1', 0, 30);
    startSlot(sched, 'station_a', 'heat', 'u2', 0, 30);
    const due = dueCompletions(sched, 30);
    expect(due[0].station_id).toBe('station_a');
    expect(due[1].station_id).toBe('station_c');
  });
});
