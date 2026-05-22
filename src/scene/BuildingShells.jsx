import * as THREE from 'three';
import { MAT } from '../materials/factoryMaterials.js';

export const KMP_BOUNDS = { x: -16, z: 0, w: 38, d: 10, floors: 4, floorH: 5 };
export const WH_BOUNDS  = { x: 22,  z: 1.5, w: 28, d: 12, h: 25 };

function BuildingVolume({ bounds, label }) {
  const { x, z, w, d } = bounds;
  const h = bounds.h ?? bounds.floors * bounds.floorH;
  return (
    <group position={[x, h / 2, z]}>
      <mesh>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial
          color="#3a4a6b"
          transparent
          opacity={0.05}
          depthWrite={false}
        />
      </mesh>
      {/* Edge outline — uses three.js EdgesGeometry */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(w, h, d)]} />
        <lineBasicMaterial color="#475569" transparent opacity={0.4} />
      </lineSegments>
    </group>
  );
}

export default function BuildingShells() {
  return (
    <group>
      <BuildingVolume bounds={KMP_BOUNDS} label="KMP" />
      <BuildingVolume bounds={WH_BOUNDS} label="WH" />
    </group>
  );
}
