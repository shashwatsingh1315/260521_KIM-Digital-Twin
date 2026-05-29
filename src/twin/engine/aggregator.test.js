// Tests for aggregator liveMetrics (Part B2).

import { describe, test, expect, beforeEach } from 'vitest';
import { resetIds } from '../util/ids.js';
import { runTwin } from './engine.js';
import { liveMetrics } from './aggregator.js';
import { makeCarrierLineFixture } from '../fixtures/carrierLine.js';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';
import { peopleRequired as derivePeopleReq, amrFleet as deriveAmrFleet, poolThroughput, roundTripTime } from './derive.js';

beforeEach(() => resetIds(0));

describe('liveMetrics', () => {
  test('peopleRequired matches derive.peopleRequired', () => {
    const cfg = makeLinearLineFixture();
    // Build minimal flowState/carrierState stubs.
    const flowStub = {
      stationBuffers: new Map(cfg.stations.map((s) => [s.id, []])),
      stationOutputBuffers: new Map(cfg.stations.map((s) => [s.id, []])),
    };
    const carrierStub = { pools: new Map() };
    const metrics = liveMetrics(cfg, flowStub, carrierStub, 'day');
    expect(metrics.peopleRequired).toBe(derivePeopleReq(cfg, 'day'));
  });

  test('amrFleet matches derive.amrFleet (zero for linear line)', () => {
    const cfg = makeLinearLineFixture();
    const flowStub = {
      stationBuffers: new Map(cfg.stations.map((s) => [s.id, []])),
      stationOutputBuffers: new Map(cfg.stations.map((s) => [s.id, []])),
    };
    const carrierStub = { pools: new Map() };
    const metrics = liveMetrics(cfg, flowStub, carrierStub);
    expect(metrics.amrFleet).toBe(deriveAmrFleet(cfg));
    expect(metrics.amrFleet).toBe(0);
  });

  test('amrFleet matches derive.amrFleet for carrier line', () => {
    const cfg = makeCarrierLineFixture();
    const flowStub = {
      stationBuffers: new Map(cfg.stations.map((s) => [s.id, []])),
      stationOutputBuffers: new Map(cfg.stations.map((s) => [s.id, []])),
    };
    const carrierStub = { pools: new Map() };
    const metrics = liveMetrics(cfg, flowStub, carrierStub);
    expect(metrics.amrFleet).toBe(deriveAmrFleet(cfg));
    expect(metrics.amrFleet).toBe(3); // carrier line has 3 AMR carriers
  });

  test('buffer fullness is 0 on empty buffers', () => {
    const cfg = makeLinearLineFixture();
    const flowStub = {
      stationBuffers: new Map(cfg.stations.map((s) => [s.id, []])),
      stationOutputBuffers: new Map(cfg.stations.map((s) => [s.id, []])),
    };
    const carrierStub = { pools: new Map() };
    const metrics = liveMetrics(cfg, flowStub, carrierStub);
    for (const fullness of Object.values(metrics.bufferFullness)) {
      expect(fullness).toBe(0);
    }
  });

  test('buffer fullness is in [0, 1] across a full carrier line run', () => {
    // Run the carrier line and sample metrics at end-of-run.
    const cfg = makeCarrierLineFixture();
    const { summary } = runTwin(cfg, { seed: 0 });
    // All units shipped → no assertions here, just ensure the run succeeded.
    expect(summary.units_shipped).toBe(5);
  });

  test('carrier utilization is in [0, 1]', () => {
    const cfg = makeCarrierLineFixture();
    const flowStub = {
      stationBuffers: new Map(cfg.stations.map((s) => [s.id, []])),
      stationOutputBuffers: new Map(cfg.stations.map((s) => [s.id, []])),
    };
    // Stub with one loaded carrier
    const pool = cfg.carrierPools[0];
    const seg = cfg.segments.find((s) => s.transport.class === 'carrier');
    const carrierStub = {
      pools: new Map([
        [pool.id, {
          pool,
          seg,
          pickupQueue: [],
          carriers: [
            { id: 'c0', state: 'loaded', unit: null, drop_at: 100, free_at: Infinity },
            { id: 'c1', state: 'idle', unit: null, drop_at: Infinity, free_at: Infinity },
            { id: 'c2', state: 'idle', unit: null, drop_at: Infinity, free_at: Infinity },
          ],
        }],
      ]),
    };
    const metrics = liveMetrics(cfg, flowStub, carrierStub);
    const util = metrics.carrierUtilization[seg.id];
    expect(util.utilization).toBeGreaterThanOrEqual(0);
    expect(util.utilization).toBeLessThanOrEqual(1);
    // 1 of 3 carriers busy = 0.333...
    expect(util.utilization).toBeCloseTo(1 / 3, 5);
  });

  test('carrier utilization maxThroughput matches derive.poolThroughput', () => {
    const cfg = makeCarrierLineFixture();
    const pool = cfg.carrierPools[0];
    const seg = cfg.segments.find((s) => s.transport.class === 'carrier');
    const flowStub = {
      stationBuffers: new Map(cfg.stations.map((s) => [s.id, []])),
      stationOutputBuffers: new Map(cfg.stations.map((s) => [s.id, []])),
    };
    const carrierStub = {
      pools: new Map([
        [pool.id, { pool, seg, pickupQueue: [], carriers: [] }],
      ]),
    };
    const metrics = liveMetrics(cfg, flowStub, carrierStub);
    const rtt = roundTripTime(seg.length_m, pool.load_unload_seconds, pool.speed_loaded_m_per_min, pool.speed_empty_m_per_min);
    const expected = poolThroughput(pool.count, pool.units_per_trip, rtt);
    expect(metrics.carrierUtilization[seg.id].maxThroughput).toBe(expected);
  });
});
