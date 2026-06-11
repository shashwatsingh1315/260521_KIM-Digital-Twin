// TrackSegmentLines.jsx — renders track segments as colored lines with
// direction-of-flow arrows and hover hit-zones.
//
// Color encodes occupancy: green (empty) → amber (>50%) → red (full/held).
// Carrier segments rendered as a thicker tube. A single InstancedMesh of
// small cones drifts along every path each frame (one draw call) so the
// direction and motion of flow is visible at a glance. Each segment also
// carries an invisible fat tube so hovering the thin line is easy — the
// parent receives onHoverSegment(segId|null) for the scene tooltip.

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { fillStateColor } from '../../materials/factoryMaterials.js';
import { orthogonalPath, interpolateOrthogonal } from './twinLayout.js';
import { T } from './kit.jsx';

// ─── Material flow labels for key segments ───────────────────────────────────
const SEGMENT_LABELS = {
  seg_sup_junc:   { text: 'Raw PCBs & Components',  color: T.family.production },
  seg_iqc_smt:    { text: 'Inspected PCBs',          color: T.family.production },
  seg_fct_1p:     { text: 'Tested PCBA → Assembly',  color: T.family.production },
  seg_trss_in:    { text: 'TRSS Parts Kit',           color: T.family.logistics },
  seg_plastic_1p: { text: 'Plastic / BOP Kit',        color: T.family.logistics },
  seg_sfg_asrs:   { text: 'SFG Pallets → Warehouse',  color: T.family.storage },
  seg_nic_vc:     { text: 'NIC + SIM Kit',             color: T.family.logistics },
  seg_vc_screen:  { text: 'VC Meters → Packaging',    color: T.family.production },
  seg_pack_fat:   { text: 'Packed FG → Quality',      color: T.family.inspect },
  seg_fat_cust:   { text: 'Finished Goods → Dispatch', color: T.green },
};

function segmentOccupancy(flowState, segId, capacity) {
  if (!flowState) return 0;
  const inTransit = flowState.segmentUnits?.get(segId)?.length ?? 0;
  const held = flowState.segmentHeld?.get(segId)?.length ?? 0;
  return capacity > 0 ? (inTransit + held) / capacity : 0;
}

function SegmentLine({ segment, fromPos, toPos, occupancy, onHoverSegment }) {
  const color = fillStateColor(occupancy);
  const isCarrier = segment.transport?.class === 'carrier';

  const points = useMemo(() => {
    const raw = orthogonalPath(fromPos, toPos);
    return raw.map(p => new THREE.Vector3(p.x, p.y + 0.05, p.z));
  }, [fromPos, toPos]);

  // Carrier tube geometry — computed unconditionally (Rules of Hooks); only
  // mounted in the carrier branch below.
  const tubeGeom = useMemo(() => {
    const curvePts = points.map(p => new THREE.Vector3(p.x, p.y + 1.45, p.z));
    // Use chordal tension to prevent wild overshoots on 90 degree corners
    const curve = new THREE.CatmullRomCurve3(curvePts, false, 'chordal', 0.2);
    return new THREE.TubeGeometry(curve, curvePts.length * 4, 0.08, 6, false);
  }, [points]);

  // Invisible fat hit-tube along the visible path so the thin line is easy to
  // hover. Raycasting <line> primitives is unreliable, hence the proxy mesh.
  const hitGeom = useMemo(() => {
    const lift = isCarrier ? 1.45 : 0.1;
    const curvePts = points.map(p => new THREE.Vector3(p.x, p.y + lift, p.z));
    const curve = new THREE.CatmullRomCurve3(curvePts, false, 'chordal', 0.2);
    return new THREE.TubeGeometry(curve, curvePts.length * 2, 0.6, 5, false);
  }, [points, isCarrier]);

  const posArray = useMemo(() => {
    const arr = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      arr[i * 3] = points[i].x;
      arr[i * 3 + 1] = points[i].y;
      arr[i * 3 + 2] = points[i].z;
    }
    return arr;
  }, [points]);

  const hitHandlers = onHoverSegment ? {
    onPointerOver: (e) => { e.stopPropagation(); onHoverSegment(segment.id); },
    onPointerOut: (e) => { e.stopPropagation(); onHoverSegment(null); },
  } : {};

  return (
    <>
      {isCarrier ? (
        <mesh geometry={tubeGeom}>
          <meshBasicMaterial color={color} />
        </mesh>
      ) : (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={points.length}
              array={posArray}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={color} linewidth={2} />
        </line>
      )}
      {/* visible={false} skips rasterization entirely; three's raycaster
          still intersects invisible meshes, so hover keeps working. */}
      <mesh geometry={hitGeom} visible={false} {...hitHandlers}>
        <meshBasicMaterial />
      </mesh>
    </>
  );
}

// ─── Animated flow-direction arrows (one InstancedMesh for all segments) ─────
const ARROWS_PER_SEGMENT = 2;
const ARROW_SPEED = 0.06; // path fractions per second
const arrowDummy = new THREE.Object3D();
const UP = new THREE.Vector3(0, 1, 0);
const tangent = new THREE.Vector3();

function FlowArrows({ segments, nodePositions }) {
  const meshRef = useRef(null);

  const paths = useMemo(() => {
    const out = [];
    for (const seg of segments) {
      const from = nodePositions.get(seg.from_node_id);
      const to = nodePositions.get(seg.to_node_id);
      if (!from || !to) continue;
      const lift = seg.transport?.class === 'carrier' ? 1.5 : 0.35;
      const pts = orthogonalPath(from, to).map(p => ({ x: p.x, y: p.y + lift, z: p.z }));
      out.push(pts);
    }
    return out;
  }, [segments, nodePositions]);

  const count = paths.length * ARROWS_PER_SEGMENT;
  const geometry = useMemo(() => new THREE.ConeGeometry(0.16, 0.5, 5), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#7dd3fc', transparent: true, opacity: 0.55, depthWrite: false,
  }), []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;
    const t = clock.elapsedTime * ARROW_SPEED;
    let idx = 0;
    for (const pts of paths) {
      for (let k = 0; k < ARROWS_PER_SEGMENT; k++) {
        const frac = (k / ARROWS_PER_SEGMENT + t) % 1;
        const pos = interpolateOrthogonal(pts, frac);
        const ahead = interpolateOrthogonal(pts, Math.min(1, frac + 0.02));
        tangent.set(ahead.x - pos.x, ahead.y - pos.y, ahead.z - pos.z);
        arrowDummy.position.set(pos.x, pos.y, pos.z);
        if (tangent.lengthSq() > 1e-8) {
          tangent.normalize();
          arrowDummy.quaternion.setFromUnitVectors(UP, tangent);
        }
        arrowDummy.updateMatrix();
        mesh.setMatrixAt(idx++, arrowDummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = idx;
  });

  if (count === 0) return null;
  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
    />
  );
}

function FlowLabel({ segId, fromPos, toPos }) {
  const labelInfo = SEGMENT_LABELS[segId];
  if (!labelInfo) return null;

  const midX = (fromPos.x + toPos.x) / 2;
  const midY = Math.max(fromPos.y, toPos.y) + 2.5;
  const midZ = (fromPos.z + toPos.z) / 2;

  return (
    <Html position={[midX, midY, midZ]} center distanceFactor={22} zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{
        background: 'rgba(10,17,32,0.75)',
        border: `1px solid ${labelInfo.color}30`,
        borderRadius: 3,
        padding: '1px 6px',
        whiteSpace: 'nowrap',
        backdropFilter: 'blur(3px)',
      }}>
        <span style={{
          fontSize: 8,
          fontWeight: 600,
          color: labelInfo.color,
          fontFamily: T.mono,
          opacity: 0.85,
        }}>
          {labelInfo.text}
        </span>
      </div>
    </Html>
  );
}

export default function TrackSegmentLines({ segments, nodePositions, flowState, onHoverSegment }) {
  if (!nodePositions) return null;

  const drawable = segments.filter((s) => s.transport?.class === 'passive' || s.transport?.class === 'carrier');

  return (
    <>
      {drawable.map((seg) => {
        const fromPos = nodePositions.get(seg.from_node_id);
        const toPos = nodePositions.get(seg.to_node_id);
        if (!fromPos || !toPos) return null;

        const occ = segmentOccupancy(flowState, seg.id, seg.capacity);
        return (
          <group key={seg.id}>
            <SegmentLine
              segment={seg}
              fromPos={fromPos}
              toPos={toPos}
              occupancy={occ}
              onHoverSegment={onHoverSegment}
            />
            <FlowLabel segId={seg.id} fromPos={fromPos} toPos={toPos} />
          </group>
        );
      })}
      <FlowArrows segments={drawable} nodePositions={nodePositions} />
    </>
  );
}
