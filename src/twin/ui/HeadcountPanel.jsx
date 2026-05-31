// HeadcountPanel.jsx — shows peopleRequired, amrFleet, carrier utilization.

import { useTwinContext } from './TwinProvider.jsx';

export default function HeadcountPanel() {
  const { twinHook } = useTwinContext();
  const { metrics } = twinHook;

  if (!metrics) return null;

  const { peopleRequired = 0, amrFleet = 0, carrierUtilization = {} } = metrics;

  return (
    <div
      data-testid="headcount-panel"
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        background: 'rgba(12,19,34,0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #1e3a5f',
        borderRadius: 8,
        padding: '10px 14px',
        color: '#cbd5e1',
        zIndex: 100,
        minWidth: 180,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>
        Resources
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
            {peopleRequired}
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>People</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#a78bfa', fontFamily: 'monospace' }}>
            {amrFleet}
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>AMR Fleet</div>
        </div>
      </div>

      {Object.keys(carrierUtilization).length > 0 && (
        <>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
            Carrier Utilization
          </div>
          {Object.entries(carrierUtilization).map(([segId, util]) => (
            <div key={segId} style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>
                <span style={{ fontFamily: 'monospace' }}>{segId}</span>
                <span>{Math.round(util * 100)}%</span>
              </div>
              <div style={{ background: '#1e293b', borderRadius: 2, height: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, util * 100)}%`,
                    height: '100%',
                    background: util > 0.8 ? '#ef4444' : util > 0.5 ? '#f59e0b' : '#10b981',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
