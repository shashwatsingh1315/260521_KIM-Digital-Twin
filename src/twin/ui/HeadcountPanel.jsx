// HeadcountPanel.jsx — resources content for the right rail: peopleRequired,
// AMR fleet, and carrier utilization. The figure shown for "People on floor"
// matches the worker meshes rendered in the 3D scene (both derive from
// operators_per_slot × effective slots).

import { useTwinContext } from './TwinProvider.jsx';
import { T, EmptyState } from './kit.jsx';

export default function HeadcountContent() {
  const { twinHook } = useTwinContext();
  const { metrics } = twinHook;

  if (!metrics) {
    return (
      <div data-testid="headcount-panel">
        <EmptyState message="Waiting for simulation data…" />
      </div>
    );
  }

  const { peopleRequired = 0, amrFleet = 0, carrierUtilization = {} } = metrics;

  return (
    <div data-testid="headcount-panel" style={{ padding: '10px 12px' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.cyan, fontFamily: T.display }}>
            {peopleRequired}
          </div>
          <div style={{ fontSize: 11, color: T.textFaint, fontFamily: T.sans }}>People on floor</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.violet, fontFamily: T.display }}>
            {amrFleet}
          </div>
          <div style={{ fontSize: 11, color: T.textFaint, fontFamily: T.sans }}>AMR Fleet</div>
        </div>
      </div>

      {Object.keys(carrierUtilization).length > 0 && (
        <>
          <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1, fontFamily: T.display, fontWeight: 700 }}>
            Carrier Utilization
          </div>
          {Object.entries(carrierUtilization).map(([segId, util]) => (
            <div key={segId} style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.textDim, marginBottom: 2 }}>
                <span style={{ fontFamily: T.mono }}>{segId}</span>
                <span style={{ fontFamily: T.mono }}>{Math.round(util * 100)}%</span>
              </div>
              <div style={{ background: T.borderSoft, borderRadius: 2, height: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, util * 100)}%`,
                    height: '100%',
                    background: util > 0.8 ? T.state.alert : util > 0.5 ? T.state.warn : T.state.ok,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          ))}

          {/* Utilization legend */}
          <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 10, color: T.textFaint, fontFamily: T.sans }}>
            <LegendDot color={T.state.ok} label="<50%" />
            <LegendDot color={T.state.warn} label="50-80%" />
            <LegendDot color={T.state.alert} label=">80%" />
          </div>
        </>
      )}
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}
