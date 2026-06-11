// WipHeatmap.jsx — per-station buffer fullness content for the right rail.

import { useTwinContext } from './TwinProvider.jsx';
import { fillStateColor } from '../../materials/factoryMaterials.js';
import { T, EmptyState } from './kit.jsx';

export default function WipHeatmapContent() {
  const { config, twinHook } = useTwinContext();
  const { metrics } = twinHook;

  if (!metrics) {
    return (
      <div data-testid="wip-heatmap">
        <EmptyState message="Waiting for simulation data…" />
      </div>
    );
  }

  const { bufferFullness } = metrics;

  return (
    <div data-testid="wip-heatmap" style={{ padding: '10px 12px' }}>
      {config.stations.map((station) => {
        const ratio = bufferFullness?.[station.id] ?? 0;
        const cap = station.processes?.reduce((acc, p) => acc + (p.parallel_slots ?? 1), 0) || 1;
        const filled = Math.round(ratio * cap);
        const color = fillStateColor(ratio);

        return (
          <div
            key={station.id}
            data-testid={`fill-${station.id}`}
            data-fill={ratio.toFixed(3)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}
          >
            <div
              style={{
                width: 10, height: 10, borderRadius: '50%',
                background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, fontFamily: T.sans, color: T.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{station.name}</span>
            <span style={{ color, fontFamily: T.mono, fontSize: 12 }}>
              {filled}/{cap}
            </span>
          </div>
        );
      })}

      {/* Threshold legend */}
      <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 10, color: T.textFaint, borderTop: `1px solid ${T.borderSoft}`, paddingTop: 6, fontFamily: T.sans }}>
        <LegendDot color={T.state.ok} label="Low" />
        <LegendDot color={T.state.warn} label="Medium" />
        <LegendDot color={T.state.alert} label="High/Full" />
      </div>
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
