// configIO.js — bulk import/export of a FactoryConfig.
//
// Two interchange formats, both pure (no DOM): the UI layer wires these to file
// download / upload.
//
//   • Full config as JSON — the complete factory specification, including
//     measured node coordinates (layout_overrides). Round-trips through the
//     draft factories + validator so an imported file is normalised and
//     guaranteed valid before it replaces the live config.
//
//   • Node coordinates as CSV — `node_id,x,y,z` in metres. This is the bridge
//     to an engineering drawing: export the current layout, edit coordinates in
//     a spreadsheet against the real floor plan, re-import to place every
//     machine exactly. Only listed nodes are moved; everything else is kept.

import { toDraft, buildConfig, buildAndValidate } from './configDraft.js';

// ── Full config (JSON) ──────────────────────────────────────────────────────

/**
 * Serialise a FactoryConfig to pretty JSON (includes layout_overrides).
 * Emits the live config shape — the same shape the persistence layer stores —
 * so re-import goes through the identical toDraft → buildConfig path.
 * @param {object} config FactoryConfig
 * @returns {string}
 */
export function exportConfigJSON(config) {
  return JSON.stringify(config, null, 2);
}

/**
 * Parse + validate a config JSON string into a FactoryConfig.
 * Accepts either a draft-shaped object or a live config (both round-trip through
 * toDraft → buildConfig). Never throws.
 * @param {string} text
 * @returns {{ config: object|null, errors: string[], warnings: string[] }}
 */
export function importConfigJSON(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { config: null, errors: [`Invalid JSON: ${err.message}`], warnings: [] };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { config: null, errors: ['Config JSON must be an object'], warnings: [] };
  }
  // Normalise any live-config shape into an editable draft, then build+validate.
  const draft = toDraft(parsed);
  return buildAndValidate(draft);
}

// ── Node coordinates (CSV) ───────────────────────────────────────────────────

const COORD_HEADER = 'node_id,x,y,z';

/**
 * Export measured node coordinates as CSV. Every node is listed; nodes without
 * an explicit override export as their stored coordinate or 0.
 * @param {object} config FactoryConfig
 * @returns {string}
 */
export function exportCoordinatesCSV(config) {
  const ov = config.layout_overrides ?? {};
  const lines = [COORD_HEADER];
  for (const node of config.nodes ?? []) {
    const p = ov[node.id] ?? {};
    lines.push([node.id, p.x ?? 0, p.y ?? 0, p.z ?? 0].join(','));
  }
  return lines.join('\n');
}

/**
 * Parse a coordinates CSV. Returns the override map plus any row-level problems.
 * Tolerant of a header row, blank lines, extra columns, and surrounding spaces.
 * @param {string} text
 * @returns {{ overrides: object, errors: string[] }}
 */
export function parseCoordinatesCSV(text) {
  const overrides = {};
  const errors = [];
  const rows = String(text).split(/\r?\n/).map((r) => r.trim()).filter(Boolean);

  rows.forEach((row, i) => {
    const cols = row.split(',').map((c) => c.trim());
    // Skip a header row (first row whose coordinates are non-numeric labels).
    if (i === 0 && cols[0].toLowerCase() === 'node_id') return;

    const [id, xs, ys, zs] = cols;
    if (!id) { errors.push(`Row ${i + 1}: missing node_id`); return; }
    const x = Number(xs);
    const y = Number(ys);
    const z = Number(zs);
    if (![x, y, z].every(Number.isFinite)) {
      errors.push(`Row ${i + 1} ("${id}"): x, y, z must all be numbers`);
      return;
    }
    overrides[id] = { x, y, z };
  });

  return { overrides, errors };
}

/**
 * Apply a coordinates CSV onto an existing config, merging over current
 * coordinates and re-validating. Unknown node ids are reported (and ignored).
 * @param {string} text  CSV body
 * @param {object} config  current FactoryConfig
 * @returns {{ config: object|null, errors: string[], warnings: string[], applied: number, unknown: string[] }}
 */
export function importCoordinatesCSV(text, config) {
  const { overrides, errors: parseErrors } = parseCoordinatesCSV(text);
  const known = new Set((config.nodes ?? []).map((n) => n.id));

  const unknown = Object.keys(overrides).filter((id) => !known.has(id));
  const merged = { ...(config.layout_overrides ?? {}) };
  let applied = 0;
  for (const [id, p] of Object.entries(overrides)) {
    if (!known.has(id)) continue;
    merged[id] = p;
    applied++;
  }

  if (applied === 0) {
    return {
      config: null,
      errors: [...parseErrors, 'No coordinates matched a known node id'],
      warnings: [],
      applied,
      unknown,
    };
  }

  const draft = { ...toDraft(config), layout_overrides: merged };
  const built = buildAndValidate(draft);
  return {
    config: built.config,
    errors: [...parseErrors, ...built.errors],
    warnings: built.warnings,
    applied,
    unknown,
  };
}

// Re-export for callers that want a one-liner rebuild after editing coordinates.
export { buildConfig };
