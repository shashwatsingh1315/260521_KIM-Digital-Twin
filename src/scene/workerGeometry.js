// workerGeometry.js — single low-poly human figure (~1.7 m) merged into one
// BufferGeometry so a whole crew renders as one InstancedMesh draw call.
//
// Proportions (metres, y-up, feet at y=0):
//   legs   box     0 → 0.78
//   torso  capsule 0.78 → 1.38
//   head   sphere  ~1.52
// Module-scope singleton: built once at import time.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function buildWorkerGeometry() {
  const parts = [];

  // Legs — slim box.
  const legs = new THREE.BoxGeometry(0.3, 0.78, 0.2);
  legs.translate(0, 0.39, 0);
  parts.push(legs);

  // Torso — capsule (radius 0.21, mid-section 0.34).
  const torso = new THREE.CapsuleGeometry(0.21, 0.34, 3, 8);
  torso.translate(0, 1.08, 0);
  parts.push(torso);

  // Head — small sphere.
  const head = new THREE.SphereGeometry(0.15, 8, 6);
  head.translate(0, 1.53, 0);
  parts.push(head);

  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return merged ?? new THREE.CapsuleGeometry(0.25, 1.0, 3, 8);
}

export const workerGeometry = buildWorkerGeometry();
