// UnitStream.jsx — animated InstancedMesh for all in-flight units.
//
// Reads unit render entries each frame from unitRenderList() (via
// engineStateRef) without triggering React re-renders. Per-instance colors:
// default cyan; when an order is highlighted its units take the order color
// and everything else dims. Hovering an instance reports the unit's identity
// (id / order / material) for the scene tooltip.

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { unitRenderList } from './twinLayout.js';
import { orderThree } from './orderColors.js';

const MAX_UNITS = 512;
const UNIT_RADIUS = 0.4;

const dummy = new THREE.Object3D();
const COLOR_DEFAULT = new THREE.Color('#22d3ee');
const COLOR_DIM = new THREE.Color('#27364f');

export default function UnitStream({ engineStateRef, nodePositions, config, highlightOrderId, onHoverUnit }) {
  const meshRef = useRef(null);
  // instance index → unit object for the frame most recently rendered.
  const unitsRef = useRef([]);
  const hoveredIdRef = useRef(null);

  // Order id → palette index, matching the dashboard swatches (positional).
  const orderIndex = useMemo(
    () => new Map((config.orders ?? []).map((o, i) => [o.id, i])),
    [config],
  );

  const geometry = useMemo(() => new THREE.SphereGeometry(UNIT_RADIUS, 12, 8), []);
  // Base color stays white — per-instance colors carry the actual tint.
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#22d3ee',
    emissiveIntensity: 0.45,
    roughness: 0.3,
    metalness: 0.35,
  }), []);

  // Prime instance colors once so instanceColor exists before the first frame.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < MAX_UNITS; i++) mesh.setColorAt(i, COLOR_DEFAULT);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || !engineStateRef?.current || !nodePositions) return;

    const state = engineStateRef.current;
    const now = state.clock.now();
    const entries = unitRenderList(
      state.flowState,
      state.carrierState,
      config,
      nodePositions,
      now,
    );

    const units = unitsRef.current;
    let i = 0;
    for (const e of entries) {
      if (i >= MAX_UNITS) break;
      dummy.position.set(e.x, e.y, e.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      units[i] = e.unit;

      let color = COLOR_DEFAULT;
      if (highlightOrderId) {
        color = e.unit.order_id === highlightOrderId
          ? orderThree(orderIndex.get(e.unit.order_id) ?? 0)
          : COLOR_DIM;
      }
      mesh.setColorAt(i, color);
      i++;
    }
    const visible = i;
    // Hide unused instances
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (; i < MAX_UNITS; i++) {
      mesh.setMatrixAt(i, dummy.matrix);
      units[i] = null;
    }
    dummy.scale.setScalar(1);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = Math.min(visible, MAX_UNITS);
  });

  const handleOver = (e) => {
    e.stopPropagation();
    const unit = unitsRef.current[e.instanceId];
    if (!unit || unit.id === hoveredIdRef.current) return;
    hoveredIdRef.current = unit.id;
    onHoverUnit?.({
      unitId: unit.id,
      orderId: unit.order_id,
      material: unit.material,
      nextProcess: unit.next_process ?? null,
    });
  };

  const handleOut = () => {
    if (hoveredIdRef.current == null) return;
    hoveredIdRef.current = null;
    onHoverUnit?.(null);
  };

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_UNITS]}
      frustumCulled={false}
      onPointerOver={onHoverUnit ? handleOver : undefined}
      onPointerOut={onHoverUnit ? handleOut : undefined}
    />
  );
}
