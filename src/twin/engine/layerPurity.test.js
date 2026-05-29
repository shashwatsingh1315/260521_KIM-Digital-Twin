// Guard: engine files must not import react, ui, or DOM APIs.
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const TWIN_ENGINE = resolve('src/twin/engine');

function engineFiles() {
  return readdirSync(TWIN_ENGINE)
    .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'))
    .map((f) => join(TWIN_ENGINE, f));
}

describe('layer purity', () => {
  test('no engine file imports react or ui', () => {
    const violations = [];
    for (const file of engineFiles()) {
      const src = readFileSync(file, 'utf8');
      if (/from ['"]react['"]/.test(src) || /from ['"].*\/ui\//.test(src)) {
        violations.push(file);
      }
    }
    expect(violations).toHaveLength(0);
  });

  test('no engine file imports DOM (window/document/navigator)', () => {
    const violations = [];
    for (const file of engineFiles()) {
      const src = readFileSync(file, 'utf8');
      if (/\bwindow\b|\bdocument\b|\bnavigator\b/.test(src)) {
        violations.push(file);
      }
    }
    expect(violations).toHaveLength(0);
  });

  test('derive.js is the only file with 3600 division', () => {
    const TWIN_ROOT = resolve('src/twin');
    function allJsFiles(dir) {
      const results = [];
      for (const f of readdirSync(dir, { withFileTypes: true })) {
        if (f.isDirectory()) results.push(...allJsFiles(join(dir, f.name)));
        else if (f.name.endsWith('.js') && !f.name.endsWith('.test.js')) results.push(join(dir, f.name));
      }
      return results;
    }
    const violations = [];
    for (const file of allJsFiles(TWIN_ROOT)) {
      if (file.endsWith('derive.js')) continue;
      const src = readFileSync(file, 'utf8');
      if (/3600\s*\//.test(src)) violations.push(file);
    }
    expect(violations).toHaveLength(0);
  });
});
