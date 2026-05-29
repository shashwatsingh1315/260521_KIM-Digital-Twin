import { describe, test, expect } from 'vitest';
import {
  EVENT_TYPE,
  unitCreated,
  unitMoved,
  stationStarted,
  stationCompleted,
  unitExited,
  scrapped,
  shockRaised,
  sortEvents,
} from './events.js';

describe('event constructors', () => {
  test('unitCreated freezes event', () => {
    const evt = unitCreated(10, 'u1', 'ord1', 'STEEL');
    expect(evt.type).toBe(EVENT_TYPE.UNIT_CREATED);
    expect(evt.timestamp).toBe(10);
    expect(evt.unit_id).toBe('u1');
    expect(Object.isFrozen(evt)).toBe(true);
  });

  test('stationCompleted captures process', () => {
    const evt = stationCompleted(50, 'st_heat', 'heat', 'u1');
    expect(evt.type).toBe(EVENT_TYPE.STATION_COMPLETED);
    expect(evt.station_id).toBe('st_heat');
    expect(evt.process_id).toBe('heat');
  });

  test('scrapped captures unit only', () => {
    const evt = scrapped(100, 'u5');
    expect(evt.type).toBe(EVENT_TYPE.SCRAPPED);
    expect(evt.unit_id).toBe('u5');
  });

  test('shockRaised captures reason and members', () => {
    const evt = shockRaised(50, 'deadlock', ['buffer_a', 'carrier_1']);
    expect(evt.type).toBe(EVENT_TYPE.SHOCK_RAISED);
    expect(evt.reason).toBe('deadlock');
    expect(evt.members).toEqual(['buffer_a', 'carrier_1']);
  });
});

describe('sortEvents', () => {
  test('sorts by timestamp', () => {
    const e1 = unitCreated(20, 'u1', 'o1', 'M');
    const e2 = unitCreated(10, 'u2', 'o1', 'M');
    const e3 = unitCreated(30, 'u3', 'o1', 'M');

    const sorted = sortEvents([e3, e1, e2]);
    expect(sorted[0].timestamp).toBe(10);
    expect(sorted[1].timestamp).toBe(20);
    expect(sorted[2].timestamp).toBe(30);
  });

  test('tie-breaks same timestamp by type order', () => {
    const created = unitCreated(50, 'u1', 'o1', 'M');
    const moved = unitMoved(50, 'u1', 'loc1', 'loc2');
    const completed = stationCompleted(50, 'st', 'proc', 'u1');

    const sorted = sortEvents([completed, created, moved]);
    expect(sorted[0].type).toBe(EVENT_TYPE.UNIT_CREATED);
    expect(sorted[1].type).toBe(EVENT_TYPE.UNIT_MOVED);
    expect(sorted[2].type).toBe(EVENT_TYPE.STATION_COMPLETED);
  });

  test('tie-breaks same type/time by unit_id', () => {
    const e1 = unitCreated(50, 'u3', 'o1', 'M');
    const e2 = unitCreated(50, 'u1', 'o1', 'M');
    const e3 = unitCreated(50, 'u2', 'o1', 'M');

    const sorted = sortEvents([e1, e3, e2]);
    expect(sorted[0].unit_id).toBe('u1');
    expect(sorted[1].unit_id).toBe('u2');
    expect(sorted[2].unit_id).toBe('u3');
  });

  test('returns new array', () => {
    const events = [unitCreated(10, 'u1', 'o1', 'M')];
    const sorted = sortEvents(events);
    expect(sorted).not.toBe(events);
  });
});
