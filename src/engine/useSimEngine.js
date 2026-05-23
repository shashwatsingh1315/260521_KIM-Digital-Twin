import { useState, useEffect, useMemo, useCallback } from 'react';
import { buffer_capacity, initial_fill, scenario_override } from '../data/m800_model.js';

// Direct simulation edges: source buffer → destination buffer.
// Transit nodes (lifts, VRCs, ramps) are collapsed into particle travel time.
// pathId is used for 3D particle animation; fromLocId/toLocId drive layout.
// Rates target a balanced steady-state at ~0.5 SFG/tick throughput.
// Pacing rule: every node's drain ≈ fill so no buffer drifts to 0 (starves)
// or 10 (pegs). BWIP receives 3 sub-streams (PCBA + TRSS + BOP); each is
// paced at ~⅓ of 1P consumption so the sum matches the drain.
const SIM_EDGES = [
  // ── KMP main chain (raw → SMT → FCT → SF) ──
  { from: '_SUPPLIER',            to: 'LOC-KMP-GF-IQC',       pathId: 'PATH-DOCK3-IQC',          processId: 'PROC-KMP-INBOUND',          rate: 0.55 },
  { from: 'LOC-KMP-GF-IQC',       to: 'LOC-KMP-FF-ESTORE',    pathId: 'PATH-IQC-LIFT-GF',         processId: 'PROC-KMP-ESTORE-PUTAWAY',   rate: 0.50 },
  { from: 'LOC-KMP-FF-ESTORE',    to: 'LOC-KMP-GF-SMT',       pathId: 'PATH-VRC-GF-SMT',          processId: 'PROC-KMP-SMT-ISSUE',        rate: 0.50 },
  { from: 'LOC-KMP-GF-SMT',       to: 'LOC-KMP-GF-FCT',       pathId: 'PATH-SMT-FCT',             processId: 'PROC-KMP-SMT',              rate: 0.50 },
  // PCBA contribution to BWIP — one of three sub-streams
  { from: 'LOC-KMP-GF-FCT',       to: 'LOC-KMP-SF-B-WIP',     pathId: 'PATH-VRC-GF-SF',           processId: 'PROC-KMP-1P-MATL-ISSUE',    rate: 0.18 },

  // ── WH inbound chain (raw → IQC → ASRS-IN, then split to TRSS / BWIP) ──
  { from: '_SUPPLIER_WH',         to: 'LOC-WH-GF-IQC',        pathId: 'PATH-WH-INWARD-IQC',       processId: 'PROC-WH-RM-INBOUND',        rate: 0.45 },
  { from: 'LOC-WH-GF-IQC',        to: 'LOC-WH-GF-ASRS-IN',    pathId: 'PATH-WH-IQC-ASRS-IN',      processId: 'PROC-WH-RM-IQC',            rate: 0.40 },
  // ASRS-IN drains via TRSS feed + BOP feed (≈ 0.18 + 0.18 = 0.36); refill at 0.40
  { from: 'LOC-WH-GF-ASRS-IN',    to: 'LOC-KMP-SF-A-TRSS',    pathId: 'PATH-KMP-RAMP-TRSS',       processId: 'PROC-KMP-TRSS-MATL-RECEIPT',rate: 0.18 },
  { from: 'LOC-WH-GF-ASRS-IN',    to: 'LOC-KMP-SF-B-WIP',     pathId: 'PATH-KMP-RAMP-BWIP',       processId: 'PROC-KMP-BOP-RECEIPT',      rate: 0.18 },
  // TRSS subassembly → BWIP — third sub-stream
  { from: 'LOC-KMP-SF-A-TRSS',    to: 'LOC-KMP-SF-B-WIP',     pathId: 'PATH-TRSS-BWIP',           processId: 'PROC-KMP-1P-MATL-ISSUE',    rate: 0.18 },

  // ── 1P assembly → SFG → cross to WH ASRS ──
  // BWIP drains at 0.55 (just over the 3×0.18 = 0.54 inflow so no peg)
  { from: 'LOC-KMP-SF-B-WIP',     to: 'LOC-KMP-SF-B-1P',      pathId: 'PATH-BWIP-1P',             processId: 'PROC-KMP-1P-SPM',           rate: 0.55 },
  { from: 'LOC-KMP-SF-B-1P',      to: 'LOC-KMP-SF-SFG-PACK',  pathId: 'PATH-1P-SFG-PACK',         processId: 'PROC-KMP-SFG-BOX',          rate: 0.55 },
  { from: 'LOC-KMP-SF-SFG-PACK',  to: 'LOC-WH-GF-ASRS',       pathId: 'PATH-KMP-SFG-WH-ASRS',     processId: 'PROC-WH-SFG-ASRS-PUTAWAY',  rate: 0.50 },

  // ── WH lines A & B (FF + SF) — each handles half the SFG ──
  { from: 'LOC-WH-GF-ASRS',       to: 'LOC-WH-FF-VC',         pathId: 'PATH-ASRS-FF-VC',          processId: 'PROC-WH-NIC-SIM-SEAL',      rate: 0.25 },
  { from: 'LOC-WH-FF-VC',         to: 'LOC-WH-FF-PACK',       pathId: 'PATH-FF-VC-PACK',          processId: 'PROC-WH-SCREEN-LASER-HOLO', rate: 0.25 },
  { from: 'LOC-WH-FF-PACK',       to: 'LOC-WH-GF-FG-ASRS',    pathId: 'PATH-FF-PACK-FG-ASRS',     processId: 'PROC-WH-FG-ASRS-PUTAWAY',   rate: 0.25 },
  { from: 'LOC-WH-GF-ASRS',       to: 'LOC-WH-SF-VC',         pathId: 'PATH-ASRS-SF-VC',          processId: 'PROC-WH-NIC-SIM-SEAL',      rate: 0.25 },
  { from: 'LOC-WH-SF-VC',         to: 'LOC-WH-SF-PACK',       pathId: 'PATH-SF-VC-PACK',          processId: 'PROC-WH-SCREEN-LASER-HOLO', rate: 0.25 },
  { from: 'LOC-WH-SF-PACK',       to: 'LOC-WH-GF-FG-ASRS',    pathId: 'PATH-SF-PACK-FG-ASRS',     processId: 'PROC-WH-AUTO-PACK',         rate: 0.25 },

  // ── FG ASRS → Dispatch → Customer ──
  // FG-ASRS fills at 0.50 (FF+SF). Drain 0.48 + 0.05 = 0.53 → slow controlled drain
  { from: 'LOC-WH-GF-FG-ASRS',    to: 'LOC-WH-GF-DISPATCH',   pathId: 'PATH-FG-ASRS-DISPATCH',    processId: 'PROC-WH-DISPATCH-STAGE',    rate: 0.48 },
  { from: 'LOC-WH-GF-DISPATCH',   to: '_CUSTOMER',            pathId: 'PATH-DISPATCH-CUSTOMER',   processId: 'PROC-WH-DISPATCH',          rate: 0.46 },
  // FAT sampling — low-rate QA pull (n=5 functional, n=32 visual per batch)
  { from: 'LOC-WH-GF-FG-ASRS',    to: 'LOC-KMP-3F-FAT',       pathId: 'PATH-FG-ASRS-FAT',         processId: 'PROC-KMP-PDI-FAT',          rate: 0.05 },
  // ── Reverse logistics: empty bins back to KMP dock ──
  { from: 'LOC-KMP-SF-B-WIP',     to: 'LOC-KMP-GF-DOCK3',     pathId: 'PATH-KMP-EMPTYBIN-DOCK3',  processId: 'PROC-KMP-EMPTYBIN-RETURN',  rate: 0.12 },
];

const BUFFER_LOCS = Object.keys(buffer_capacity);
const MAX_TICK = 100;

function buildInitialBuffers() {
  const b = {};
  for (const loc of BUFFER_LOCS) {
    b[loc] = Math.round((buffer_capacity[loc] ?? 10) * (initial_fill[loc] ?? 0.3));
  }
  return b;
}

function effectiveRate(edge, activeScenarios) {
  let rate = edge.rate;
  for (const id of activeScenarios) {
    const scn = scenario_override.find(s => s.scenario_id === id);
    if (!scn) continue;
    if (scn.affected_path === edge.pathId || scn.entity_id === edge.processId) {
      rate *= (scn.new_value ?? 0);
    }
  }
  return rate;
}

export function runSimulation(activeScenarios = []) {
  const states = [];
  let pid = 1;
  let buffers = buildInitialBuffers();
  let particles = [];
  let totalDispatched = 0;

  states.push({ buffers: { ...buffers }, particles: [], totalDispatched });

  for (let t = 1; t <= MAX_TICK; t++) {
    const next = { ...buffers };
    const alive = [];
    let dispatched = totalDispatched;

    // Advance particles
    for (const p of particles) {
      const edge = SIM_EDGES.find(e => e.pathId === p.pathId && e.from === p.fromLocId);
      const rate = edge ? effectiveRate(edge, activeScenarios) : 1;

      if (rate === 0) {
        alive.push({ ...p, status: 'blocked' });
        continue;
      }
      const np = { ...p, progress: Math.min(1, p.progress + p.speed), status: 'moving' };
      if (np.progress >= 1) {
        if (np.toLocId === '_CUSTOMER') {
          dispatched++;
        } else if (next[np.toLocId] !== undefined) {
          const cap = buffer_capacity[np.toLocId] ?? 10;
          next[np.toLocId] = Math.min(cap, next[np.toLocId] + 1);
        }
      } else {
        alive.push(np);
      }
    }

    // Spawn new particles from each edge
    for (const edge of SIM_EDGES) {
      const rate = effectiveRate(edge, activeScenarios);
      if (rate <= 0) continue;

      // Source: either unlimited supplier or a buffer
      const srcLevel = (edge.from === '_SUPPLIER' || edge.from === '_SUPPLIER_WH') ? Infinity : (next[edge.from] ?? 0);
      if (srcLevel <= 0) continue;

      // Destination capacity check
      if (edge.to !== '_CUSTOMER' && next[edge.to] !== undefined) {
        const cap = buffer_capacity[edge.to] ?? 10;
        if (next[edge.to] >= cap) continue;
      }

      if (Math.random() < rate) {
        if (edge.from !== '_SUPPLIER' && edge.from !== '_SUPPLIER_WH') next[edge.from]--;
        alive.push({
          id: pid++,
          pathId: edge.pathId,
          processId: edge.processId,
          fromLocId: edge.from,
          toLocId: edge.to,
          progress: 0,
          speed: 0.18 + Math.random() * 0.08, // 5-8 ticks per hop
          status: 'moving',
        });
      }
    }

    buffers = next;
    particles = alive;
    totalDispatched = dispatched;

    states.push({ buffers: { ...buffers }, particles: [...particles], totalDispatched });
  }

  return states;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSimEngine() {
  const [activeScenarios, setActiveScenarios] = useState(() => {
    try { return JSON.parse(localStorage.getItem('m800_active_scenarios') || '[]'); } catch { return []; }
  });

  const [currentTick, setCurrentTick] = useState(() => {
    try { return Math.min(MAX_TICK, Math.max(0, parseInt(localStorage.getItem('m800_current_tick') || '50', 10))); } catch { return 50; }
  });

  const [isPlaying, setIsPlaying] = useState(false);

  const cachedStates = useMemo(() => runSimulation(activeScenarios), [activeScenarios]);

  useEffect(() => {
    try { localStorage.setItem('m800_active_scenarios', JSON.stringify(activeScenarios)); } catch { /* */ }
  }, [activeScenarios]);

  useEffect(() => {
    try { localStorage.setItem('m800_current_tick', String(currentTick)); } catch { /* */ }
  }, [currentTick]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setCurrentTick(t => { if (t >= MAX_TICK) { setIsPlaying(false); return MAX_TICK; } return t + 1; });
    }, 800);
    return () => clearInterval(id);
  }, [isPlaying]);

  const togglePlay     = useCallback(() => setIsPlaying(p => !p), []);
  const setTick        = useCallback(t => setCurrentTick(Math.min(MAX_TICK, Math.max(0, t))), []);
  const resetLive      = useCallback(() => setCurrentTick(MAX_TICK), []);
  const toggleScenario = useCallback(id =>
    setActiveScenarios(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  , []);

  const state = cachedStates[currentTick];

  const kpis = useMemo(() => {
    if (!state) return {};
    const b = state.buffers;
    const bottlenecks = BUFFER_LOCS.filter(loc => {
      const cap = buffer_capacity[loc] ?? 10;
      return (b[loc] ?? 0) >= cap * 0.9;
    });
    const starved = BUFFER_LOCS.filter(loc => (b[loc] ?? 0) === 0);
    return {
      whAsrsLevel:     b['LOC-WH-GF-ASRS'] ?? 0,
      dispatchLevel:   b['LOC-WH-GF-DISPATCH'] ?? 0,
      totalDispatched: state.totalDispatched,
      inTransit:       state.particles.length,
      bottlenecks,
      starved,
    };
  }, [state]);

  return {
    currentTick, isPlaying, activeScenarios,
    state, cachedStates, kpis,
    setTick, togglePlay, toggleScenario, resetLive,
    scenarios: scenario_override,
    maxTick: MAX_TICK,
  };
}
