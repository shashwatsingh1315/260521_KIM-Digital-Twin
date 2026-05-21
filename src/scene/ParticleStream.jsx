import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MAX_PARTICLES = 600;
const DUMMY = new THREE.Object3D();

function particleColor(pathId) {
  if (pathId.includes('LIFT') || pathId.includes('VRC'))  return '#f59e0b';
  if (pathId.includes('RAMP') || pathId.includes('SFG'))  return '#a78bfa';
  if (pathId.includes('SMT')  || pathId.includes('FCT'))  return '#22d3ee';
  if (pathId.includes('WH-ASRS'))                          return '#3b82f6';
  if (pathId.includes('DISPATCH'))                         return '#34d399';
  return '#94a3b8';
}

export default function ParticleStream({ simState, pathSegments, layout }) {
  const meshRef   = useRef();
  const prevPosRef = useRef(new Map());

  useFrame(() => {
    if (!meshRef.current || !simState) return;
    const particles = simState.particles || [];
    const count = Math.min(particles.length, MAX_PARTICLES);
    const currentPos = new Map();

    for (let i = 0; i < count; i++) {
      const p = particles[i];
      let seg = pathSegments[p.pathId];
      if (!seg && p.fromLocId && p.toLocId && layout[p.fromLocId] && layout[p.toLocId]) {
        const f = layout[p.fromLocId];
        const t = layout[p.toLocId];
        seg = {
          start: new THREE.Vector3(f.x, f.y + 0.5, f.z),
          end:   new THREE.Vector3(t.x, t.y + 0.5, t.z),
        };
      }
      if (!seg) continue;

      const target = new THREE.Vector3().lerpVectors(seg.start, seg.end, p.progress);
      const prev   = prevPosRef.current.get(p.id);
      const pos    = prev ? prev.clone().lerp(target, 0.25) : target.clone();
      currentPos.set(p.id, pos);

      DUMMY.position.copy(pos);
      DUMMY.updateMatrix();
      meshRef.current.setMatrixAt(i, DUMMY.matrix);

      const c = new THREE.Color(p.status === 'blocked' ? '#ef4444' : particleColor(p.pathId));
      meshRef.current.setColorAt(i, c);
    }
    prevPosRef.current = currentPos;
    meshRef.current.count = count;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, MAX_PARTICLES]} renderOrder={3}>
      <sphereGeometry args={[0.25, 8, 8]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}
