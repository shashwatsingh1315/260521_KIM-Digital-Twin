import { Line } from '@react-three/drei';
import * as THREE from 'three';

export default function FloorPaths({ path, layout }) {
  return (
    <>
      {path.map(p => {
        const from = layout[p.from_location_id];
        const to   = layout[p.to_location_id];
        if (!from || !to) return null;
        const points = [
          new THREE.Vector3(from.x, from.y + 0.5, from.z),
          new THREE.Vector3(to.x,   to.y   + 0.5, to.z),
        ];
        return (
          <Line
            key={p.path_id}
            points={points}
            color="#1e293b"
            lineWidth={1}
            dashed={p.status === 'needs-confirmation'}
            renderOrder={1}
          />
        );
      })}
    </>
  );
}
