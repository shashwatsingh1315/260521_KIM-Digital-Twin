// WipHeatmap.jsx — floating panel showing per-station buffer fullness.

import { useTwinContext } from './TwinProvider.jsx';
import { fillStateColor } from '../../materials/factoryMaterials.js';

export default function WipHeatmap() {
  const { config, twinHook } = useTwinContext();
  const { metrics } = twinHook;

  if (!metrics) return null;

  const { bufferFullness } = metrics;

  return (
    <div
      data-testid="wip-heatmap"
      style={{
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box',
        background: 'rgba(12,19,34,0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #1e3a5f',
        borderRadius: 8,
        padding: '10px 14px',
        color: '#cbd5e1',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>
        WIP / Buffer
      </div>
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
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
              fontSize: 13,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color,
                boxShadow: `0 0 6px ${color}`,
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, fontFamily: 'monospace' }}>{station.name}</span>
            <span style={{ color, fontFamily: 'monospace', fontSize: 12 }}>
              {filled}/{cap}
            </span>
          </div>
        );
      })}
    </div>
  );
}
