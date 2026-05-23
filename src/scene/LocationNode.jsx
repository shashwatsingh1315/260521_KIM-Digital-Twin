import React, { Component } from 'react';
import { Html, useGLTF } from '@react-three/drei';
import { buffer_capacity } from '../data/m800_model.js';
import { modelPath } from './ModelRegistry.js';
import { getMeshComponent, familyMatKey } from './MachineMeshes.jsx';
import { MAT } from '../materials/factoryMaterials.js';

// ─── GLB model ────────────────────────────────────────────────────────────────
function GlbModel({ glbPath }) {
  const { scene } = useGLTF(glbPath);
  return <primitive object={scene.clone()} />;
}

// ─── Error boundary for GLB fallback ─────────────────────────────────────────
class ModelBoundary extends Component {
  constructor(props) { super(props); this.state = { error: false }; }
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}

// ─── Buffer label ─────────────────────────────────────────────────────────────
function BufferLabel({ loc, simState, isSelected, dimmed }) {
  const bufVal = simState?.buffers?.[loc.location_id] ?? null;
  const cap    = buffer_capacity[loc.location_id] ?? null;
  if (bufVal === null || cap === null) return null;

  const fillRatio  = bufVal / cap;
  const isCritical = fillRatio >= 0.9;
  
  if (dimmed) return null;
  if (!isSelected && !isCritical) return null;

  const color = isCritical ? '#ef4444' : fillRatio >= 0.6 ? '#f59e0b' : '#e2e8f0';

  return (
    <Html position={[0, 3.5, 0]} distanceFactor={20} center>
      <div style={{
        background: 'rgba(0,0,0,0.85)',
        color,
        fontSize: 9,
        padding: '1px 5px',
        borderRadius: 3,
        whiteSpace: 'nowrap',
        border: isCritical ? `1px solid ${color}` : 'none',
        fontFamily: 'monospace',
        pointerEvents: 'none',
      }}>
        {loc.zone || loc.location_type}: {bufVal}/{cap}
      </div>
    </Html>
  );
}

// ─── Procedural mesh ─────────────────────────────────────────────────────────
function ProcMesh({ loc, simState, dimmed }) {
  const bufVal    = simState?.buffers?.[loc.location_id] ?? null;
  const cap       = buffer_capacity[loc.location_id] ?? null;
  const fillRatio = (bufVal !== null && cap) ? bufVal / cap : 0.5;

  const MeshComp = getMeshComponent(loc);
  if (!MeshComp) {
    return (
      <mesh>
        <boxGeometry args={[1.2, 0.6, 1.2]} />
        <meshLambertMaterial color="#334155" transparent={dimmed} opacity={dimmed ? 0.12 : 1} />
      </mesh>
    );
  }

  const familyMat = MAT[familyMatKey(loc)];

  // Scale machines up so they're proportionate to the floor size
  return (
    <group scale={[1.6, 1.6, 1.6]}>
      <MeshComp fillRatio={fillRatio} familyMat={familyMat} dimmed={dimmed} loc={loc} />
    </group>
  );
}

// ─── Per-location rotation (Y axis, radians) ──────────────────────────────
// Docks/gates point outward toward where trucks arrive. Ramp landings on the
// SF bridge face each other across the gap.
const ROT = {
  // KMP exterior — supplier truck approaches from -x side, so loading face
  // points -x. Default DockMesh "opens" toward -z, so rotate +π/2.
  'LOC-KMP-GF-GATE':  Math.PI / 2,
  'LOC-KMP-GF-DOCK3': Math.PI / 2,
  // WH exterior — customer side is +x, so loading face points +x.
  'LOC-WH-GF-GATE':   -Math.PI / 2,
  'LOC-WH-GF-INWARD': -Math.PI / 2,
  'LOC-WH-GF-DISPATCH': -Math.PI / 2,
  // Bridge ramp landings face each other across the SF gap (x-axis bridge).
  'LOC-KMP-SF-RAMP':  Math.PI / 2,
  'LOC-WH-SF-RAMP':  -Math.PI / 2,
};
function locationRotation(loc) {
  return ROT[loc.location_id] ?? 0;
}

// ─── Selection indicator ring ─────────────────────────────────────────────────
function SelectRing() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
      <ringGeometry args={[1.8, 2.4, 32]} />
      <meshBasicMaterial color="#f59e0b" transparent opacity={0.85} />
    </mesh>
  );
}

// ─── LocationNode ─────────────────────────────────────────────────────────────
export default function LocationNode({ loc, pos, simState, onSelect, isSelected, dimmed }) {
  if (!pos) return null;
  const glbPath = modelPath(loc);
  const fallback = <ProcMesh loc={loc} simState={simState} dimmed={dimmed} />;

  const handleClick = (e) => {
    e.stopPropagation();
    onSelect?.(loc);
  };

  const yRot = locationRotation(loc);

  return (
    <group
      position={[pos.x, pos.y, pos.z]}
      rotation={[0, yRot, 0]}
      onClick={handleClick}
      onPointerEnter={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerLeave={() => { document.body.style.cursor = 'default'; }}
    >
      {isSelected && <SelectRing />}

      {glbPath ? (
        <ModelBoundary fallback={fallback}>
          <React.Suspense fallback={fallback}>
            <GlbModel glbPath={glbPath} />
          </React.Suspense>
        </ModelBoundary>
      ) : (
        fallback
      )}

      <BufferLabel loc={loc} simState={simState} isSelected={isSelected} dimmed={dimmed} />
    </group>
  );
}
