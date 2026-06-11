// WorkerAgents.jsx — instanced worker figures standing at staffed stations.
//
// Headcount per station derives from operators_per_slot × effectiveSlots, the
// same formula behind metrics.peopleRequired, so the crew on the floor matches
// the Resources tab. Each frame the busy slot count for the station decides
// how many of its workers are "working": those tint hi-vis amber and bob
// gently; the rest idle in slate. Placement is config-static (memoized);
// only colors and the bob offset update per frame.

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { effectiveSlots } from '../engine/derive.js';
import { workerGeometry } from '../../scene/workerGeometry.js';

const MAX_WORKERS = 256;
const PER_STATION_CAP = 12;
const ARC_RADIUS = 3.0;
const ARC_SPREAD = Math.PI * 0.9; // ~160° arc in front of the station

const dummy = new THREE.Object3D();
const COLOR_WORKING = new THREE.Color('#fbbf24'); // hi-vis amber (T.family.logistics)
const COLOR_IDLE = new THREE.Color('#64748b');    // slate

export default function WorkerAgents({ config, nodePositions, engineStateRef, onHoverWorker }) {
  const meshRef = useRef(null);
  // Per-instance working flag from the previous frame — colors are only
  // rewritten on a state flip, not every frame.
  const stateRef = useRef(new Int8Array(MAX_WORKERS).fill(-1));
  const hoveredRef = useRef(null);

  // Static placement: workers stand in an arc on the aisle side of their
  // station. Recomputed only when the config/layout changes.
  const { workers, overflow } = useMemo(() => {
    const list = [];
    const over = [];
    if (!nodePositions) return { workers: list, overflow: over };

    for (const station of config.stations) {
      const pos = nodePositions.get(station.node_id);
      if (!pos) continue;

      let staffed = 0;
      for (const sp of station.processes) {
        const ops = sp.operators_per_slot ?? 0;
        if (ops === 0) continue;
        staffed += ops * effectiveSlots(sp.parallel_slots ?? 1, ops);
      }
      staffed = Math.round(staffed);
      if (staffed <= 0) continue;

      const shown = Math.min(staffed, PER_STATION_CAP);
      if (staffed > shown) over.push({ stationId: station.id, pos, extra: staffed - shown });

      for (let i = 0; i < shown; i++) {
        if (list.length >= MAX_WORKERS) break;
        const a = shown === 1 ? 0 : -ARC_SPREAD / 2 + (i / (shown - 1)) * ARC_SPREAD;
        const wx = pos.x + Math.sin(a) * ARC_RADIUS;
        const wz = pos.z + Math.cos(a) * ARC_RADIUS;
        list.push({
          stationId: station.id,
          stationName: station.name,
          x: wx,
          y: pos.y,
          z: wz,
          rotY: Math.atan2(pos.x - wx, pos.z - wz), // face the station
          bobPhase: list.length * 1.7,
        });
      }
      if (list.length >= MAX_WORKERS) break;
    }
    return { workers: list, overflow: over };
  }, [config, nodePositions]);

  // Per-station slot keys for the busy lookup ("stationId|processId").
  const stationSlotMeta = useMemo(() => {
    const m = new Map();
    for (const station of config.stations) {
      m.set(station.id, station.processes.map((sp) => ({
        key: `${station.id}|${sp.process_id}`,
        ops: sp.operators_per_slot ?? 0,
      })));
    }
    return m;
  }, [config]);

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.75,
    metalness: 0.05,
  }), []);

  // Prime instance colors so instanceColor exists before the first frame.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < MAX_WORKERS; i++) mesh.setColorAt(i, COLOR_IDLE);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    stateRef.current.fill(-1);
  }, [workers]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const slots = engineStateRef?.current?.schedulerState?.slots;
    const t = clock.elapsedTime;

    // Working operators per station this frame: busy slots × ops/slot.
    const workingByStation = new Map();
    if (slots) {
      for (const [stationId, metas] of stationSlotMeta) {
        let working = 0;
        for (const meta of metas) {
          if (meta.ops === 0) continue;
          const slotArr = slots.get(meta.key);
          if (!slotArr) continue;
          let busy = 0;
          for (const s of slotArr) if (s.busy) busy++;
          working += busy * meta.ops;
        }
        workingByStation.set(stationId, Math.ceil(working));
      }
    }

    const seen = new Map(); // stationId → workers placed so far
    let colorDirty = false;
    for (let i = 0; i < workers.length; i++) {
      const w = workers[i];
      const placed = seen.get(w.stationId) ?? 0;
      seen.set(w.stationId, placed + 1);
      const working = placed < (workingByStation.get(w.stationId) ?? 0);

      const bob = working ? Math.abs(Math.sin(t * 3 + w.bobPhase)) * 0.06 : 0;
      dummy.position.set(w.x, w.y + bob, w.z);
      dummy.rotation.set(0, w.rotY, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const flag = working ? 1 : 0;
      if (stateRef.current[i] !== flag) {
        stateRef.current[i] = flag;
        mesh.setColorAt(i, working ? COLOR_WORKING : COLOR_IDLE);
        colorDirty = true;
      }
    }
    // Hide unused instances.
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = workers.length; i < MAX_WORKERS; i++) mesh.setMatrixAt(i, dummy.matrix);
    dummy.scale.setScalar(1);

    mesh.instanceMatrix.needsUpdate = true;
    if (colorDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = Math.min(workers.length, MAX_WORKERS);
  });

  const handleOver = (e) => {
    e.stopPropagation();
    const w = workers[e.instanceId];
    if (!w || hoveredRef.current === e.instanceId) return;
    hoveredRef.current = e.instanceId;
    onHoverWorker?.({
      stationId: w.stationId,
      stationName: w.stationName,
      working: stateRef.current[e.instanceId] === 1,
    });
  };

  const handleOut = () => {
    if (hoveredRef.current == null) return;
    hoveredRef.current = null;
    onHoverWorker?.(null);
  };

  if (workers.length === 0) return null;

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[workerGeometry, material, MAX_WORKERS]}
        frustumCulled={false}
        onPointerOver={onHoverWorker ? handleOver : undefined}
        onPointerOut={onHoverWorker ? handleOut : undefined}
      />
      {/* "+N more" chips where the per-station render cap kicked in */}
      {overflow.map((o) => (
        <Html key={o.stationId} position={[o.pos.x + ARC_RADIUS, o.pos.y + 2.1, o.pos.z]} center distanceFactor={26} zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(10,17,32,0.8)', border: '1px solid rgba(251,191,36,0.35)',
            borderRadius: 8, padding: '1px 6px', fontSize: 9, fontWeight: 700,
            color: '#fbbf24', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            whiteSpace: 'nowrap',
          }}>
            +{o.extra} crew
          </div>
        </Html>
      ))}
    </>
  );
}
