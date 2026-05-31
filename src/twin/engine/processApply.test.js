import { describe, test, expect, beforeEach } from 'vitest';
import { resetIds } from '../util/ids.js';
import { makeRng } from '../util/rng.js';
import { applyProcess, checkAssemblyKit, assembleUnit } from './processApply.js';
import { makeProcess, KIND } from '../domain/process.js';
import { makeOrder } from '../domain/order.js';
import { makeUnit } from '../domain/unit.js';

beforeEach(() => resetIds(0));

const rngAlwaysPass = () => 0.01;
const rngAlwaysFail = () => 0.99;

function makeTestUnit(material = 'BLANK', orderId = 'ORD1') {
  return makeUnit({ material, order_id: orderId, unit_number: 1, next_process: null });
}

describe('applyProcess: transform', () => {
  test('reassigns material and advances', () => {
    const proc = makeProcess({ id: 'heat', name: 'Heat', kind: KIND.TRANSFORM, output_material: 'TREATED' });
    const unit = makeTestUnit('BLANK');
    const order = makeOrder({ id: 'ORD1', material_type: 'BLANK', quantity: 1, process_sequence: ['heat'] });
    const result = applyProcess({ unit, process: proc, order, allOrders: [order], rng: rngAlwaysPass });
    expect(result.keep.material).toBe('TREATED');
    expect(result.scrap).toBe(false);
    expect(result.newUnit).toBeNull();
  });

  test('merges adds_enrichments', () => {
    const proc = makeProcess({ id: 'label', name: 'Label', kind: KIND.LABEL, adds_enrichments: ['serial'] });
    const unit = makeTestUnit();
    const order = makeOrder({ id: 'ORD1', material_type: 'BLANK', quantity: 1, process_sequence: ['label'] });
    const result = applyProcess({ unit, process: proc, order, allOrders: [order], rng: rngAlwaysPass });
    expect(result.keep.enrichments.serial).toBe(true);
  });
});

describe('applyProcess: inspect', () => {
  test('pass → keep unit, no scrap', () => {
    const proc = makeProcess({ id: 'qc', name: 'QC', kind: KIND.INSPECT, pass_rate: 0.9 });
    const unit = makeTestUnit();
    const order = makeOrder({ id: 'ORD1', material_type: 'BLANK', quantity: 1, process_sequence: ['qc'] });
    const result = applyProcess({ unit, process: proc, order, allOrders: [order], rng: rngAlwaysPass });
    expect(result.keep).not.toBeNull();
    expect(result.scrap).toBe(false);
  });

  test('fail → scrap, no kept unit', () => {
    const proc = makeProcess({ id: 'qc', name: 'QC', kind: KIND.INSPECT, pass_rate: 0.9 });
    const unit = makeTestUnit();
    const order = makeOrder({ id: 'ORD1', material_type: 'BLANK', quantity: 1, process_sequence: ['qc'] });
    const result = applyProcess({ unit, process: proc, order, allOrders: [order], rng: rngAlwaysFail });
    expect(result.keep).toBeNull();
    expect(result.scrap).toBe(true);
  });

  test('deterministic per seed', () => {
    const proc = makeProcess({ id: 'qc', name: 'QC', kind: KIND.INSPECT, pass_rate: 0.5 });
    const order = makeOrder({ id: 'O', material_type: 'M', quantity: 10, process_sequence: ['qc'] });
    const rng1 = makeRng(42);
    const rng2 = makeRng(42);
    const results1 = Array.from({ length: 5 }, () => {
      const unit = makeTestUnit();
      return applyProcess({ unit, process: proc, order, allOrders: [order], rng: rng1 }).scrap;
    });
    const results2 = Array.from({ length: 5 }, () => {
      const unit = makeTestUnit();
      return applyProcess({ unit, process: proc, order, allOrders: [order], rng: rng2 }).scrap;
    });
    expect(results1).toEqual(results2);
  });
});

describe('checkAssemblyKit', () => {
  test('complete kit returns true and matched units', () => {
    const pcb = makeTestUnit('PCB', 'COMP');
    const casing = makeTestUnit('CASING', 'COMP');
    const bom = { PCB: 1, CASING: 1 };
    const { complete, kitUnits } = checkAssemblyKit([pcb, casing], bom);
    expect(complete).toBe(true);
    expect(kitUnits).toHaveLength(2);
  });

  test('incomplete kit returns false', () => {
    const pcb = makeTestUnit('PCB', 'COMP');
    const bom = { PCB: 1, CASING: 1 };
    const { complete } = checkAssemblyKit([pcb], bom);
    expect(complete).toBe(false);
  });

  test('matches by material type, ignores order', () => {
    const pcb1 = makeTestUnit('PCB', 'O1');
    const pcb2 = makeTestUnit('PCB', 'O2');
    const { complete, kitUnits } = checkAssemblyKit([pcb1, pcb2], { PCB: 2 });
    expect(complete).toBe(true);
    expect(kitUnits).toHaveLength(2);
  });
});

describe('assembleUnit', () => {
  test('produces a new DEVICE unit', () => {
    const proc = makeProcess({ id: 'asm', name: 'A', kind: KIND.ASSEMBLY, output_material: 'DEVICE', bom: { PCB: 1, CASING: 1 } });
    const pcb = makeTestUnit('PCB');
    const casing = makeTestUnit('CASING');
    const productOrder = makeOrder({ id: 'ORD1', material_type: 'DEVICE', quantity: 5, process_sequence: ['asm'] });
    const newUnit = assembleUnit({ process: proc, kitUnits: [pcb, casing], productOrder, now: 100 });
    expect(newUnit.material).toBe('DEVICE');
    expect(newUnit.order_id).toBe('ORD1');
    expect(newUnit.lifecycle.created_at).toBe(100);
  });
});
