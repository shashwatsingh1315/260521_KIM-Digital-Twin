// FixtureSelector.jsx — switch the mounted FactoryConfig (full engine re-init).
//
// Demonstrates the twin against the three reference topologies. Replacing the
// config re-initialises the simulation (useTwin re-inits on config identity),
// so this also resets any in-flight units, metrics, and shocks.
//
// Uses plain buttons (not a native <select>): a <select> dropdown interacts
// poorly with the continuously-rendering R3F canvas under headless automation.

import { useTwinContext } from './TwinProvider.jsx';
import { T, Tooltip } from './kit.jsx';
import { makeLinearLineFixture } from '../fixtures/linearLine.js';
import { makeAssemblyLineFixture } from '../fixtures/assemblyLine.js';
import { makeCarrierLineFixture } from '../fixtures/carrierLine.js';

const FIXTURES = {
  linearLine: { label: 'Linear line', make: makeLinearLineFixture, tip: 'Single production line with inspection stations' },
  assemblyLine: { label: 'Assembly + QC', make: makeAssemblyLineFixture, tip: 'Multi-branch assembly with quality control' },
  carrierLine: { label: 'Carrier (AMR)', make: makeCarrierLineFixture, tip: 'AMR-based carrier transport between stations' },
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
        background: T.surface,
        backdropFilter: 'blur(8px)',
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        padding: '6px 10px',
        color: T.textDim,
        zIndex: T.z.rail,
      }}
    >
      <span style={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginRight: 2, fontFamily: T.display, fontWeight: 700 }}>
        Scenario
      </span>
      {Object.entries(FIXTURES).map(([key, { label, tip }]) => {
        const active = value === key;
        return (
          <Tooltip key={key} text={tip}>
            <button
              data-testid={`fixture-${key}`}
              onClick={() => select(key)}
              title={tip}
              style={{
                padding: '3px 10px',
                borderRadius: 4,
                border: `1px solid ${active ? T.accent : 'transparent'}`,
                background: active ? T.accentDeep : T.borderSoft,
                color: active ? '#93c5fd' : T.textFaint,
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: T.sans,
                fontWeight: 600,
                transition: `background ${T.transition}, color ${T.transition}`,
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = T.textDim; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = T.textFaint; }}
            >
              {label}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
