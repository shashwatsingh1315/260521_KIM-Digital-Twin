import { describe, test, expect, beforeEach } from 'vitest';
import { resetIds } from '../util/ids.js';
import { tryAdmit, derivedWipCap } from './releaseGovernor.js';
import { makeLinearLineFixture } from '../fixtures/simpleLine.js';
import { makeOrder } from '../domain/order.js';

beforeEach(() => resetIds(0));

describe('releaseGovernor', () => {
  test('admits a unit when WIP below cap', () => {
    const cfg = makeLinearLineFixture();
    const orders = cfg.orders.map((o) => ({ ...o, units_created: 0, units_completed: 0, scrap: 0, status: 'pending' }));
    const gov = { wipCount: 0 };
    const unit = tryAdmit(gov, cfg, orders, 0);
    expect(unit).not.toBeNull();
    expect(unit.material).toBe('BLANK');
    expect(gov.wipCount).toBe(1);
    expect(orders[0].units_created).toBe(1);
    expect(orders[0].status).toBe('in_progress');
  });

  test('blocks when WIP at cap', () => {
    const cfg = makeLinearLineFixture();
    const orders = cfg.orders.map((o) => ({ ...o, units_created: 0, units_completed: 0, scrap: 0, status: 'pending' }));
    const cap = derivedWipCap(cfg);
    const gov = { wipCount: cap };
    const unit = tryAdmit(gov, cfg, orders, 0);
    expect(unit).toBeNull();
  });

  test('returns null when order fully created', () => {
    const cfg = makeLinearLineFixture();
    const orders = cfg.orders.map((o) => ({ ...o, units_created: o.quantity, units_completed: 0, scrap: 0, status: 'in_progress' }));
    const gov = { wipCount: 0 };
    const unit = tryAdmit(gov, cfg, orders, 0);
    expect(unit).toBeNull();
  });

  test('derivedWipCap = bottleneck.parallel_slots + entry_buffer_capacity', () => {
    const cfg = makeLinearLineFixture();
    const cap = derivedWipCap(cfg);
    // Bottleneck is station_b (treat, 60s), parallel_slots=1, entry_buffer_capacity=10
    expect(cap).toBe(1 + 10);
  });

  test('respects arrival_time', () => {
    const cfg = makeLinearLineFixture();
    const orders = [{ ...cfg.orders[0], units_created: 0, units_completed: 0, scrap: 0, status: 'pending', arrival_time: 100 }];
    const gov = { wipCount: 0 };
    const unit = tryAdmit(gov, cfg, orders, 0);
    expect(unit).toBeNull();
    const unit2 = tryAdmit(gov, cfg, orders, 100);
    expect(unit2).not.toBeNull();
  });
});
