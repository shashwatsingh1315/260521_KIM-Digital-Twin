import { expect, test, describe } from 'vitest';
import { runSimulation } from './usePullEngine';

describe('usePullEngine deterministic simulation', () => {
  test('should generate 101 states (tick 0 to 100)', () => {
    const states = runSimulation([]);
    expect(states).toHaveLength(101);
  });

  test('normal flow should increase total outflow over time', () => {
    const states = runSimulation([]);
    const state0 = states[0];
    const state100 = states[100];
    
    expect(state100.outflow).toBeGreaterThan(state0.outflow);
  });

  test('shock at mfg2 should halt mfg2_to_mfg1 particles', () => {
    const states = runSimulation(['mfg-floor-2-jam']);
    
    // Check state around tick 50
    const state50 = states[50];
    
    // There should be blocked particles
    const hasBlocked = state50.particles.some(p => p.status === 'blocked');
    expect(hasBlocked).toBe(true);
    
    // Outflow should be lower than happy path because ASRS will eventually starve
    const happyStates = runSimulation([]);
    expect(state50.outflow).toBeLessThanOrEqual(happyStates[50].outflow);
  });
});
