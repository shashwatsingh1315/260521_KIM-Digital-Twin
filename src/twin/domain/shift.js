// Shift — workforce schedule (§4.5).
//
// A shift defines when staff are present and how many are assigned per station.
// Station processes only "tick" while their station is staffed in the active
// shift; availability also feeds derived throughput (§15). Static → frozen.

import { invariant } from '../util/assert.js';

/**
 * @param {object} args
 * @param {string} args.id
 * @param {string} args.name                 e.g. "Day Shift"
 * @param {string} [args.start_time="07:00"] "HH:MM"
 * @param {number} [args.duration_hours=7]
 * @param {string[]} [args.days]             e.g. ["Mon",...]
 * @param {object} [args.staffing]           { station_id: { role: count } }
 */
export function makeShift({ id, name, start_time = '07:00', duration_hours = 7, days = [], staffing = {} }) {
  invariant(typeof id === 'string' && id.length > 0, 'shift.id is required');
  invariant(typeof name === 'string' && name.length > 0, `shift.name is required (${id})`);
  invariant(duration_hours > 0 && duration_hours <= 24, `shift.duration_hours must be 0..24 (${id})`);
  return Object.freeze({
    kind_of: 'shift',
    id,
    name,
    start_time,
    duration_hours,
    days: Object.freeze([...days]),
    staffing: Object.freeze({ ...staffing }),
  });
}
