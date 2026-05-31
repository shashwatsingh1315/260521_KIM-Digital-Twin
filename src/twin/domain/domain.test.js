import { describe, test, expect, beforeEach } from 'vitest';
import { resetIds } from '../util/ids.js';
import { makeMaterial } from './material.js';
import { makeProcess, KIND } from './process.js';
import { makeOrder, ORDER_STATUS } from './order.js';
import { makeUnit, LOCATION_TYPE } from './unit.js';
import { makeShift } from './shift.js';
import { makeSchemaMatrix } from './schemaMatrix.js';

describe('makeMaterial', () => {
  test('builds a frozen material', () => {
    const m = makeMaterial({ id: 'STEEL', properties: { weight_kg: 5 }, allowed_processes: ['p1'] });
    expect(m.id).toBe('STEEL');
    expect(m.allowed_processes).toEqual(['p1']);
    expect(Object.isFrozen(m)).toBe(true);
  });
  test('rejects missing id', () => {
    expect(() => makeMaterial({})).toThrow(/material.id/);
  });
});

describe('makeProcess', () => {
  test('transform requires output_material', () => {
    const p = makeProcess({ id: 'heat', name: 'Heat', kind: KIND.TRANSFORM, output_material: 'TREATED' });
    expect(p.kind).toBe('transform');
    expect(p.output_material).toBe('TREATED');
  });
  test('transform rejects bom (kind-mismatched field)', () => {
    expect(() =>
      makeProcess({ id: 'heat', name: 'Heat', kind: KIND.TRANSFORM, output_material: 'X', bom: { A: 1 } }),
    ).toThrow(/must not set field "bom"/);
  });
  test('assembly requires output_material and bom', () => {
    const p = makeProcess({ id: 'asm', name: 'Assemble', kind: KIND.ASSEMBLY, output_material: 'DEV', bom: { PCB: 1, CASING: 1 } });
    expect(p.bom).toEqual({ PCB: 1, CASING: 1 });
  });
  test('assembly without bom throws', () => {
    expect(() => makeProcess({ id: 'asm', name: 'A', kind: KIND.ASSEMBLY, output_material: 'DEV' })).toThrow(/requires field "bom"/);
  });
  test('inspect requires pass_rate in 0..1', () => {
    expect(() => makeProcess({ id: 'qc', name: 'QC', kind: KIND.INSPECT, pass_rate: 1.5 })).toThrow(/pass_rate must be 0..1/);
    const p = makeProcess({ id: 'qc', name: 'QC', kind: KIND.INSPECT, pass_rate: 0.9 });
    expect(p.pass_rate).toBe(0.9);
  });
  test('hold requires dwell_seconds and slots', () => {
    const p = makeProcess({ id: 'oven', name: 'Cure', kind: KIND.HOLD, dwell_seconds: 300, slots: 3 });
    expect(p.dwell_seconds).toBe(300);
    expect(p.slots).toBe(3);
  });
  test('store requires slots, rejects dwell', () => {
    expect(() => makeProcess({ id: 's', name: 'Store', kind: KIND.STORE, slots: 5, dwell_seconds: 10 })).toThrow(/must not set field "dwell_seconds"/);
  });
  test('rejects invalid kind', () => {
    expect(() => makeProcess({ id: 'x', name: 'X', kind: 'frobnicate' })).toThrow(/kind "frobnicate" is invalid/);
  });
});

describe('makeOrder', () => {
  test('initializes runtime counters', () => {
    const o = makeOrder({ id: 'ORD1', material_type: 'STEEL', quantity: 2, process_sequence: ['heat', 'pack'] });
    expect(o.status).toBe(ORDER_STATUS.PENDING);
    expect(o.units_created).toBe(0);
    expect(o.units_completed).toBe(0);
    expect(o.scrap).toBe(0);
  });
  test('rejects non-positive quantity', () => {
    expect(() => makeOrder({ id: 'O', material_type: 'M', quantity: 0, process_sequence: ['a'] })).toThrow(/quantity/);
  });
  test('rejects empty process_sequence', () => {
    expect(() => makeOrder({ id: 'O', material_type: 'M', quantity: 1, process_sequence: [] })).toThrow(/process_sequence/);
  });
});

describe('makeUnit', () => {
  beforeEach(() => resetIds(0));
  test('starts pending with deterministic id', () => {
    const u = makeUnit({ material: 'STEEL', order_id: 'ORD1', unit_number: 1, next_process: 'heat' });
    expect(u.id).toBe('unit-1');
    expect(u.location.type).toBe(LOCATION_TYPE.PENDING);
    expect(u.next_process).toBe('heat');
    expect(u.enrichments).toEqual({});
  });
  test('rejects unit_number < 1', () => {
    expect(() => makeUnit({ material: 'M', order_id: 'O', unit_number: 0 })).toThrow(/unit_number/);
  });
});

describe('makeShift', () => {
  test('builds a frozen shift', () => {
    const s = makeShift({ id: 'day', name: 'Day', duration_hours: 7, staffing: { A: { operator: 2 } } });
    expect(s.duration_hours).toBe(7);
    expect(s.staffing.A.operator).toBe(2);
    expect(Object.isFrozen(s)).toBe(true);
  });
  test('rejects duration > 24', () => {
    expect(() => makeShift({ id: 'x', name: 'X', duration_hours: 30 })).toThrow(/duration_hours/);
  });
});

describe('makeSchemaMatrix', () => {
  test('normalizes CRUD rows', () => {
    const sm = makeSchemaMatrix({
      process_id: 'seal',
      rows: [{ system: 'MES', create: ['Seal_Number'], read: ['PCB_Number'], update: ['Status'] }],
    });
    expect(sm.rows[0].system).toBe('MES');
    expect(sm.rows[0].create).toEqual(['Seal_Number']);
    expect(sm.rows[0].delete).toEqual([]);
  });
  test('rejects unknown system', () => {
    expect(() => makeSchemaMatrix({ process_id: 'p', rows: [{ system: 'Oracle' }] })).toThrow(/must be one of/);
  });
});
