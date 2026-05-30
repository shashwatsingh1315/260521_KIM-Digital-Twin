// UnitStream.jsx — animated InstancedMesh for all in-flight units.
//
// Reads unit positions each frame from unitPositions() (via engineStateRef)
// without triggering React re-renders. Reuses the InstancedMesh + useFrame
// pattern from src/scene/ParticleStream.jsx.

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { unitPositions } from './twinLayout.js';

const MAX_UNITS = 512;
const UNIT_RADIUS = 0.25;

const dummy = new THREE.Object3D();

export default function UnitStream({ engineStateRef, nodePositions, config }) {
  const meshRef = useRef(null);

  const geometry = useMemo(() => new THREE.SphereGeometry(UNIT_RADIUS, 8, 8), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#22d3ee',
    emissive: '#0891b2',
    emissiveIntensity: 0.3,
    roughness: 0.4,
    metalness: 0.3,
  }), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || !engineStateRef?.current || !nodePositions) return;

    const state = engineStateRef.current;
    const now = state.clock.now();
    const positions = unitPositions(
      state.flowState,
      state.carrierState,
      config,
      nodePositions,
      now,
    );

    let i = 0;
    for (const [, pos] of positions) {
      if (i >= MAX_UNITS) break;
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      i++;
    }
    // Hide unused instances
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (; i < MAX_UNITS; i++) {
      mesh.setMatrixAt(i, dummy.matrix);
    }
    dummy.scale.setScalar(1);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = Math.min(positions.size, MAX_UNITS);
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_UNITS]}
      frustumCulled={false}
    />
  );
}
