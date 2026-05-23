import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { routeWaypoints, pointAt, arcLengths } from './PathRouter.js';

const MAX_PARTICLES = 150;
const DUMMY = new THREE.Object3D();

function particleColor(pathId) {
  if (pathId.includes('LIFT') || pathId.includes('VRC'))  return '#f59e0b';
  if (pathId.includes('RAMP') || pathId.includes('SFG'))  return '#a78bfa';
  if (pathId.includes('SMT')  || pathId.includes('FCT'))  return '#22d3ee';
  if (pathId.includes('WH-ASRS'))                          return '#3b82f6';
  if (pathId.includes('DISPATCH'))                         return '#34d399';
  return '#94a3b8';
}

export default function ParticleStream({ simState, pathSegments, layout, paths = [] }) {
  const meshRef    = useRef();
  const prevPosRef = useRef(new Map());

  // Pre-compute waypoints + arc-lengths for every declared path so we don't
  // re-route every frame. Particles whose pathId isn't in here fall back to
  // an on-the-fly route from fromLocId/toLocId.
  const pathCache = useMemo(() => {
    const cache = {};
    for (const p of paths) {
      const wps = routeWaypoints(p.from_location_id, p.to_location_id, layout);
      if (wps.length >= 2) cache[p.path_id] = { wps, cum: arcLengths(wps) };
    }
    return cache;
  }, [paths, layout]);

  useFrame(() => {
    if (!meshRef.current || !simState) return;
    const particles = simState.particles || [];
    const count = Math.min(particles.length, MAX_PARTICLES);
    const currentPos = new Map();

    for (let i = 0; i < count; i++) {
      const p = particles[i];
      let entry = pathCache[p.pathId];
      if (!entry && p.fromLocId && p.toLocId) {
        const wps = routeWaypoints(p.fromLocId, p.toLocId, layout);
        if (wps.length >= 2) entry = { wps, cum: arcLengths(wps) };
      }
      if (!entry) continue;

      const target = pointAt(entry.wps, p.progress, entry.cum);
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
      <sphereGeometry args={[0.22, 16, 16]} />
      <meshStandardMaterial
        emissive="#ffffff"
        emissiveIntensity={0.45}
        roughness={0.35}
        metalness={0.2}
      />
    </instancedMesh>
  );
}
