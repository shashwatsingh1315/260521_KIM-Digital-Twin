import { Line } from '@react-three/drei';
import { useMemo } from 'react';
import { routeWaypoints } from './PathRouter.js';

// Clean path-flow overlay. Each path becomes a polyline that mirrors the
// particle routing — both consume `routeWaypoints()` from `PathRouter.js`,
// so what you see is what particles fly along. Vertical legs (lift/stair/
// bridge) get an amber tint; flat legs are cyan.
const FLOW_COLOR = '#7dd3fc';
const VERT_COLOR = '#fbbf24';

export default function FloorPaths({ path, layout, activeFloor }) {
  const items = useMemo(() => {
    const out = [];
    for (const p of path) {
      const wps = routeWaypoints(p.from_location_id, p.to_location_id, layout);
      if (wps.length < 2) continue;
      const from = layout[p.from_location_id];
      const to   = layout[p.to_location_id];
      const isVertical = from && to && Math.abs(from.y - to.y) > 0.01;
      out.push({
        path_id: p.path_id,
        status: p.status,
        points: wps,
        from, to,
        isVertical,
      });
    }
    return out;
  }, [path, layout]);

  const isPathActive = (it) => {
    if (!activeFloor || activeFloor === 'all') return true;
    if (!it.from || !it.to) return true;
    const yFor = { GF: 0, FF: 5, SF: 10, '3F': 15, '4F': 20 }[activeFloor] ?? -1;
    return it.from.y === yFor || it.to.y === yFor;
  };

  return (
    <>
      {items.map((it) => {
        const active = isPathActive(it);
        return (
          <Line
            key={it.path_id}
            points={it.points}
            color={it.isVertical ? VERT_COLOR : FLOW_COLOR}
            lineWidth={1.4}
            transparent
            opacity={active ? 0.4 : 0.08}
            dashed={it.status === 'needs-confirmation'}
            renderOrder={1}
          />
        );
      })}
    </>
  );
}
