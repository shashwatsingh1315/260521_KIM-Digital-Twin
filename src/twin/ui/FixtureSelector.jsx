// FixtureSelector.jsx — switch the mounted FactoryConfig (full engine re-init).
//
// Demonstrates the twin against the three reference topologies. Replacing the
// config re-initialises the simulation (useTwin re-inits on config identity),
// so this also resets any in-flight units, metrics, and shocks.
//
// Uses plain buttons (not a native <select>): a <select> dropdown interacts
// poorly with the continuously-rendering R3F canvas under headless automation.

import { useTwinContext } from './TwinProvider.jsx';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';
import { makeAssemblyLineFixture } from '../fixtures/assemblyLine.js';
import { makeCarrierLineFixture } from '../fixtures/carrierLine.js';

const FIXTURES = {
  linearLine: { label: 'Linear line', make: makeLinearLineFixture },
  assemblyLine: { label: 'Assembly + QC', make: makeAssemblyLineFixture },
  carrierLine: { label: 'Carrier (AMR)', make: makeCarrierLineFixture },
};

export default function FixtureSelector({ value, onChange }) {
  const { setConfig } = useTwinContext();

  const select = (key) => {
    const entry = FIXTURES[key];
    if (!entry || !setConfig) return;
    setConfig(entry.make());
    onChange?.(key);
  };

  return (
    <div
      data-testid="fixture-selector"
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(12,19,34,0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #1e3a5f',
        borderRadius: 8,
        padding: '6px 10px',
        color: '#cbd5e1',
        zIndex: 100,
      }}
    >
      <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginRight: 2 }}>
        Scenario
      </span>
      {Object.entries(FIXTURES).map(([key, { label }]) => {
        const active = value === key;
        return (
          <button
            key={key}
            data-testid={`fixture-${key}`}
            onClick={() => select(key)}
            style={{
              padding: '3px 10px',
              borderRadius: 4,
              border: `1px solid ${active ? '#3b82f6' : 'transparent'}`,
              background: active ? '#1e40af' : '#1e293b',
              color: active ? '#93c5fd' : '#64748b',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'monospace',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
