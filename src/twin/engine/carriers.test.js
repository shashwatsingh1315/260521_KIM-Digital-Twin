// Tests for carrier round-trip physics (Part A2).

import { describe, test, expect, beforeEach } from 'vitest';
import { resetIds } from '../util/ids.js';
import { runTwin } from './engine.js';
import { makeCarrierLineFixture, makeCarrierLineBottleneck } from '../fixtures/carrierLine.js';
import { roundTripTime, poolThroughput } from './derive.js';

beforeEach(() => resetIds(0));

describe('carrier fixture validation', () => {
  test('carrier line passes validator with zero errors', async () => {
    const { validateFactoryConfig } = await import('./validator.js');
    const cfg = makeCarrierLineFixture();
    const { errors } = validateFactoryConfig(cfg);
    expect(errors).toHaveLength(0);
  });
});

describe('carrier round-trip physics', () => {
  test('normal carrier line: all units shipped', () => {
    const cfg = makeCarrierLineFixture();
    const { summary } = runTwin(cfg, { seed: 0 });
    expect(summary.units_shipped).toBe(5);
    expect(summary.units_scrapped).toBe(0);
  });

  test('carrier round-trip time matches derive formula', () => {
    // AMR pool: length=20m, load_unload=30s, loaded_speed=60m/min, empty_speed=120m/min
    // RTT = 15 (load) + 20/60*60 (loaded traverse) + 15 (unload) + 20/120*60 (return) = 15+20+15+10 = 60s
    const rtt = roundTripTime(20, 30, 60, 120);
    expect(rtt).toBe(60);
  });

  test('3-carrier pool throughput matches derive formula', () => {
    // poolThroughput = 3 * 1 * 3600/60 = 180 units/hr (AMR availability=1)
    const rtt = roundTripTime(20, 30, 60, 120);
    const tp = poolThroughput(3, 1, rtt, 1);
    expect(tp).toBe(180);
  });

  test('carrier delivers units to station B input buffer', () => {
    const cfg = makeCarrierLineFixture();
    const { events } = runTwin(cfg, { seed: 0 });
    // Station B must see start events — meaning units arrived via carrier.
    const stationBStarts = events.filter(
      (e) => e.type === 'station_started' && e.station_id === 'station_b',
    );
    expect(stationBStarts.length).toBeGreaterThan(0);
  });

  test('first unit drop time = load_seconds + traverse_loaded_seconds after pickup', () => {
    // First unit: prep takes 30s, then carrier picks up at t=30+10(intake travel)=40s
    // Actually: intake travel=10s, arrives at station_a at t=10; prep starts t=10, completes t=40
    // Carrier picks up at t=40: load_sec=15, traverse_sec=20m/60m/min*60=20s → drop at t=40+15+20=75
    // Then unload_sec=15, return=20m/120m/min*60=10s → free at t=75+15+10=100
    const cfg = makeCarrierLineFixture();
    const { events } = runTwin(cfg, { seed: 0 });
    const stationBStart = events.filter((e) => e.type === 'station_started' && e.station_id === 'station_b')[0];
    // Station B starts at the carrier drop time (t=75)
    expect(stationBStart.timestamp).toBe(75);
  });

  test('bottleneck variant: 1 carrier — all units still complete (slower)', () => {
    const cfg = makeCarrierLineBottleneck();
    const { summary } = runTwin(cfg, { seed: 0 });
    expect(summary.units_shipped).toBe(5);
    expect(summary.units_scrapped).toBe(0);
  });

  test('bottleneck variant: completes slower than 3-carrier version', () => {
    const cfgNormal = makeCarrierLineFixture();
    const cfgBottleneck = makeCarrierLineBottleneck();
    const { summary: s1 } = runTwin(cfgNormal, { seed: 0 });
    const { summary: s2 } = runTwin(cfgBottleneck, { seed: 0 });
    expect(s2.final_time).toBeGreaterThan(s1.final_time);
  });

  test('AMR carrier is not shift-gated (works 24/7)', () => {
    const cfg = makeCarrierLineFixture();
    const pool = cfg.carrierPools[0];
    expect(pool.shift_gated).toBe(false);
    expect(pool.carrier_kind).toBe('amr');
  });
});
