// TrackNode — named location on the factory network (§7.2).
//
// A node is a logical waypoint: intake, junction, buffer, or station input.
// Nodes are referenced by segment endpoints and stations.

import { invariant } from '../util/assert.js';

export const NODE_TYPE = Object.freeze({
  INTAKE: 'intake',
  JUNCTION: 'junction',
  BUFFER: 'buffer',
  STATION_INPUT: 'station_input',
});

/**
 * @param {object} args
 * @param {string} args.id
 * @param {string} args.type                NODE_TYPE value
 * @param {string} [args.name]              display name
 */
export function makeTrackNode({ id, type, name = '' }) {
  invariant(typeof id === 'string' && id.length > 0, 'trackNode.id is required');
  invariant(Object.values(NODE_TYPE).includes(type), `trackNode.type "${type}" must be one of ${Object.values(NODE_TYPE).join(', ')}`);
  return Object.freeze({
    kind_of: 'track_node',
    id,
    type,
    name,
  });
}
