import { useState, useEffect, useMemo, useCallback } from 'react';

// Helper to run the entire simulation from tick 0 to 100 deterministically
export function runSimulation(activeShocks = []) {
  const states = [];
  let particleIdCounter = 1;

  // Initial state at tick 0
  let state = {
    buffers: { mfg3: 5, mfg2: 5, mfg1: 5, asrs: 5 },
    particles: [],
    outflow: 0,
    rates: { mfg3: 1, mfg2: 1, mfg1: 1, asrs: 0.33 }
  };

  states.push(JSON.parse(JSON.stringify(state)));

  const isMfg2Shocked = activeShocks.includes('mfg-floor-2-jam');

  for (let t = 1; t <= 100; t++) {
    // Deep copy previous state
    const nextBuffers = { ...state.buffers };
    let nextParticles = state.particles.map(p => ({ ...p }));
    let nextOutflow = state.outflow;

    // 1. Update existing particles and transition them
    const updatedParticles = [];
    const transitionQueue = [];

    for (let p of nextParticles) {
      let isBlocked = false;

      // Apply shock conditions
      if (isMfg2Shocked) {
        if (p.type === 'mfg2_to_mfg1') {
          isBlocked = true;
        } else if (p.type === 'mfg3_to_mfg2' && p.progress >= 0.5) {
          // Blocked at gravity chute exit
          isBlocked = true;
        }
      }

      if (isBlocked) {
        p.status = 'blocked';
        updatedParticles.push(p);
      } else {
        p.status = 'moving';
        p.progress += p.speed;

        if (p.progress >= 1.0) {
          // Transition when complete
          if (p.type === 'mfg3_to_mfg2') {
            nextBuffers.mfg2 = Math.min(10, nextBuffers.mfg2 + 1);
          } else if (p.type === 'mfg2_to_mfg1') {
            nextBuffers.mfg1 = Math.min(10, nextBuffers.mfg1 + 1);
          } else if (p.type === 'mfg1_to_lift') {
            transitionQueue.push({
              id: p.id,
              type: 'lift',
              progress: 0,
              speed: 0.2,
              status: 'moving'
            });
          } else if (p.type === 'lift') {
            transitionQueue.push({
              id: p.id,
              type: 'conveyor',
              progress: 0,
              speed: 0.1, // conveyor takes 10 ticks
              status: 'moving'
            });
          } else if (p.type === 'conveyor') {
            transitionQueue.push({
              id: p.id,
              type: 'asrs',
              progress: 0,
              speed: 0.2,
              status: 'moving',
              targetFloor: (p.id % 3) + 1 // Dynamic ASRS shelf (Floor 1, 3, or 4)
            });
          } else if (p.type === 'asrs') {
            nextBuffers.asrs = Math.min(10, nextBuffers.asrs + 1);
          }
        } else {
          updatedParticles.push(p);
        }
      }
    }

    nextParticles = [...updatedParticles, ...transitionQueue];

    // 2. Process machine logic and ingestion
    // Ingestion to Floor 3 (every 2 ticks)
    if (t % 2 === 0 && nextBuffers.mfg3 < 10) {
      nextBuffers.mfg3++;
    }

    // Floor 3 processing: mfg3 -> mfg2
    if (nextBuffers.mfg3 > 0 && nextBuffers.mfg2 < 10) {
      nextBuffers.mfg3--;
      nextParticles.push({
        id: particleIdCounter++,
        type: 'mfg3_to_mfg2',
        progress: 0,
        speed: 0.2, // takes 5 ticks
        status: 'moving'
      });
    }

    // Floor 2 processing: mfg2 -> mfg1
    if (!isMfg2Shocked && nextBuffers.mfg2 > 0 && nextBuffers.mfg1 < 10) {
      nextBuffers.mfg2--;
      nextParticles.push({
        id: particleIdCounter++,
        type: 'mfg2_to_mfg1',
        progress: 0,
        speed: 0.2, // takes 5 ticks
        status: 'moving'
      });
    }

    // Floor 1 processing: mfg1 -> lift
    if (nextBuffers.mfg1 > 0 && nextBuffers.asrs < 10) {
      nextBuffers.mfg1--;
      nextParticles.push({
        id: particleIdCounter++,
        type: 'mfg1_to_lift',
        progress: 0,
        speed: 0.2, // takes 5 ticks
        status: 'moving'
      });
    }

    // ASRS consumption (pull demand): every 3 ticks
    if (t % 3 === 0 && nextBuffers.asrs > 0) {
      nextBuffers.asrs--;
      nextOutflow++;
    }

    // Calculate rates dynamically
    const rates = {
      mfg3: nextBuffers.mfg2 < 10 && nextBuffers.mfg3 > 0 ? 1 : 0,
      mfg2: !isMfg2Shocked && nextBuffers.mfg1 < 10 && nextBuffers.mfg2 > 0 ? 1 : 0,
      mfg1: nextBuffers.asrs < 10 && nextBuffers.mfg1 > 0 ? 1 : 0,
      asrs: nextBuffers.asrs > 0 ? 0.33 : 0
    };

    state = {
      buffers: nextBuffers,
      particles: nextParticles,
      outflow: nextOutflow,
      rates
    };

    states.push(state);
  }

  return states;
}

export function usePullEngine() {
  // Load initial state from local storage if available
  const [activeShocks, setActiveShocks] = useState(() => {
    try {
      const saved = localStorage.getItem('factory_pull_shocks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentTick, setCurrentTick] = useState(() => {
    try {
      const saved = localStorage.getItem('factory_pull_tick');
      return saved ? Math.min(100, Math.max(0, parseInt(saved, 10))) : 50;
    } catch {
      return 50;
    }
  });

  const [isPlaying, setIsPlaying] = useState(false);

  // Pre-calculate states whenever shocks change
  const cachedStates = useMemo(() => {
    return runSimulation(activeShocks);
  }, [activeShocks]);

  // Persist shocks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('factory_pull_shocks', JSON.stringify(activeShocks));
    } catch (e) {
      console.warn('Failed to save shocks to localStorage', e);
    }
  }, [activeShocks]);

  // Persist current tick to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('factory_pull_tick', currentTick.toString());
    } catch (e) {
      console.warn('Failed to save tick to localStorage', e);
    }
  }, [currentTick]);

  // Handle play interval loop
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTick(prev => {
        if (prev >= 100) {
          setIsPlaying(false); // Pause at 100
          return 100;
        }
        return prev + 1;
      });
    }, 1000); // 1 tick per second

    return () => clearInterval(interval);
  }, [isPlaying]);

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const setTick = useCallback((tick) => {
    setCurrentTick(Math.min(100, Math.max(0, tick)));
  }, []);

  const toggleShock = useCallback((shockId) => {
    setActiveShocks(prev =>
      prev.includes(shockId)
        ? prev.filter(id => id !== shockId)
        : [...prev, shockId]
    );
  }, []);

  const resetLive = useCallback(() => {
    setCurrentTick(100);
  }, []);

  const state = cachedStates[currentTick];

  return {
    currentTick,
    isPlaying,
    activeShocks,
    state,
    cachedStates,
    setTick,
    togglePlay,
    toggleShock,
    resetLive
  };
}
