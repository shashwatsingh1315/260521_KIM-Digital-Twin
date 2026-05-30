// TrackSegmentLines.jsx — renders passive track segments as colored lines.
//
// Color encodes occupancy: green (empty) → amber (>50%) → red (full/held).
// Carrier segments rendered as a thicker tube.

import { useMemo } from 'react';
import * as THREE from 'three';
import { fillStateColor } from '../../materials/factoryMaterials.js';

function segmentOccupancy(flowState, segId, capacity) {
  if (!flowState) return 0;
  const inTransit = flowState.segmentUnits?.get(segId)?.length ?? 0;
  const held = flowState.segmentHeld?.get(segId)?.length ?? 0;
  return capacity > 0 ? (inTransit + held) / capacity : 0;
}

function SegmentLine({ segment, fromPos, toPos, occupancy }) {
  const color = fillStateColor(occupancy);
  const isCarrier = segment.transport?.class === 'carrier';

  const points = useMemo(() => [
    new THREE.Vector3(fromPos.x, fromPos.y + 0.05, fromPos.z),
    new THREE.Vector3(toPos.x,   toPos.y   + 0.05, toPos.z),
  ], [fromPos, toPos]);

  if (isCarrier) {
    // Carrier segments: elevated dashed tube
    const mid = {
      x: (fromPos.x + toPos.x) / 2,
      y: fromPos.y + 1.5,
      z: (fromPos.z + toPos.z) / 2,
    };
    const pts = useMemo(() => [
      new THREE.Vector3(fromPos.x, fromPos.y + 1.5, fromPos.z),
      new THREE.Vector3(mid.x, mid.y + 0.5, mid.z),
      new THREE.Vector3(toPos.x, toPos.y + 1.5, toPos.z),
    ], [fromPos, toPos]);

    const curve = useMemo(() => new THREE.CatmullRomCurve3(pts), [pts]);
    const tubeGeom = useMemo(() => new THREE.TubeGeometry(curve, 12, 0.08, 6, false), [curve]);

    return (
      <mesh geometry={tubeGeom}>
        <meshBasicMaterial color={color} />
      </mesh>
    );
  }

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={2}
          array={new Float32Array([
            points[0].x, points[0].y, points[0].z,
            points[1].x, points[1].y, points[1].z,
          ])}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} linewidth={2} />
    </line>
  );
}

export default function TrackSegmentLines({ segments, nodePositions, flowState }) {
  if (!nodePositions) return null;

  return (
    <>
      {segments.filter((s) => s.transport?.class === 'passive' || s.transport?.class === 'carrier')
        .map((seg) => {
          const fromPos = nodePositions.get(seg.from_node_id);
          const toPos = nodePositions.get(seg.to_node_id);
          if (!fromPos || !toPos) return null;

          const occ = segmentOccupancy(flowState, seg.id, seg.capacity);
          return (
            <SegmentLine
              key={seg.id}
              segment={seg}
              fromPos={fromPos}
              toPos={toPos}
              occupancy={occ}
            />
          );
        })}
    </>
  );
}
