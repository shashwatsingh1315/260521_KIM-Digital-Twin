import { describe, test, expect } from 'vitest';
import {
  exportConfigJSON, importConfigJSON,
  exportCoordinatesCSV, parseCoordinatesCSV, importCoordinatesCSV,
} from './configIO.js';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';

describe('configIO — full config JSON', () => {
  test('export → import round-trips to a valid config', () => {
    const config = makeLinearLineFixture();
    const json = exportConfigJSON(config);
    const { config: rebuilt, errors } = importConfigJSON(json);
    expect(errors).toEqual([]);
    expect(rebuilt).not.toBeNull();
    expect(rebuilt.stations.length).toBe(config.stations.length);
    expect(rebuilt.segments.length).toBe(config.segments.length);
  });

  test('export preserves measured coordinates through import', () => {
    const config = makeLinearLineFixture();
    const { config: rebuilt } = importConfigJSON(exportConfigJSON(config));
    expect(rebuilt.layout_overrides.n_iqc).toEqual(config.layout_overrides.n_iqc);
    expect(rebuilt.layout_overrides.n_asrs).toEqual(config.layout_overrides.n_asrs);
  });

  test('malformed JSON is reported, not thrown', () => {
    const { config, errors } = importConfigJSON('{ not json ');
    expect(config).toBeNull();
    expect(errors[0]).toMatch(/Invalid JSON/);
  });

  test('an invalid config surfaces validator errors', () => {
    const config = makeLinearLineFixture();
    const draft = JSON.parse(exportConfigJSON(config));
    draft.exits = draft.exits.filter((e) => e.kind !== 'ship'); // no ship exit
    const { config: rebuilt, errors } = importConfigJSON(JSON.stringify(draft));
    expect(rebuilt).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('configIO — coordinates CSV', () => {
  test('export has a header and one row per node', () => {
    const config = makeLinearLineFixture();
    const csv = exportCoordinatesCSV(config);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('node_id,x,y,z');
    expect(lines.length).toBe(config.nodes.length + 1);
  });

  test('parse tolerates header, blank lines and spacing', () => {
    const csv = 'node_id,x,y,z\n n_iqc , 1 , 2 , 3 \n\nn_smt,4,5,6\n';
    const { overrides, errors } = parseCoordinatesCSV(csv);
    expect(errors).toEqual([]);
    expect(overrides.n_iqc).toEqual({ x: 1, y: 2, z: 3 });
    expect(overrides.n_smt).toEqual({ x: 4, y: 5, z: 6 });
  });

  test('non-numeric coordinates are reported per-row', () => {
    const { errors } = parseCoordinatesCSV('node_id,x,y,z\nn_iqc,a,b,c');
    expect(errors.length).toBe(1);
    expect(errors[0]).toMatch(/n_iqc/);
  });

  test('import merges coordinates and re-validates', () => {
    const config = makeLinearLineFixture();
    const csv = 'node_id,x,y,z\nn_iqc,11,12,13';
    const { config: rebuilt, errors, applied } = importCoordinatesCSV(csv, config);
    expect(errors).toEqual([]);
    expect(applied).toBe(1);
    expect(rebuilt.layout_overrides.n_iqc).toEqual({ x: 11, y: 12, z: 13 });
    // Untouched nodes keep their original measured positions.
    expect(rebuilt.layout_overrides.n_asrs).toEqual(config.layout_overrides.n_asrs);
  });

  test('unknown node ids are skipped and reported', () => {
    const config = makeLinearLineFixture();
    const csv = 'node_id,x,y,z\nn_iqc,1,2,3\nn_missing,9,9,9';
    const { applied, unknown } = importCoordinatesCSV(csv, config);
    expect(applied).toBe(1);
    expect(unknown).toContain('n_missing');
  });

  test('a CSV that matches nothing yields an error and no config', () => {
    const config = makeLinearLineFixture();
    const { config: rebuilt, errors } = importCoordinatesCSV('node_id,x,y,z\nnope,1,2,3', config);
    expect(rebuilt).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});
