// lineTopology.js — auto-generate (and reverse-engineer) the transport graph for
// a simple production line.
//
// The wizard lets users describe a factory as an *ordered list of stations*.
// This module turns that linear description into the abstract node/segment/exit
// graph the engine needs — so users never hand-author topology — and guarantees
// the result passes validateFactoryConfig (DAG, reachability via the
// `${station.id}_input` convention, ship/scrap exits, carrier-pool exclusivity).
//
// Everything here is PURE and DRAFT-SHAPED: it consumes/produces the plain-object
// arrays defined by configDraft.js (not make* objects), with no React or engine
// imports, so the wizard can splice the result straight into its draft and let
// buildAndValidate() compile + validate it.

// ── shared id conventions ─────────────────────────────────────────────────

/** The node a station reads its input from. Load-bearing: the validator ties
 *  reachability to this exact id (engine/validator.js checkDeadEnds). */
export function stationInputId(stationId) {
  return `${stationId}_input`;
}

const sanitize = (s) => String(s).replace(/[^a-zA-Z0-9_]/g, '_');
const segmentId = (prefix, from, to) => `${prefix}_${sanitize(from)}__${sanitize(to)}`;
const poolId = (prefix, from, to) => `${prefix}_${sanitize(from)}__${sanitize(to)}`;

// ── defaults ──────────────────────────────────────────────────────────────

/** A sensible default inbound link: a 10 m conveyor at 60 m/min, capacity 10. */
export function defaultLink() {
  return {
    length_m: 10,
    capacity: 10,
    transport: { class: 'passive', mode: 'conveyor', speed_m_per_min: 60 },
  };
}

/** A short default carrier pool spec (id is assigned by buildTopology). */
export function defaultCarrierPoolSpec() {
  return {
    carrier_kind: 'amr',
    count: 1,
    units_per_trip: 1,
    speed_loaded_m_per_min: 60,
    speed_empty_m_per_min: 120,
    load_unload_seconds: 30,
  };
}

const DEFAULT_OPTIONS = {
  intakeId: 'n_intake',
  shipExitId: 'ship',
  scrapExitId: 'scrap',
  segIdPrefix: 'seg',
  poolIdPrefix: 'pool',
};

// ── draft builders ─────────────────────────────────────────────────────────

function passiveSegmentDraft(id, from, to, link) {
  return {
    id,
    from_node_id: from,
    to_node_id: to,
    length_m: link.length_m,
    capacity: link.capacity,
    class: 'passive',
    mode: link.transport.mode ?? 'conveyor',
    speed_m_per_min: link.transport.speed_m_per_min ?? 60,
    pool_id: '',
  };
}

function carrierSegmentDraft(id, from, to, pId) {
  return {
    id,
    from_node_id: from,
    to_node_id: to,
    length_m: 10,
    capacity: 10,
    class: 'carrier',
    mode: 'conveyor', // ignored for carrier class; kept so the draft shape is uniform
    speed_m_per_min: 60,
    pool_id: pId,
  };
}

/** Build a draft segment + (optionally) a dedicated carrier pool from a link. */
function buildSegmentForLink(id, from, to, link, opts) {
  if (link.transport.class === 'carrier') {
    const pId = poolId(opts.poolIdPrefix, from, to); // unique per segment → exclusivity holds
    const { id: _ignore, ...spec } = link.transport.pool ?? {};
    const pool = { id: pId, ...defaultCarrierPoolSpec(), ...spec };
    const seg = carrierSegmentDraft(id, from, to, pId);
    seg.length_m = link.length_m ?? 20;
    seg.capacity = link.capacity ?? 10;
    return { seg, pool };
  }
  return { seg: passiveSegmentDraft(id, from, to, link), pool: null };
}

// ── buildTopology ───────────────────────────────────────────────────────────

/**
 * Generate the transport graph for a linear sequence of stations.
 *
 * @param {Array<{id:string, name?:string, inspect?:boolean}>} stationsInOrder
 *        Stations in flow order. `inspect` (or options.isInspectStation) marks a
 *        station that needs a scrap branch.
 * @param {Array<object>} links  Inbound links; links[i] feeds stationsInOrder[i]
 *        (links[0] is intake → station[0]). Length must equal stationsInOrder.
 *        Each link: { length_m, capacity, transport: passive|carrier }.
 * @param {object} [options]  { intakeId, shipExitId, scrapExitId, shipLink,
 *        scrapLink, segIdPrefix, poolIdPrefix, isInspectStation }
 * @returns {{nodes, segments, exits, carrierPools, stationNodeIds}}
 *        Draft-shaped arrays. The caller must bind each station's `node_id` to
 *        stationNodeIds[station.id] (= `${id}_input`).
 */
export function buildTopology(stationsInOrder, links, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const isInspect = opts.isInspectStation ?? ((s) => !!s.inspect);

  const N = stationsInOrder.length;
  if (N < 1) {
    throw new Error('buildTopology requires at least one station');
  }
  const ids = stationsInOrder.map((s) => s.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('buildTopology requires unique station ids');
  }
  if (links.length !== N) {
    throw new Error(`buildTopology: links length (${links.length}) must equal station count (${N})`);
  }

  const nodes = [];
  const segments = [];
  const exits = [];
  const carrierPools = [];
  const stationNodeIds = {};

  // Head intake node.
  nodes.push({ id: opts.intakeId, type: 'intake', name: 'Intake' });

  // One station_input node per station.
  for (const s of stationsInOrder) {
    const nodeId = stationInputId(s.id);
    stationNodeIds[s.id] = nodeId;
    nodes.push({ id: nodeId, type: 'station_input', name: s.name || s.id });
  }

  // Ship exit (always) + scrap exit (iff any inspect station).
  exits.push({ id: opts.shipExitId, kind: 'ship', name: 'Shipping' });
  const anyInspect = stationsInOrder.some(isInspect);
  if (anyInspect) {
    exits.push({ id: opts.scrapExitId, kind: 'scrap', name: 'Scrap' });
  }

  // Main chain: intake → s0 → s1 → … → s(N-1) → ship.
  const addLinkSegment = (from, to, link) => {
    const id = segmentId(opts.segIdPrefix, from, to);
    const { seg, pool } = buildSegmentForLink(id, from, to, link, opts);
    segments.push(seg);
    if (pool) carrierPools.push(pool);
  };

  let prev = opts.intakeId;
  for (let i = 0; i < N; i++) {
    const nodeId = stationNodeIds[stationsInOrder[i].id];
    addLinkSegment(prev, nodeId, links[i] ?? defaultLink());
    prev = nodeId;
  }
  // Terminal link to the ship exit.
  addLinkSegment(prev, opts.shipExitId, opts.shipLink ?? defaultLink());

  // Scrap branch from each inspect station.
  if (anyInspect) {
    const scrapLink = opts.scrapLink ?? { length_m: 5, capacity: 10, transport: { class: 'passive', mode: 'conveyor', speed_m_per_min: 60 } };
    for (const s of stationsInOrder) {
      if (!isInspect(s)) continue;
      addLinkSegment(stationNodeIds[s.id], opts.scrapExitId, scrapLink);
    }
  }

  return { nodes, segments, exits, carrierPools, stationNodeIds };
}

// ── inferLine (reverse, for edit mode) ───────────────────────────────────────

/**
 * Detect whether a draft describes a "simple line" the wizard can faithfully
 * round-trip, and if so reconstruct its ordered stations + links.
 *
 * @param {object} draft  A flat config draft (configDraft.toDraft shape).
 * @returns {{ok:true, stationsInOrder, links, shipLink}|{ok:false, reason:string}}
 */
export function inferLine(draft) {
  const nodes = draft.nodes ?? [];
  const exits = draft.exits ?? [];
  const segments = draft.segments ?? [];
  const stations = draft.stations ?? [];
  const carrierPools = draft.carrierPools ?? [];
  const processes = draft.processes ?? [];

  const fail = (reason) => ({ ok: false, reason });

  // 1. Exactly one intake; no junction/buffer nodes.
  const intakes = nodes.filter((n) => n.type === 'intake');
  if (intakes.length !== 1) return fail(`expected exactly one intake node (found ${intakes.length})`);
  if (nodes.some((n) => n.type === 'junction' || n.type === 'buffer')) {
    return fail('graph contains junction/buffer nodes (not a simple line)');
  }
  const intakeId = intakes[0].id;

  // 2. Exactly one ship exit; at most one scrap exit.
  const shipExits = exits.filter((e) => e.kind === 'ship');
  const scrapExits = exits.filter((e) => e.kind === 'scrap');
  if (shipExits.length !== 1) return fail(`expected exactly one ship exit (found ${shipExits.length})`);
  if (scrapExits.length > 1) return fail(`expected at most one scrap exit (found ${scrapExits.length})`);
  const shipId = shipExits[0].id;
  const scrapId = scrapExits[0]?.id ?? null;

  // 3. Every station uses the `${id}_input` convention and that node exists.
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const stationByNode = new Map();
  for (const s of stations) {
    const expected = stationInputId(s.id);
    if (s.node_id !== expected) return fail(`station "${s.id}" does not use the _input node convention`);
    const node = nodeById.get(expected);
    if (!node || node.type !== 'station_input') return fail(`station "${s.id}" has no station_input node`);
    stationByNode.set(expected, s);
  }

  // 4. station_input nodes ↔ stations must be a bijection (no orphans).
  const stationInputNodes = nodes.filter((n) => n.type === 'station_input');
  if (stationInputNodes.length !== stations.length) {
    return fail('orphan station_input node(s) without a matching station');
  }

  // 5. Classify edges (main flow vs scrap) and check a single chain.
  const kindOf = new Map(processes.map((p) => [p.id, p.kind]));
  const stationIsInspect = (s) => (s.processes ?? []).some((sp) => kindOf.get(sp.process_id) === 'inspect');

  const mainOut = new Map(); // nodeId → [toId]
  const mainIn = new Map();
  const scrapFrom = []; // segments → scrap
  const bump = (map, k) => map.set(k, (map.get(k) ?? 0) + 1);
  const inDeg = new Map();
  const outDeg = new Map();

  for (const seg of segments) {
    if (scrapId && seg.to_node_id === scrapId) {
      scrapFrom.push(seg);
      continue;
    }
    if (!mainOut.has(seg.from_node_id)) mainOut.set(seg.from_node_id, []);
    mainOut.get(seg.from_node_id).push(seg);
    bump(outDeg, seg.from_node_id);
    bump(inDeg, seg.to_node_id);
    mainIn.set(seg.to_node_id, seg);
  }

  // Degree expectations.
  if ((outDeg.get(intakeId) ?? 0) !== 1 || (inDeg.get(intakeId) ?? 0) !== 0) {
    return fail('intake node is not a single chain head');
  }
  if ((inDeg.get(shipId) ?? 0) !== 1 || (outDeg.get(shipId) ?? 0) !== 0) {
    return fail('ship exit is not a single chain tail');
  }
  for (const node of stationInputNodes) {
    if ((inDeg.get(node.id) ?? 0) !== 1 || (outDeg.get(node.id) ?? 0) !== 1) {
      return fail(`fan-in/fan-out at node "${node.id}" (not a single chain)`);
    }
  }

  // 6. Walk the chain from intake → ship, collecting station order.
  const stationsInOrder = [];
  const links = [];
  let cursor = intakeId;
  let shipLink = null;
  const seen = new Set();
  for (let guard = 0; guard <= stations.length + 1; guard++) {
    const outSegs = mainOut.get(cursor) ?? [];
    if (outSegs.length !== 1) return fail(`broken chain at "${cursor}"`);
    const seg = outSegs[0];
    const to = seg.to_node_id;
    if (to === shipId) {
      shipLink = linkFromSegment(seg, carrierPools);
      cursor = to;
      break;
    }
    if (seen.has(to)) return fail('cycle detected while walking the line');
    seen.add(to);
    const station = stationByNode.get(to);
    if (!station) return fail(`chain visits non-station node "${to}"`);
    stationsInOrder.push({ id: station.id, name: nodeById.get(to)?.name ?? station.id, inspect: stationIsInspect(station) });
    links.push(linkFromSegment(seg, carrierPools));
    cursor = to;
  }
  if (cursor !== shipId) return fail('chain does not terminate at the ship exit');
  if (stationsInOrder.length !== stations.length) return fail('chain does not cover every station');

  // 7. Scrap edges must originate only from inspect stations, one each.
  if (scrapId) {
    const inspectNodeIds = new Set(stations.filter(stationIsInspect).map((s) => stationInputId(s.id)));
    const scrapSources = new Set();
    for (const seg of scrapFrom) {
      if (!inspectNodeIds.has(seg.from_node_id)) return fail(`scrap edge from non-inspect node "${seg.from_node_id}"`);
      if (scrapSources.has(seg.from_node_id)) return fail(`multiple scrap edges from "${seg.from_node_id}"`);
      scrapSources.add(seg.from_node_id);
    }
    if (scrapSources.size !== inspectNodeIds.size) return fail('not every inspect station has a scrap edge');
  }

  // 8. Carrier pools must be dedicated (one segment each).
  const poolUse = new Map();
  for (const seg of segments) {
    if (seg.class === 'carrier' && seg.pool_id) {
      poolUse.set(seg.pool_id, (poolUse.get(seg.pool_id) ?? 0) + 1);
    }
  }
  for (const [pid, count] of poolUse) {
    if (count > 1) return fail(`carrier pool "${pid}" is shared by ${count} segments`);
  }

  return { ok: true, stationsInOrder, links, shipLink: shipLink ?? defaultLink() };
}

/** Read a draft segment's transport back into a link descriptor. */
function linkFromSegment(seg, carrierPools) {
  if (seg.class === 'carrier') {
    const pool = (carrierPools ?? []).find((p) => p.id === seg.pool_id);
    const { id, ...spec } = pool ?? {};
    return {
      length_m: seg.length_m,
      capacity: seg.capacity,
      transport: { class: 'carrier', pool: { ...defaultCarrierPoolSpec(), ...spec } },
    };
  }
  return {
    length_m: seg.length_m,
    capacity: seg.capacity,
    transport: { class: 'passive', mode: seg.mode ?? 'conveyor', speed_m_per_min: seg.speed_m_per_min ?? 60 },
  };
}
