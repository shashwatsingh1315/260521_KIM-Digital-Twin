// Process — transformation recipe (§4.4).
//
// A process is a point in a 5-axis transform space (count/type/data/time/
// boundary); the named KINDs below are presets. We validate that only the
// fields valid for a given kind are supplied, so a misconfigured process fails
// loudly at construction rather than behaving "wonky" at run time.

import { invariant } from '../util/assert.js';

export const KIND = Object.freeze({
  TRANSFORM: 'transform',
  ASSEMBLY: 'assembly',
  INSPECT: 'inspect',
  LABEL: 'label',
  SEAL: 'seal',
  HOLD: 'hold',
  STORE: 'store',
  INTAKE: 'intake',
  OFFLOAD: 'offload',
});

const KIND_VALUES = new Set(Object.values(KIND));

// Per-kind field rules. `required` must be present; `allowed` (∪ required) is
// the full set of kind-specific fields permitted. Anything else is rejected.
const KIND_FIELDS = {
  transform: { required: ['output_material'], allowed: ['adds_enrichments'] },
  assembly: { required: ['output_material', 'bom'], allowed: ['adds_enrichments', 'enrichment_inherit'] },
  inspect: { required: ['pass_rate'], allowed: ['adds_enrichments'] },
  label: { required: ['adds_enrichments'], allowed: [] },
  seal: { required: ['adds_enrichments'], allowed: [] },
  hold: { required: ['dwell_seconds', 'slots'], allowed: [] },
  store: { required: ['slots'], allowed: [] },
  intake: { required: [], allowed: ['adds_enrichments', 'output_material'] },
  offload: { required: [], allowed: [] },
};

// All kind-specific field names the model knows about.
const KIND_SPECIFIC = [
  'output_material', 'bom', 'enrichment_inherit', 'pass_rate',
  'dwell_seconds', 'slots', 'adds_enrichments',
];

/**
 * @param {object} args
 * @param {string} args.id
 * @param {string} args.name
 * @param {string} args.kind          one of KIND
 * @param {string[]} [args.input_materials]
 * @param {object} [args.constraints] { requires_skills:[], requires_tools:[] }
 * @param {object} [args.schema_impact] SchemaImpactMatrix (§9)
 * Kind-specific (validated against KIND_FIELDS):
 * @param {string} [args.output_material]
 * @param {object} [args.bom]          { material_id: qty }
 * @param {string} [args.enrichment_inherit] "none" | "union"
 * @param {number} [args.pass_rate]    0..1
 * @param {number} [args.dwell_seconds]
 * @param {number} [args.slots]
 * @param {string[]} [args.adds_enrichments]
 */
export function makeProcess(args) {
  const { id, name, kind, input_materials = [], constraints = {}, schema_impact = null } = args;
  invariant(typeof id === 'string' && id.length > 0, 'process.id is required');
  invariant(typeof name === 'string' && name.length > 0, `process.name is required (${id})`);
  invariant(KIND_VALUES.has(kind), `process.kind "${kind}" is invalid (${id})`);

  const rules = KIND_FIELDS[kind];

  // Required fields present.
  for (const f of rules.required) {
    invariant(args[f] !== undefined, `process "${id}" of kind "${kind}" requires field "${f}"`);
  }

  // No kind-specific field that doesn't belong to this kind.
  const permitted = new Set([...rules.required, ...rules.allowed]);
  for (const f of KIND_SPECIFIC) {
    if (args[f] !== undefined) {
      invariant(permitted.has(f), `process "${id}" of kind "${kind}" must not set field "${f}"`);
    }
  }

  if (kind === KIND.INSPECT) {
    invariant(args.pass_rate >= 0 && args.pass_rate <= 1, `process "${id}" pass_rate must be 0..1`);
  }

  const out = {
    kind_of: 'process',
    id,
    name,
    kind,
    input_materials: Object.freeze([...input_materials]),
    constraints: Object.freeze({
      requires_skills: Object.freeze([...(constraints.requires_skills || [])]),
      requires_tools: Object.freeze([...(constraints.requires_tools || [])]),
    }),
    schema_impact,
  };
  // Copy only the permitted kind-specific fields.
  for (const f of permitted) {
    if (args[f] !== undefined) out[f] = args[f];
  }
  return Object.freeze(out);
}
