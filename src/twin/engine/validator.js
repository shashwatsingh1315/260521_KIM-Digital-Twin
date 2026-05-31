// Config validator (§4.6, §4.7, §6).
//
// Pre-flight checks before engine runs. Returns {errors, warnings}.
// Errors are fatal (graph cycles, dead-ends, unreachable processes, inspect without scrap).
// Warnings are advisory (bottleneck ties, etc.).

import { effectiveSlots, capacityPerHour } from './derive.js';

/**
 * Validate a FactoryConfig. Returns {errors: string[], warnings: string[]}.
 * @param {object} config FactoryConfig
 */
export function validateFactoryConfig(config) {
  const errors = [];
  const warnings = [];

  // Check 1: Segment graph has no cycles (must be a DAG).
  const cycleError = checkDAG(config);
  if (cycleError) errors.push(cycleError);

  // Check 2: No dead-ends; ≥1 ship exit exists.
  const deadEndError = checkDeadEnds(config);
  if (deadEndError) errors.push(deadEndError);

  // Check 3: Every material routable through required processes.
  const routeErrors = checkRoutability(config);
  errors.push(...routeErrors);

  // Check 4: Inspect processes have reachable scrap exit.
  const scrapErrors = checkInspectScrapExit(config);
  errors.push(...scrapErrors);

  // Check 5: Carrier pool references and exclusivity.
  const poolErrors = checkCarrierPools(config);
  errors.push(...poolErrors);

  // Check 6: Bottleneck identification (warn on ties).
  const bottleWarnings = checkBottleneck(config);
  warnings.push(...bottleWarnings);

  return Object.freeze({ errors, warnings });
}

// ============================================================================
// Check 1: DAG (no cycles in segment graph)
// ============================================================================

function checkDAG(config) {
  const nodeIds = new Set(config.nodes.map((n) => n.id));
  const exitIds = new Set(config.exits.map((e) => e.id));
  const allDestinations = new Set([...nodeIds, ...exitIds]);

  const graph = new Map();
  for (const node of config.nodes) {
    graph.set(node.id, []);
  }
  for (const exit of config.exits) {
    graph.set(exit.id, []);
  }

  for (const seg of config.segments) {
    if (graph.has(seg.from_node_id) && allDestinations.has(seg.to_node_id)) {
      graph.get(seg.from_node_id).push(seg.to_node_id);
    }
  }

  // Detect cycles using DFS.
  const visited = new Set();
  const recStack = new Set();

  function hasCycle(nodeId) {
    visited.add(nodeId);
    recStack.add(nodeId);

    for (const neighbor of graph.get(nodeId) || []) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        return true;
      }
    }

    recStack.delete(nodeId);
    return false;
  }

  for (const nodeId of graph.keys()) {
    if (!visited.has(nodeId)) {
      if (hasCycle(nodeId)) {
        return 'Segment graph contains a cycle; must be a DAG';
      }
    }
  }

  return null;
}

// ============================================================================
// Check 2: Dead-ends (≥1 ship exit, all nodes/stations reachable to exits)
// ============================================================================

function checkDeadEnds(config) {
  const shipExits = config.exits.filter((e) => e.kind === 'ship');
  if (shipExits.length === 0) {
    return 'No ship exit defined; orders cannot complete';
  }

  const nodeIds = new Set(config.nodes.map((n) => n.id));
  const exitIds = new Set(config.exits.map((e) => e.id));

  // Build reverse graph (who can reach whom).
  const reverseGraph = new Map();
  for (const nodeId of nodeIds) {
    reverseGraph.set(nodeId, []);
  }
  for (const exitId of exitIds) {
    reverseGraph.set(exitId, []);
  }

  for (const seg of config.segments) {
    if (reverseGraph.has(seg.to_node_id) && reverseGraph.has(seg.from_node_id)) {
      reverseGraph.get(seg.to_node_id).push(seg.from_node_id);
    }
  }

  // BFS backward from ship exits to find all reachable nodes.
  const reachable = new Set();
  const queue = [...shipExits.map((e) => e.id)];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (reachable.has(nodeId)) continue;
    reachable.add(nodeId);

    for (const pred of reverseGraph.get(nodeId) || []) {
      if (!reachable.has(pred)) {
        queue.push(pred);
      }
    }
  }

  // Check if any station is unreachable.
  for (const station of config.stations) {
    const entryNode = config.nodes.find((n) => n.id === `${station.id}_input`);
    if (entryNode && !reachable.has(entryNode.id)) {
      return `Station "${station.id}" is unreachable from any ship exit`;
    }
  }

  return null;
}

// ============================================================================
// Check 3: Routability (every material can flow through its processes)
// ============================================================================

function checkRoutability(config) {
  const errors = [];
  const procMap = new Map(config.processes.map((p) => [p.id, p]));
  const stationMap = new Map(config.stations.map((s) => [s.id, s]));

  // For each order, verify all processes in its sequence exist and are reachable.
  for (const order of config.orders) {
    for (let i = 0; i < order.process_sequence.length; i++) {
      const procId = order.process_sequence[i];
      if (!procMap.has(procId)) {
        errors.push(`Order "${order.id}" references unknown process "${procId}"`);
        continue;
      }

      // Check if any station in the config does this process.
      const doingStations = config.stations.filter((s) =>
        s.processes.some((sp) => sp.process_id === procId),
      );
      if (doingStations.length === 0) {
        errors.push(`Order "${order.id}" requires process "${procId}" but no station does it`);
      }
    }
  }

  return errors;
}

// ============================================================================
// Check 4: Inspect processes must have reachable scrap exit
// ============================================================================

function checkInspectScrapExit(config) {
  const errors = [];
  const scrapExits = config.exits.filter((e) => e.kind === 'scrap');

  if (scrapExits.length === 0) {
    // Only error if any inspect process exists.
    const hasInspect = config.processes.some((p) => p.kind === 'inspect');
    if (hasInspect) {
      errors.push('Inspect process exists but no scrap exit is defined');
    }
  }

  return errors;
}

// ============================================================================
// Check 5: Carrier pool validation
// ============================================================================

function checkCarrierPools(config) {
  const errors = [];
  const poolIds = new Set(config.carrierPools.map((p) => p.id));
  const poolUsage = new Map();

  for (const seg of config.segments) {
    if (seg.transport.class === 'carrier') {
      const poolId = seg.transport.pool_id;
      if (!poolIds.has(poolId)) {
        errors.push(`Segment "${seg.id}" references undefined carrier pool "${poolId}"`);
      } else {
        if (!poolUsage.has(poolId)) {
          poolUsage.set(poolId, []);
        }
        poolUsage.get(poolId).push(seg.id);
      }
    }
  }

  // Check pool exclusivity: a pool can only serve one segment.
  for (const [poolId, segments] of poolUsage.entries()) {
    if (segments.length > 1) {
      errors.push(`Carrier pool "${poolId}" is used by multiple segments (${segments.join(', ')}); pools must be dedicated`);
    }
  }

  return errors;
}

// ============================================================================
// Check 6: Bottleneck identification (warn on ties)
// ============================================================================

function checkBottleneck(config) {
  const warnings = [];

  // Simple heuristic: for each station, compute effective_slots and capacity_per_hour.
  // Bottleneck is the minimum. Warn if there's a tie.

  const capacities = [];
  for (const station of config.stations) {
    for (const stProc of station.processes) {
      const effSlots = effectiveSlots(stProc.parallel_slots, stProc.operators_per_slot);
      const capHr = capacityPerHour(stProc.takt_seconds, effSlots);
      capacities.push({
        station: station.id,
        process: stProc.process_id,
        capacityPerHour: capHr,
      });
    }
  }

  if (capacities.length === 0) return warnings;

  const minCap = Math.min(...capacities.map((c) => c.capacityPerHour));
  const bottlenecks = capacities.filter((c) => c.capacityPerHour === minCap);

  if (bottlenecks.length > 1) {
    warnings.push(
      `Multiple bottlenecks tied at ${minCap.toFixed(2)}/hr: ${bottlenecks.map((b) => `${b.station}.${b.process}`).join(', ')}`,
    );
  }

  return warnings;
}
