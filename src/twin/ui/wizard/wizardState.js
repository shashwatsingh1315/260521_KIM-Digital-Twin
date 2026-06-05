// wizardState.js — pure helpers backing the FactoryWizard.
//
// The wizard's canonical state is a flat config draft (configDraft.toDraft shape)
// plus a parallel `links` array (one inbound link per station, in station order)
// and a terminal `shipLink`. Topology (nodes/segments/exits/carrierPools) is
// regenerated from those via lineTopology.buildTopology — users never edit it
// directly in guided mode.

import { buildTopology, inferLine, defaultLink, stationInputId } from './lineTopology.js';

// ── id helpers ──────────────────────────────────────────────────────────────

export function slugify(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** A slug derived from `name`, made unique against `existingIds`. */
export function uniqueId(name, existingIds, fallback = 'item') {
  const base = slugify(name) || fallback;
  if (!existingIds.includes(base)) return base;
  let i = 2;
  while (existingIds.includes(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

// ── draft scaffolding ─────────────────────────────────────────────────────────

export function blankDraft() {
  return {
    seed: 0,
    materials: [],
    processes: [],
    stations: [],
    nodes: [],
    segments: [],
    exits: [],
    carrierPools: [],
    shifts: [{ id: 'day', name: 'Day Shift', start_time: '07:00', duration_hours: 8, days: ['mon', 'tue', 'wed', 'thu', 'fri'], staffing: {} }],
    orders: [],
  };
}

/** True if any process assigned to this station is an inspect kind. */
export function stationIsInspect(draft, station) {
  const kindOf = new Map((draft.processes ?? []).map((p) => [p.id, p.kind]));
  return (station.processes ?? []).some((sp) => kindOf.get(sp.process_id) === 'inspect');
}

// ── topology regeneration ─────────────────────────────────────────────────────

/**
 * Rebuild nodes/segments/exits/carrierPools from the ordered stations + links,
 * and rebind each station's node_id. Returns a NEW draft. No-op (topology left
 * empty) when there are no stations yet.
 */
export function regenTopology(draft, links, shipLink) {
  const stations = draft.stations ?? [];
  if (stations.length === 0) {
    return { ...draft, nodes: [], segments: [], exits: [], carrierPools: [] };
  }
  const stationsForTopo = stations.map((s) => ({
    id: s.id,
    name: s.name,
    inspect: stationIsInspect(draft, s),
  }));
  const topo = buildTopology(stationsForTopo, links, { shipLink });
  return {
    ...draft,
    nodes: topo.nodes,
    segments: topo.segments,
    exits: topo.exits,
    carrierPools: topo.carrierPools,
    stations: stations.map((s) => ({ ...s, node_id: topo.stationNodeIds[s.id] })),
  };
}

/**
 * Initialise wizard state from an existing flat draft (template or current
 * config). Returns { draft, links, shipLink, mode }. mode is 'advanced' when the
 * graph isn't a simple line we can round-trip — the wizard then leaves topology
 * to the ConfigPanel Network tab.
 */
export function initFromDraft(draft) {
  const res = inferLine(draft);
  if (!res.ok) {
    return { draft, links: [], shipLink: defaultLink(), mode: 'advanced', reason: res.reason };
  }
  // Reorder stations to match the inferred flow order.
  const order = res.stationsInOrder.map((s) => s.id);
  const byId = new Map(draft.stations.map((s) => [s.id, s]));
  const orderedStations = order.map((id) => byId.get(id)).filter(Boolean);
  // Any stations not on the line (shouldn't happen for ok lines) keep their place.
  for (const s of draft.stations) if (!order.includes(s.id)) orderedStations.push(s);
  return {
    draft: { ...draft, stations: orderedStations },
    links: res.links,
    shipLink: res.shipLink,
    mode: 'guided',
  };
}

// ── per-step validation attribution ──────────────────────────────────────────

// Best-effort mapping of a validator/factory error string to the step that owns
// it, so the sidebar can show a ⚠ on the right step.
const STEP_MATCHERS = {
  materials: /material/i,
  processes: /\bprocess\b/i,
  line: /station|node|segment|unreachable|cycle|dag|reachable/i,
  flow: /carrier pool|exit|scrap|ship|segment/i,
  shifts: /shift|staffing/i,
  orders: /order/i,
};

export function stepStatus(stepKey, draft, errors) {
  const arr = errors ?? [];
  const matcher = STEP_MATCHERS[stepKey];
  const hasError = matcher ? arr.some((e) => matcher.test(e)) : false;
  if (hasError) return 'error';
  if (isStepEmpty(stepKey, draft)) return 'empty';
  return 'ok';
}

function isStepEmpty(stepKey, draft) {
  switch (stepKey) {
    case 'materials': return (draft.materials ?? []).length === 0;
    case 'processes': return (draft.processes ?? []).length === 0;
    case 'line': return (draft.stations ?? []).length === 0;
    case 'orders': return (draft.orders ?? []).length === 0;
    default: return false;
  }
}

export { defaultLink, stationInputId };
