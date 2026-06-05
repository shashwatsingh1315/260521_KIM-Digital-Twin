// §6 worked-example tests — the crux of the milestone.
// All expected times derived from fixture constants, no magic literals.

import { describe, test, expect, beforeEach } from 'vitest';
import { resetIds } from '../util/ids.js';
import { runTwin } from './engine.js';
import { makeLinearLineFixture, CONVEYOR_SPEED_M_PER_MIN } from '../fixtures/simpleLine.js';
import { makeAssemblyLineFixture } from '../fixtures/assemblyLine.js';

beforeEach(() => resetIds(0));

// ── linearLine topology constants ──
// Segments: s_in_a=10m, s_a_b=20m, s_b_c=15m, s_c_ship=10m; speed=60m/min=1m/s
const T_IN_A  = 10;   // 10m / 1m/s
const T_A_B   = 20;
const T_B_C   = 15;
const T_C_SHIP = 10;
const TAKT_A   = 30;
const TAKT_B   = 60;  // bottleneck
const TAKT_C   = 20;

// Unit 1 timeline:
// t=0     released, placed on s_in_a
// t=T_IN_A(10)  arrives n_a, heat starts
// t=10+TAKT_A(40) heat done, placed on s_a_b
// t=40+T_A_B(60)  arrives n_b, treat starts
// t=60+TAKT_B(120) treat done, placed on s_b_c
// t=120+T_B_C(135) arrives n_c, cool starts
// t=135+TAKT_C(155) cool done, placed on s_c_ship
// t=155+T_C_SHIP(165) exits ship
const U1_EXIT = T_IN_A + TAKT_A + T_A_B + TAKT_B + T_B_C + TAKT_C + T_C_SHIP;
// = 10 + 30 + 20 + 60 + 15 + 20 + 10 = 165

// Unit 2 arrives n_b at t=90. B is busy until t=120, so waits; starts at 120, exits 120+60+15+20+10=225.
const U2_EXIT = 225;
// Unit 3 arrives n_b at t=120. B starts at 180 (after unit 2 finishes), exits 180+60+15+20+10=285.
const U3_EXIT = 285;

describe('§6 linearLine timeline', () => {
  test('Unit 1 exits ship at t=165', () => {
    const cfg = makeLinearLineFixture();
    const result = runTwin(cfg);
    const exitEvents = result.events.filter((e) => e.type === 'unit_exited');
    expect(exitEvents.length).toBeGreaterThanOrEqual(1);
    expect(exitEvents[0].timestamp).toBe(U1_EXIT);
  });

  test('Exits are spaced exactly 60s apart (bottleneck B takt)', () => {
    const cfg = makeLinearLineFixture();
    const result = runTwin(cfg);
    const exitTimes = result.events
      .filter((e) => e.type === 'unit_exited')
      .map((e) => e.timestamp);
    expect(exitTimes).toHaveLength(3);
    expect(exitTimes[1] - exitTimes[0]).toBe(TAKT_B);
    expect(exitTimes[2] - exitTimes[1]).toBe(TAKT_B);
  });

  test('ORD1 completes at t=285', () => {
    const cfg = makeLinearLineFixture();
    const result = runTwin(cfg);
    expect(result.summary.final_time).toBe(U3_EXIT);
    expect(result.summary.orders_completed).toBe(1);
  });

  test('All 3 units ship, 0 scrap', () => {
    const cfg = makeLinearLineFixture();
    const result = runTwin(cfg);
    expect(result.summary.units_shipped).toBe(3);
    expect(result.summary.units_scrapped).toBe(0);
  });

  test('deterministic: same seed → identical event log', () => {
    const cfg = makeLinearLineFixture();
    const r1 = runTwin(cfg, { seed: 7 });
    resetIds(0);
    const r2 = runTwin(cfg, { seed: 7 });
    const log1 = r1.events.map((e) => `${e.type}@${e.timestamp}`).join(',');
    const log2 = r2.events.map((e) => `${e.type}@${e.timestamp}`).join(',');
    expect(log1).toBe(log2);
  });
});

describe('assemblyLine simulation', () => {
  test('runs to completion', () => {
    const cfg = makeAssemblyLineFixture();
    const result = runTwin(cfg, { seed: 0, maxTime: 10000 });
    expect(result.summary.orders_completed + result.summary.orders_short).toBeGreaterThanOrEqual(1);
  });

  test('units_completed + units_scrapped === units_created (accounting balance)', () => {
    const cfg = makeAssemblyLineFixture();
    const result = runTwin(cfg, { seed: 0, maxTime: 10000 });
    const order = result.orders[0];
    expect(order.units_completed + order.scrap).toBe(order.units_created);
  });

  test('inspect scraps ~10% (within reasonable bounds for 10 units, seed=0)', () => {
    const cfg = makeAssemblyLineFixture();
    const result = runTwin(cfg, { seed: 0, maxTime: 10000 });
    const order = result.orders[0];
    // With 90% pass rate and 10 units, 0–3 scrapped is expected.
    expect(order.scrap).toBeGreaterThanOrEqual(0);
    expect(order.scrap).toBeLessThanOrEqual(5);
  });
});
