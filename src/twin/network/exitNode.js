// ExitNode — terminal destination (§7.2).
//
// An exit is where units leave the factory: shipped or scrapped.
// Used by order aggregation and pull-gating.

import { invariant } from '../util/assert.js';

export const EXIT_KIND = Object.freeze({
  SHIP: 'ship',
  SCRAP: 'scrap',
});

/**
 * @param {object} args
 * @param {string} args.id
 * @param {string} args.kind                 EXIT_KIND value
 * @param {string} [args.name]               display name
 */
export function makeExitNode({ id, kind, name = '' }) {
  invariant(typeof id === 'string' && id.length > 0, 'exitNode.id is required');
  invariant(Object.values(EXIT_KIND).includes(kind), `exitNode.kind "${kind}" must be one of ${Object.values(EXIT_KIND).join(', ')}`);
  return Object.freeze({
    kind_of: 'exit_node',
    id,
    kind,
    name,
  });
}
