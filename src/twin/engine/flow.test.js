import { describe, test, expect, beforeEach } from 'vitest';
import { resetIds } from '../util/ids.js';
import { makeFlowState, launchOnSegment, nextArrivalTime, applyArrivals } from './flow.js';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';
import { makeUnit } from '../domain/unit.js';

beforeEach(() => resetIds(0));

describe('flow', () => {
  test('travel time = length_m / (speed/60)', () => {
    const cfg = makeLinearLineFixture();
    const flow = makeFlowState(cfg);
    const seg = cfg.segments.find((s) => s.id === 's_in_a'); // 10m @ 60m/min = 10s
    const unit = makeUnit({ material: 'BLANK', order_id: 'O', unit_number: 1, next_process: 'heat' });
    const arr = launchOnSegment(flow, seg, unit, 0);
    expect(arr).toBe(10); // 10m / 1m/s = 10s
    expect(nextArrivalTime(flow)).toBe(10);
  });

  test('applyArrivals routes to station buffer', () => {
    const cfg = makeLinearLineFixture();
    const flow = makeFlowState(cfg);
    const seg = cfg.segments.find((s) => s.id === 's_in_a');
    const unit = makeUnit({ material: 'BLANK', order_id: 'O', unit_number: 1, next_process: 'heat' });
    launchOnSegment(flow, seg, unit, 0);
    const arrivals = applyArrivals(flow, cfg, 10);
    expect(arrivals).toHaveLength(1);
    expect(arrivals[0].stationId).toBe('station_a');
    expect(flow.stationBuffers.get('station_a')).toHaveLength(1);
  });

  test('applyArrivals routes to exit node', () => {
    const cfg = makeLinearLineFixture();
    const flow = makeFlowState(cfg);
    const seg = cfg.segments.find((s) => s.id === 's_c_ship'); // to_node_id = 'ship'
    const unit = makeUnit({ material: 'BLANK', order_id: 'O', unit_number: 1 });
    launchOnSegment(flow, seg, unit, 0);
    const arrivals = applyArrivals(flow, cfg, 10);
    expect(arrivals).toHaveLength(0); // no station arrival
    expect(flow.exitedUnits).toHaveLength(1);
    expect(flow.exitedUnits[0].exit_id).toBe('ship');
  });

  test('FIFO order preserved across concurrent arrivals', () => {
    const cfg = makeLinearLineFixture();
    const flow = makeFlowState(cfg);
    const seg = cfg.segments.find((s) => s.id === 's_in_a');
    const u1 = makeUnit({ material: 'BLANK', order_id: 'O', unit_number: 1, next_process: 'heat' });
    const u2 = makeUnit({ material: 'BLANK', order_id: 'O', unit_number: 2, next_process: 'heat' });
    launchOnSegment(flow, seg, u1, 0);
    launchOnSegment(flow, seg, u2, 0);
    applyArrivals(flow, cfg, 10);
    const buf = flow.stationBuffers.get('station_a');
    expect(buf[0].unit_number).toBe(1);
    expect(buf[1].unit_number).toBe(2);
  });
});
