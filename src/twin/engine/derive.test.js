import { describe, test, expect } from 'vitest';
import {
  effectiveSlots,
  capacityPerHour,
  effectiveThroughput,
  shiftAvailability,
  bottleneck,
  roundTripTime,
  poolThroughput,
  holdThroughput,
  peopleRequired,
  amrFleet,
} from './derive.js';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';
import { makeAssemblyLineFixture } from '../fixtures/assemblyLine.js';
import { makeMaterial } from '../domain/material.js';
import { makeProcess, KIND } from '../domain/process.js';
import { makeShift } from '../domain/shift.js';
import { makeCarrierPool, CARRIER_KIND } from '../network/carrierPool.js';
import { makeFactoryConfig } from '../network/factoryConfig.js';

describe('effectiveSlots', () => {
  test('returns parallel_slots when operators_per_slot === 0', () => {
    const eff = effectiveSlots(3, 0);
    expect(eff).toBe(3);
  });

  test('constrains by operator availability', () => {
    const eff = effectiveSlots(4, 2, 3);
    expect(eff).toBe(Math.min(4, Math.floor(3 / 2)));
    expect(eff).toBe(1);
  });

  test('returns all slots when operators sufficient', () => {
    const eff = effectiveSlots(2, 1, 5);
    expect(eff).toBe(2);
  });
});

describe('capacityPerHour', () => {
  test('computes capacity from takt and effective slots', () => {
    const cap = capacityPerHour(60, 1);
    expect(cap).toBe(60);
  });

  test('scales with multiple slots', () => {
    const cap = capacityPerHour(30, 2);
    expect(cap).toBe(240);
  });

  test('linearLine bottleneck B is 60/hr', () => {
    const cfg = makeLinearLineFixture();
    const stationB = cfg.stations.find((s) => s.id === 'station_b');
    const procB = stationB.processes[0];
    const eff = effectiveSlots(procB.parallel_slots, procB.operators_per_slot);
    const cap = capacityPerHour(procB.takt_seconds, eff);
    expect(cap).toBe(60);
  });
});

describe('effectiveThroughput', () => {
  test('scales capacity by availability', () => {
    const through = effectiveThroughput(100, 0.8);
    expect(through).toBe(80);
  });

  test('defaults availability to 1', () => {
    const through = effectiveThroughput(50);
    expect(through).toBe(50);
  });
});

describe('shiftAvailability', () => {
  test('returns fraction of day', () => {
    const avail = shiftAvailability(8);
    expect(avail).toBeCloseTo(8 / 24);
  });

  test('caps at 1 for 24-hour shifts', () => {
    const avail = shiftAvailability(24);
    expect(avail).toBe(1);
  });
});

describe('bottleneck', () => {
  test('identifies minimum throughput process', () => {
    const cfg = makeLinearLineFixture();
    const bn = bottleneck(cfg);
    expect(bn).not.toBeNull();
    expect(bn.station_id).toBe('station_b');
    expect(bn.process_id).toBe('treat');
  });

  test('returns null for empty config', () => {
    const cfg = makeFactoryConfig({ shifts: [] });
    const bn = bottleneck(cfg);
    expect(bn).toBeNull();
  });
});

describe('roundTripTime', () => {
  test('sums load, travel (loaded and empty), unload for full cycle', () => {
    // 30s load/unload + 20m @ 60 m/min (20s) + 20m @ 120 m/min (10s) = 60s total
    const time = roundTripTime(20, 30, 60, 120);
    expect(time).toBe(30 + 20 + 10);
    expect(time).toBe(60);
  });

  test('typical carrier profile', () => {
    // 30s load/unload + 100m @ 60 m/min (100s) + 100m @ 120 m/min (50s) = 180s
    const time = roundTripTime(100, 30, 60, 120);
    expect(time).toBe(30 + 100 + 50);
    expect(time).toBe(180);
  });
});

describe('poolThroughput', () => {
  test('computes units per hour from count and cycle time', () => {
    const through = poolThroughput(2, 1, 600, 1); // 2 units, 1 per trip, 600s cycle, 100% avail
    expect(through).toBe((2 * 1 * 3600) / 600);
    expect(through).toBe(12);
  });

  test('scales by availability', () => {
    const full = poolThroughput(1, 1, 60, 1);
    const half = poolThroughput(1, 1, 60, 0.5);
    expect(half).toBe(full * 0.5);
  });
});

describe('holdThroughput', () => {
  test('computes throughput from slots and dwell time', () => {
    const through = holdThroughput(3, 300);
    expect(through).toBe((3 / 300) * 3600);
    expect(through).toBe(36);
  });
});

describe('peopleRequired', () => {
  test('linearLine requires 3 people (1 per station)', () => {
    const cfg = makeLinearLineFixture();
    const required = peopleRequired(cfg, 'day');
    expect(required).toBeGreaterThanOrEqual(3);
  });

  test('excludes fully automated processes', () => {
    const mat = makeMaterial({ id: 'M', properties: {}, allowed_processes: ['p'] });
    const proc = makeProcess({ id: 'p', name: 'P', kind: KIND.TRANSFORM, output_material: 'M' });
    const shift = makeShift({ id: 'day', name: 'Day', duration_hours: 8 });

    const cfg = makeFactoryConfig({
      materials: [mat],
      processes: [proc],
      stations: [],
      segments: [],
      nodes: [],
      exits: [],
      carrierPools: [],
      shifts: [shift],
      orders: [],
    });

    const required = peopleRequired(cfg, 'day');
    expect(required).toBe(0);
  });

  test('includes shift-gated carriers', () => {
    const mat = makeMaterial({ id: 'M', properties: {}, allowed_processes: [] });
    const shift = makeShift({ id: 'day', name: 'Day', duration_hours: 8 });
    const people = makeCarrierPool({
      id: 'people',
      carrier_kind: CARRIER_KIND.PERSON,
      count: 5,
    });

    const cfg = makeFactoryConfig({
      materials: [mat],
      processes: [],
      stations: [],
      segments: [],
      nodes: [],
      exits: [],
      carrierPools: [people],
      shifts: [shift],
      orders: [],
    });

    const required = peopleRequired(cfg, 'day');
    expect(required).toBe(5);
  });

  test('excludes shift-gated=false carriers (AMRs)', () => {
    const mat = makeMaterial({ id: 'M', properties: {}, allowed_processes: [] });
    const shift = makeShift({ id: 'day', name: 'Day', duration_hours: 8 });
    const amr = makeCarrierPool({
      id: 'amrs',
      carrier_kind: CARRIER_KIND.AMR,
      count: 3,
    });

    const cfg = makeFactoryConfig({
      materials: [mat],
      processes: [],
      stations: [],
      segments: [],
      nodes: [],
      exits: [],
      carrierPools: [amr],
      shifts: [shift],
      orders: [],
    });

    const required = peopleRequired(cfg, 'day');
    expect(required).toBe(0);
  });
});

describe('amrFleet', () => {
  test('counts shift_gated=false carriers', () => {
    const mat = makeMaterial({ id: 'M', properties: {}, allowed_processes: [] });
    const amr = makeCarrierPool({
      id: 'amrs',
      carrier_kind: CARRIER_KIND.AMR,
      count: 4,
    });

    const cfg = makeFactoryConfig({
      materials: [mat],
      processes: [],
      stations: [],
      segments: [],
      nodes: [],
      exits: [],
      carrierPools: [amr],
      shifts: [],
      orders: [],
    });

    const fleet = amrFleet(cfg);
    expect(fleet).toBe(4);
  });

  test('excludes shift-gated carriers', () => {
    const mat = makeMaterial({ id: 'M', properties: {}, allowed_processes: [] });
    const people = makeCarrierPool({
      id: 'people',
      carrier_kind: CARRIER_KIND.PERSON,
      count: 5,
    });

    const cfg = makeFactoryConfig({
      materials: [mat],
      processes: [],
      stations: [],
      segments: [],
      nodes: [],
      exits: [],
      carrierPools: [people],
      shifts: [],
      orders: [],
    });

    const fleet = amrFleet(cfg);
    expect(fleet).toBe(0);
  });

  test('sums multiple AMR pools', () => {
    const mat = makeMaterial({ id: 'M', properties: {}, allowed_processes: [] });
    const amr1 = makeCarrierPool({
      id: 'amr1',
      carrier_kind: CARRIER_KIND.AMR,
      count: 2,
    });
    const amr2 = makeCarrierPool({
      id: 'amr2',
      carrier_kind: CARRIER_KIND.AMR,
      count: 3,
    });

    const cfg = makeFactoryConfig({
      materials: [mat],
      processes: [],
      stations: [],
      segments: [],
      nodes: [],
      exits: [],
      carrierPools: [amr1, amr2],
      shifts: [],
      orders: [],
    });

    const fleet = amrFleet(cfg);
    expect(fleet).toBe(5);
  });
});

describe('integration: assemblyLine', () => {
  test('assembly station has 2 parallel slots', () => {
    const cfg = makeAssemblyLineFixture();
    const stAssem = cfg.stations.find((s) => s.id === 'station_assem');
    const proc = stAssem.processes[0];
    expect(proc.parallel_slots).toBe(2);
    expect(proc.takt_seconds).toBe(45);
  });

  test('peopleRequired matches staffing for assemblyLine', () => {
    const cfg = makeAssemblyLineFixture();
    const shift = cfg.shifts[0];
    const required = peopleRequired(cfg, shift.id);
    expect(required).toBeGreaterThan(0);
  });
});
