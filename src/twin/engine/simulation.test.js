// End-to-end simulation smoke tests.

import { describe, test, expect, beforeEach } from 'vitest';
import { resetIds } from '../util/ids.js';
import { runTwin } from './engine.js';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';
import { makeAssemblyLineFixture } from '../fixtures/assemblyLine.js';

beforeEach(() => resetIds(0));

describe('M800 linearLine simulation', () => {
  test('ships finished units instead of stalling at the supplier junction', () => {
    const cfg = makeLinearLineFixture();
    const result = runTwin(cfg, { seed: 0, maxTime: 3600 });

    expect(result.summary.units_shipped).toBeGreaterThan(0);
    expect(result.events.some((e) => e.type === 'unit_exited')).toBe(true);
  });

  test('admits multiple material streams needed by 1P assembly', () => {
    const cfg = makeLinearLineFixture();
    const result = runTwin(cfg, { seed: 0, maxTime: 1200 });

    const createdByOrder = new Map(result.orders.map((o) => [o.id, o.units_created]));
    expect(createdByOrder.get('ORD-M800-MAIN')).toBeGreaterThan(0);
    expect(createdByOrder.get('ORD-TRSS-PARTS')).toBeGreaterThan(0);
    expect(createdByOrder.get('ORD-PLASTIC-BOP')).toBeGreaterThan(0);
    expect(createdByOrder.get('ORD-NIC-SIM-PARTS')).toBeGreaterThan(0);
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
