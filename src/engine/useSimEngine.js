import { useState, useEffect, useMemo, useCallback } from 'react';
import { buffer_capacity, initial_fill, scenario_override } from '../data/m800_model.js';

// Direct simulation edges: source buffer → destination buffer.
// Transit nodes (lifts, VRCs, ramps) are collapsed into particle travel time.
// pathId is used for 3D particle animation; fromLocId/toLocId drive layout.
const SIM_EDGES = [
  { from: '_SUPPLIER',            to: 'LOC-KMP-GF-IQC',       pathId: 'PATH-DOCK3-IQC',          processId: 'PROC-KMP-INBOUND',          rate: 0.80 },
  { from: 'LOC-KMP-GF-IQC',      to: 'LOC-KMP-FF-ESTORE',    pathId: 'PATH-IQC-LIFT-GF',         processId: 'PROC-KMP-ESTORE-PUTAWAY',   rate: 0.55 },
  { from: 'LOC-KMP-FF-ESTORE',   to: 'LOC-KMP-GF-SMT',       pathId: 'PATH-VRC-GF-SMT',          processId: 'PROC-KMP-SMT-ISSUE',        rate: 0.50 },
  { from: 'LOC-KMP-GF-SMT',      to: 'LOC-KMP-GF-FCT',       pathId: 'PATH-SMT-FCT',             processId: 'PROC-KMP-SMT',              rate: 0.45 },
  { from: 'LOC-KMP-GF-FCT',      to: 'LOC-KMP-SF-A-TRSS',    pathId: 'PATH-VRC-SF-TRSS',         processId: 'PROC-KMP-TRSS-ASSEMBLY',    rate: 0.40 },
  { from: 'LOC-KMP-SF-A-TRSS',   to: 'LOC-KMP-SF-B-WIP',     pathId: 'PATH-TRSS-BWIP',           processId: 'PROC-KMP-1P-MATL-ISSUE',    rate: 0.38 },
  { from: 'LOC-KMP-SF-B-WIP',    to: 'LOC-KMP-SF-B-1P',      pathId: 'PATH-BWIP-1P',             processId: 'PROC-KMP-1P-SPM',           rate: 0.36 },
  { from: 'LOC-KMP-SF-B-1P',     to: 'LOC-KMP-SF-SFG-PACK',  pathId: 'PATH-1P-SFG-PACK',         processId: 'PROC-KMP-SFG-BOX',          rate: 0.33 },
  { from: 'LOC-KMP-SF-SFG-PACK', to: 'LOC-WH-GF-ASRS',       pathId: 'PATH-KMP-SFG-WH-ASRS',     processId: 'PROC-WH-SFG-ASRS-PUTAWAY',  rate: 0.30 },
  { from: 'LOC-WH-GF-ASRS',      to: 'LOC-WH-GF-VC',         pathId: 'PATH-WH-ASRS-VC',          processId: 'PROC-WH-NIC-SIM-SEAL',      rate: 0.30 },
  { from: 'LOC-WH-GF-VC',        to: 'LOC-WH-GF-PACK',       pathId: 'PATH-VC-PACK',             processId: 'PROC-WH-SCREEN-LASER-HOLO', rate: 0.28 },
  { from: 'LOC-WH-GF-PACK',      to: 'LOC-WH-GF-FG-ASRS',    pathId: 'PATH-PACK-FG-ASRS',        processId: 'PROC-WH-AUTO-PACK',         rate: 0.26 },
  { from: 'LOC-WH-GF-FG-ASRS',   to: 'LOC-WH-GF-DISPATCH',   pathId: 'PATH-FG-ASRS-DISPATCH',    processId: 'PROC-WH-DISPATCH-STAGE',    rate: 0.24 },
  { from: 'LOC-WH-GF-DISPATCH',  to: '_CUSTOMER',             pathId: 'PATH-DISPATCH-CUSTOMER',   processId: 'PROC-WH-DISPATCH',          rate: 0.22 },
  // Empty bin return: KMP B-WIP → Dock3 (reverse logistics, visible as separate particle stream)
  { from: 'LOC-KMP-SF-B-WIP',    to: 'LOC-KMP-GF-DOCK3',     pathId: 'PATH-KMP-EMPTYBIN-DOCK3',  processId: 'PROC-KMP-EMPTYBIN-RETURN',  rate: 0.12 },
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
      const srcLevel = edge.from === '_SUPPLIER' ? Infinity : (next[edge.from] ?? 0);
      if (srcLevel <= 0) continue;

      // Destination capacity check
      if (edge.to !== '_CUSTOMER' && next[edge.to] !== undefined) {
        const cap = buffer_capacity[edge.to] ?? 10;
        if (next[edge.to] >= cap) continue;
      }

      if (Math.random() < rate) {
        if (edge.from !== '_SUPPLIER') next[edge.from]--;
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
