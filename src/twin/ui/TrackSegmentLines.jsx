// TrackSegmentLines.jsx — renders passive track segments as colored lines.
//
// Color encodes occupancy: green (empty) → amber (>50%) → red (full/held).
// Carrier segments rendered as a thicker tube.

import { useMemo } from 'react';
import * as THREE from 'three';
import { fillStateColor } from '../../materials/factoryMaterials.js';
import { orthogonalPath } from './twinLayout.js';

function segmentOccupancy(flowState, segId, capacity) {
  if (!flowState) return 0;
  const inTransit = flowState.segmentUnits?.get(segId)?.length ?? 0;
  const held = flowState.segmentHeld?.get(segId)?.length ?? 0;
  return capacity > 0 ? (inTransit + held) / capacity : 0;
}

function SegmentLine({ segment, fromPos, toPos, occupancy }) {
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

  const posArray = useMemo(() => {
    const arr = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      arr[i * 3] = points[i].x;
      arr[i * 3 + 1] = points[i].y;
      arr[i * 3 + 2] = points[i].z;
    }
    return arr;
  }, [points]);

  if (isCarrier) {
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
          count={points.length}
          array={posArray}
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
