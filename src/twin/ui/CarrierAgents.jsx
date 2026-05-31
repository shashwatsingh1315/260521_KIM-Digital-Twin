// CarrierAgents.jsx — InstancedMesh showing each carrier's position and state.
//
// States:
//   idle         → grey   (#94a3b8)
//   loaded       → blue   (#2563eb)
//   held_at_dest → red    (#dc2626)
//   returning    → dim-blue (#7dd3fc)

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MAX_CARRIERS = 64;
const dummy = new THREE.Object3D();

const STATE_COLORS = {
  idle:         new THREE.Color('#94a3b8'),
  loaded:       new THREE.Color('#2563eb'),
  held_at_dest: new THREE.Color('#dc2626'),
  returning:    new THREE.Color('#7dd3fc'),
};

export default function CarrierAgents({ engineStateRef, nodePositions, config }) {
  const meshRef = useRef(null);
  const geometry = useMemo(() => new THREE.BoxGeometry(0.4, 0.3, 0.6), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    roughness: 0.5,
    metalness: 0.4,
  }), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || !engineStateRef?.current || !nodePositions) return;

    const state = engineStateRef.current;
    const now = state.clock.now();
    let i = 0;

    for (const [, entry] of state.carrierState.pools) {
      const { seg, carriers } = entry;
      const fromPos = nodePositions.get(seg.from_node_id);
      const toPos   = nodePositions.get(seg.to_node_id);
      if (!fromPos || !toPos) continue;

      for (const carrier of carriers) {
        if (i >= MAX_CARRIERS) break;

        let x, y, z;
        const idx = carriers.indexOf(carrier);
        const offset = (idx - Math.floor(carriers.length / 2)) * 0.8;

        if (carrier.state === 'idle') {
          x = fromPos.x; y = fromPos.y + 0.8; z = fromPos.z + offset;
        } else if (carrier.state === 'loaded') {
          // Lerp from source to dest based on drop_at
          const loadSec = seg.length_m / ((entry.pool.speed_loaded_m_per_min || 30) / 60);
          const start = carrier.drop_at - loadSec;
          const t = Math.max(0, Math.min(1, (now - start) / loadSec));
          x = fromPos.x + (toPos.x - fromPos.x) * t;
          y = fromPos.y + 1.0 + (toPos.y - fromPos.y) * t;
          z = fromPos.z + (toPos.z - fromPos.z) * t;
        } else if (carrier.state === 'held_at_dest') {
          x = toPos.x; y = toPos.y + 1.0; z = toPos.z + offset;
        } else { // returning
          const returnSec = seg.length_m / ((entry.pool.speed_empty_m_per_min || 40) / 60);
          const start = carrier.free_at - returnSec;
          const t = Math.max(0, Math.min(1, (now - start) / returnSec));
          x = toPos.x + (fromPos.x - toPos.x) * t;
          y = toPos.y + 0.8 + (fromPos.y - toPos.y) * t;
          z = toPos.z + (fromPos.z - toPos.z) * t;
        }

        dummy.position.set(x, y, z);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        const color = STATE_COLORS[carrier.state] ?? STATE_COLORS.idle;
        mesh.setColorAt(i, color);
        i++;
      }
    }

    // Hide unused instances
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (; i < MAX_CARRIERS; i++) {
      mesh.setMatrixAt(i, dummy.matrix);
    }
    dummy.scale.setScalar(1);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = Math.min(i, MAX_CARRIERS);
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_CARRIERS]}
      frustumCulled={false}
    />
  );
}
