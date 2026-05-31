import { describe, test, expect } from 'vitest';
import { makeLinearLineFixture } from './linearLine.js';
import { makeAssemblyLineFixture } from './assemblyLine.js';

describe('linearLine fixture', () => {
  test('assembles with no errors', () => {
    const cfg = makeLinearLineFixture();
    expect(cfg.kind_of).toBe('factory_config');
    expect(cfg.materials).toHaveLength(1);
    expect(cfg.processes).toHaveLength(3);
    expect(cfg.stations).toHaveLength(3);
    expect(cfg.exits).toHaveLength(1);
  });
  test('has bottleneck at station B (60s takt)', () => {
    const cfg = makeLinearLineFixture();
    const stationB = cfg.stations.find((s) => s.id === 'station_b');
    expect(stationB.processes[0].takt_seconds).toBe(60);
  });
  test('order specifies 3 units through all processes', () => {
    const cfg = makeLinearLineFixture();
    const order = cfg.orders[0];
    expect(order.quantity).toBe(3);
    expect(order.process_sequence).toEqual(['heat', 'treat', 'cool']);
  });
});

describe('assemblyLine fixture', () => {
  test('assembles with no errors', () => {
    const cfg = makeAssemblyLineFixture();
    expect(cfg.kind_of).toBe('factory_config');
    expect(cfg.materials).toHaveLength(3);
    expect(cfg.processes).toHaveLength(2);
    expect(cfg.stations).toHaveLength(2);
    expect(cfg.exits).toHaveLength(2);
  });
  test('has ship and scrap exits', () => {
    const cfg = makeAssemblyLineFixture();
    const shipExit = cfg.exits.find((e) => e.id === 'ship');
    const scrapExit = cfg.exits.find((e) => e.id === 'scrap');
    expect(shipExit.kind).toBe('ship');
    expect(scrapExit.kind).toBe('scrap');
  });
  test('assembly process has bom', () => {
    const cfg = makeAssemblyLineFixture();
    const assemblyProc = cfg.processes.find((p) => p.id === 'assemble');
    expect(assemblyProc.bom).toEqual({ PCB: 1, CASING: 1 });
  });
  test('inspect has 90% pass rate', () => {
    const cfg = makeAssemblyLineFixture();
    const inspectProc = cfg.processes.find((p) => p.id === 'inspect');
    expect(inspectProc.pass_rate).toBe(0.9);
  });
  test('order is for 10 DEVICE units', () => {
    const cfg = makeAssemblyLineFixture();
    const order = cfg.orders[0];
    expect(order.material_type).toBe('DEVICE');
    expect(order.quantity).toBe(10);
    expect(order.process_sequence).toEqual(['assemble', 'inspect']);
  });
});
