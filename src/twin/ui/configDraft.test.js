import { describe, test, expect } from 'vitest';
import { toDraft, buildConfig, buildAndValidate } from './configDraft.js';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';
import { makeAssemblyLineFixture } from '../fixtures/assemblyLine.js';
import { makeCarrierLineFixture } from '../fixtures/carrierLine.js';

const FIXTURES = {
  linearLine: makeLinearLineFixture,
  assemblyLine: makeAssemblyLineFixture,
  carrierLine: makeCarrierLineFixture,
};

describe('configDraft — round trip', () => {
  for (const [name, make] of Object.entries(FIXTURES)) {
    test(`${name}: toDraft → buildConfig validates clean`, () => {
      const config = make();
      const draft = toDraft(config);
      const { config: rebuilt, errors } = buildAndValidate(draft);
      expect(errors).toEqual([]);
      expect(rebuilt).not.toBeNull();
    });

    test(`${name}: rebuilt config preserves entity counts`, () => {
      const config = make();
      const rebuilt = buildConfig(toDraft(config));
      expect(rebuilt.materials.length).toBe(config.materials.length);
      expect(rebuilt.processes.length).toBe(config.processes.length);
      expect(rebuilt.stations.length).toBe(config.stations.length);
      expect(rebuilt.segments.length).toBe(config.segments.length);
      expect(rebuilt.nodes.length).toBe(config.nodes.length);
      expect(rebuilt.exits.length).toBe(config.exits.length);
      expect(rebuilt.orders.length).toBe(config.orders.length);
      expect(rebuilt.carrierPools.length).toBe(config.carrierPools.length);
    });
  }
});

describe('configDraft — edits', () => {
  test('changing an order quantity rebuilds with the new value', () => {
    const draft = toDraft(makeLinearLineFixture());
    draft.orders[0].quantity = 9;
    const rebuilt = buildConfig(draft);
    expect(rebuilt.orders[0].quantity).toBe(9);
  });

  test('changing a station takt rebuilds with the new value', () => {
    const draft = toDraft(makeLinearLineFixture());
    draft.stations[0].processes[0].takt_seconds = 45;
    const rebuilt = buildConfig(draft);
    expect(rebuilt.stations[0].processes[0].takt_seconds).toBe(45);
  });

  test('invalid edit (zero segment length) surfaces an error, no throw', () => {
    const draft = toDraft(makeLinearLineFixture());
    draft.segments[0].length_m = 0;
    const { errors, config } = buildAndValidate(draft);
    expect(errors.length).toBeGreaterThan(0);
    expect(config).toBeNull();
  });

  test('removing the ship exit is rejected by the validator', () => {
    const draft = toDraft(makeLinearLineFixture());
    draft.exits = draft.exits.filter((e) => e.kind !== 'ship');
    const { errors } = buildAndValidate(draft);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('adding a new order routes through existing processes cleanly', () => {
    const draft = toDraft(makeLinearLineFixture());
    const seq = draft.orders[0].process_sequence;
    draft.orders.push({ id: 'order_2', material_type: draft.orders[0].material_type, quantity: 2, process_sequence: [...seq], arrival_time: 0 });
    const { errors } = buildAndValidate(draft);
    expect(errors).toEqual([]);
  });
});
