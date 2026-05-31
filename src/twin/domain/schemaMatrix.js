// SchemaImpactMatrix — external-system representation (§9).
//
// Pure DOCUMENTATION attached to a process: which fields each external system
// (SAP/MES/WMS/Noviga) creates/reads/updates/deletes when this process runs.
// It does NOT drive the simulation; it is shown when a machine is clicked.

import { invariant } from '../util/assert.js';

export const SYSTEMS = Object.freeze(['SAP', 'MES', 'WMS', 'Noviga']);

/**
 * @param {object} args
 * @param {string} args.process_id
 * @param {Array<{system:string, create?:string[], read?:string[], update?:string[], delete?:string[]}>} args.rows
 */
export function makeSchemaMatrix({ process_id, rows = [] }) {
  invariant(typeof process_id === 'string' && process_id.length > 0, 'schemaMatrix.process_id is required');
  invariant(Array.isArray(rows), 'schemaMatrix.rows must be an array');
  const normRows = rows.map((r) => {
    invariant(SYSTEMS.includes(r.system), `schemaMatrix row system "${r.system}" must be one of ${SYSTEMS.join(', ')}`);
    return Object.freeze({
      system: r.system,
      create: Object.freeze([...(r.create || [])]),
      read: Object.freeze([...(r.read || [])]),
      update: Object.freeze([...(r.update || [])]),
      delete: Object.freeze([...(r.delete || [])]),
    });
  });
  return Object.freeze({
    kind_of: 'schema_matrix',
    process_id,
    rows: Object.freeze(normRows),
  });
}
