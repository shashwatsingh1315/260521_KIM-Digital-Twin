import { MAT, fillStateColor } from '../materials/factoryMaterials.js';

const FAMILY_BY_ZONE = {
  SMT: 'familyProduction', FCT: 'familyProduction', TRSS: 'familyProduction',
  '1P Assembly': 'familyProduction', VC: 'familyProduction',
  Packaging: 'familyProduction', 'SFG Packing': 'familyProduction',
};
const FAMILY_BY_TYPE = {
  ASRS: 'familyStorage', ASRS_point: 'familyStorage', ASRS_zone: 'familyStorage',
  store: 'familyStorage', buffer: 'familyStorage',
  lift: 'familyLogistics', ramp: 'familyLogistics',
  dock: 'familyLogistics', dispatch: 'familyLogistics', external: 'familyLogistics',
  inspection_area: 'familyInspect',
};

export function familyMatKey(loc) {
  return FAMILY_BY_ZONE[loc?.zone] ?? FAMILY_BY_TYPE[loc?.location_type] ?? 'machineBody';
}

function Box({ pos = [0, 0, 0], size = [1, 1, 1], mat = MAT.machineBody, rot = [0, 0, 0], dimmed }) {
  return (
    <mesh position={pos} rotation={rot} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshLambertMaterial {...mat} transparent={dimmed || mat.transparent} opacity={dimmed ? 0.12 : (mat.opacity ?? 1)} />
    </mesh>
  );
}

function Cyl({ pos = [0, 0, 0], r = 0.2, h = 1, seg = 12, mat = MAT.machineBody, rot = [0, 0, 0], dimmed }) {
  return (
    <mesh position={pos} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[r, r, h, seg]} />
      <meshLambertMaterial {...mat} transparent={dimmed || mat.transparent} opacity={dimmed ? 0.12 : (mat.opacity ?? 1)} />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESS ZONES
// ═══════════════════════════════════════════════════════════════════════════

export function SMTMesh({ fillRatio = 0, familyMat, dimmed }) {
  return (
    <group>
      <Box pos={[0, 0.35, 0]} size={[2.6, 0.7, 1.0]} mat={familyMat} dimmed={dimmed} />
      <Box pos={[0, 0.72, 0]} size={[2.5, 0.04, 0.7]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Cyl pos={[-1.1, 1.3, 0]} r={0.06} h={1.2} mat={MAT.machineTrim} dimmed={dimmed} />
      <Cyl pos={[ 1.1, 1.3, 0]} r={0.06} h={1.2} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[0, 1.9, 0]} size={[2.4, 0.08, 0.18]} mat={familyMat} dimmed={dimmed} />
      <Box pos={[0.3, 1.78, 0]} size={[0.3, 0.18, 0.3]} mat={MAT.machineTrim} dimmed={dimmed} />
    </group>
  );
}

export function FCTMesh({ fillRatio = 0, familyMat, dimmed }) {
  return (
    <group>
      <Box pos={[0, 0.85, 0]} size={[1.4, 1.7, 1.2]} mat={familyMat} dimmed={dimmed} />
      {[1.4, 1.55, 1.7].map((y, i) => (
        <Box key={i} pos={[0, y, -0.61]} size={[0.9, 0.03, 0.02]} mat={MAT.machineTrim} dimmed={dimmed} />
      ))}
    </group>
  );
}

export function TRSSMesh({ fillRatio = 0, familyMat, dimmed }) {
  return (
    <group>
      <Box pos={[0, 0.4, 0]} size={[2.2, 0.12, 1.4]} mat={familyMat} dimmed={dimmed} />
      <Box pos={[-1.0, 0.2, -0.6]} size={[0.1, 0.4, 0.1]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[ 1.0, 0.2, -0.6]} size={[0.1, 0.4, 0.1]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[-1.0, 0.2,  0.6]} size={[0.1, 0.4, 0.1]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[ 1.0, 0.2,  0.6]} size={[0.1, 0.4, 0.1]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Cyl pos={[0, 0.55, 0]} r={0.16} h={0.18} mat={MAT.machineTrim} dimmed={dimmed} />
      <Cyl pos={[0, 0.95, 0]} r={0.08} h={0.7} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[0.35, 1.3, 0]} size={[0.7, 0.1, 0.1]} mat={MAT.machineTrim} rot={[0, 0, -0.3]} dimmed={dimmed} />
      <Box pos={[0.68, 1.18, 0]} size={[0.12, 0.18, 0.12]} mat={familyMat} dimmed={dimmed} />
    </group>
  );
}

export function Assembly1PMesh({ fillRatio = 0, familyMat, dimmed }) {
  return (
    <group>
      <Box pos={[0, 1.0, 0]} size={[1.7, 2.0, 1.3]} mat={familyMat} dimmed={dimmed} />
      <Box pos={[0.95, 0.55, 0]} size={[0.3, 0.5, 0.6]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[0, 2.06, 0]} size={[1.3, 0.08, 0.9]} mat={MAT.machineTrim} dimmed={dimmed} />
    </group>
  );
}

export function SFGPackMesh({ fillRatio = 0, familyMat, dimmed }) {
  return (
    <group>
      <Box pos={[0.5, 0.05, 0]} size={[1.6, 0.05, 1.4]} mat={MAT.concrete} dimmed={dimmed} />
      <Cyl pos={[-0.7, 1.0, 0]} r={0.22} h={2.0} mat={familyMat} dimmed={dimmed} />
      <Cyl pos={[-0.7, 2.05, 0]} r={0.16} h={0.18} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[0.2, 2.05, 0]} size={[1.8, 0.14, 0.14]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[1.0, 1.85, 0]} size={[0.3, 0.3, 0.3]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[0.9, 0.25, 0]} size={[0.7, 0.35, 0.7]} mat={MAT.machineTrim} dimmed={dimmed} />
    </group>
  );
}

export function VCMesh({ fillRatio = 0, familyMat, dimmed }) {
  return (
    <group>
      <Box pos={[0, 0.5, 0]} size={[1.6, 0.12, 1.2]} mat={familyMat} dimmed={dimmed} />
      <Box pos={[-0.7, 0.25, 0]} size={[0.1, 0.5, 1.0]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[ 0.7, 0.25, 0]} size={[0.1, 0.5, 1.0]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Cyl pos={[-0.7, 1.3, -0.5]} r={0.04} h={1.4} mat={MAT.machineTrim} dimmed={dimmed} />
      <Cyl pos={[ 0.7, 1.3, -0.5]} r={0.04} h={1.4} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[0, 1.95, -0.5]} size={[1.4, 0.08, 0.18]} mat={familyMat} dimmed={dimmed} />
    </group>
  );
}

export function PackMesh({ fillRatio = 0, familyMat, dimmed }) {
  return (
    <group>
      <Box pos={[-0.3, 0.85, 0]} size={[1.8, 1.7, 1.4]} mat={familyMat} dimmed={dimmed} />
      <Box pos={[-0.3, 1.05, 0.71]} size={[1.2, 0.45, 0.02]} mat={MAT.glassDim} dimmed={dimmed} />
      <Box pos={[1.0, 0.5, 0]} size={[0.9, 0.2, 0.6]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[1.0, 0.62, 0]} size={[0.85, 0.04, 0.5]} mat={familyMat} dimmed={dimmed} />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOCATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

export function DockMesh({ fillRatio = 0, familyMat, dimmed }) {
  return (
    <group>
      <Box pos={[0, 0.04, 0]} size={[2.4, 0.08, 1.8]} mat={MAT.concrete} dimmed={dimmed} />
      <Box pos={[0, 1.2, -0.9]} size={[2.4, 2.4, 0.15]} mat={familyMat} dimmed={dimmed} />
      <Box pos={[0, 1.05, -0.82]} size={[1.6, 1.9, 0.04]} mat={MAT.machineTrim} dimmed={dimmed} />
    </group>
  );
}

export function BufferMesh({ fillRatio = 0, familyMat, dimmed }) {
  const totalBins = 6;
  const fullBins = Math.round(fillRatio * totalBins);
  const stateColor = fillStateColor(fillRatio);

  const bins = [];
  const cols = 3, rows = 2;
  const binW = 0.5, binH = 0.4, binD = 0.5;
  const gap = 0.05;
  const totalW = cols * binW + (cols - 1) * gap;
  const totalD = rows * binD + (rows - 1) * gap;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const x = -totalW / 2 + binW / 2 + c * (binW + gap);
      const z = -totalD / 2 + binD / 2 + r * (binD + gap);
      const isFull = i < fullBins;
      bins.push(
        <group key={i} position={[x, 0, z]}>
          <Box pos={[0, binH / 2 + 0.1, 0]} size={[binW, binH, binD]}
               mat={isFull ? MAT.binFull : MAT.binEmpty} dimmed={dimmed} />
          {isFull && (
            <mesh position={[0, binH + 0.11, 0]}>
              <boxGeometry args={[binW - 0.04, 0.02, binD - 0.04]} />
              <meshStandardMaterial color={stateColor} emissive={stateColor} emissiveIntensity={0.7} transparent={dimmed} opacity={dimmed ? 0.12 : 1} />
            </mesh>
          )}
        </group>
      );
    }
  }

  return (
    <group>
      <Box pos={[0, 0.05, 0]} size={[totalW + 0.2, 0.1, totalD + 0.2]} mat={MAT.machineTrim} dimmed={dimmed} />
      {bins}
    </group>
  );
}

export function InspectionMesh({ fillRatio = 0, familyMat, dimmed }) {
  return (
    <group>
      <Box pos={[0, 0.55, 0]} size={[1.8, 0.1, 1.4]} mat={familyMat} dimmed={dimmed} />
      <Box pos={[-0.8, 0.28, 0]} size={[0.1, 0.55, 1.2]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[ 0.8, 0.28, 0]} size={[0.1, 0.55, 1.2]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Cyl pos={[0, 1.4, -0.5]} r={0.06} h={1.5} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[0, 2.1, -0.2]} size={[0.12, 0.08, 0.7]} mat={MAT.machineTrim} dimmed={dimmed} />
    </group>
  );
}

export function StoreMesh({ fillRatio = 0, familyMat, dimmed }) {
  const shelves = 3;
  const shelfH = 0.7;
  const baseH = 0.2;
  return (
    <group>
      <Box pos={[-0.6, 1.2, 0]} size={[0.06, 2.4, 0.8]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[ 0.6, 1.2, 0]} size={[0.06, 2.4, 0.8]} mat={MAT.machineTrim} dimmed={dimmed} />
      {Array.from({ length: shelves }).map((_, i) => {
        const y = baseH + i * shelfH + shelfH / 2;
        const shelfFull = (i + 1) / shelves <= fillRatio + 0.001;
        return (
          <group key={i}>
            <Box pos={[0, y - shelfH / 2 + 0.04, 0]} size={[1.2, 0.04, 0.7]} mat={familyMat} dimmed={dimmed} />
            {shelfFull && (
              <Box pos={[0, y - 0.05, 0]} size={[1.0, shelfH - 0.2, 0.55]} mat={MAT.binFull} dimmed={dimmed} />
            )}
          </group>
        );
      })}
    </group>
  );
}

export function LiftMesh({ fillRatio = 0, familyMat, dimmed }) {
  return (
    <group>
      {[[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]].map(([x, z], i) => (
        <Cyl key={i} pos={[x, 2.0, z]} r={0.06} h={4.0} mat={MAT.machineTrim} dimmed={dimmed} />
      ))}
      <Box pos={[0, 0.8, 0]} size={[1.0, 0.08, 1.0]} mat={familyMat} dimmed={dimmed} />
      <Box pos={[0, 1.5, 0]} size={[1.0, 0.04, 1.0]} mat={familyMat} dimmed={dimmed} />
    </group>
  );
}

export function RampMesh({ fillRatio = 0, familyMat, dimmed }) {
  return (
    <group rotation={[0.18, 0, 0]}>
      <Box pos={[0, 0.4, 0]} size={[1.8, 0.12, 3.6]} mat={MAT.concrete} dimmed={dimmed} />
      <Box pos={[-0.85, 0.7, 0]} size={[0.05, 0.5, 3.6]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[ 0.85, 0.7, 0]} size={[0.05, 0.5, 3.6]} mat={MAT.machineTrim} dimmed={dimmed} />
      {[-1.4, -0.4, 0.4, 1.4].map((z, i) => (
        <group key={i}>
          <Cyl pos={[-0.85, 0.6, z]} r={0.025} h={0.5} mat={MAT.machineTrim} dimmed={dimmed} />
          <Cyl pos={[ 0.85, 0.6, z]} r={0.025} h={0.5} mat={MAT.machineTrim} dimmed={dimmed} />
        </group>
      ))}
    </group>
  );
}

export function DispatchMesh({ fillRatio = 0, familyMat, dimmed }) {
  return (
    <group>
      <Box pos={[0, 0.04, 0]} size={[3.0, 0.08, 2.2]} mat={MAT.concrete} dimmed={dimmed} />
      <Box pos={[0, 1.3, -1.1]} size={[3.0, 2.6, 0.15]} mat={familyMat} dimmed={dimmed} />
      <Box pos={[-0.7, 1.1, -1.0]} size={[1.1, 2.0, 0.04]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[ 0.7, 1.1, -1.0]} size={[1.1, 2.0, 0.04]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[0.9, 0.55, 0.95]} size={[1.1, 0.9, 0.5]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[1.45, 0.45, 0.95]} size={[0.3, 0.7, 0.5]} mat={familyMat} dimmed={dimmed} />
    </group>
  );
}

export function ExternalMesh({ fillRatio = 0, familyMat, dimmed }) {
  return (
    <group>
      <Box pos={[0, 0.02, 0]} size={[3.0, 0.04, 1.6]} mat={MAT.machineTrim} dimmed={dimmed} />
      {[-1.0, 0, 1.0].map((x, i) => (
        <Box key={i} pos={[x, 0.045, 0]} size={[0.4, 0.005, 0.06]} mat={MAT.machineTrim} dimmed={dimmed} />
      ))}
      <Box pos={[0, 0.05, -0.55]} size={[0.5, 0.005, 0.2]} mat={familyMat} dimmed={dimmed} />
    </group>
  );
}

export function ASRSMesh({ fillRatio = 0, familyMat, dimmed }) {
  const levels = 10;
  const levelH = 1.55;
  const baseH = 0.15;
  return (
    <group>
      {[[-0.85, -1.0], [0.85, -1.0], [-0.85, 1.0], [0.85, 1.0]].map(([x, z], i) => (
        <Cyl key={i} pos={[x, baseH + (levels * levelH) / 2, z]}
             r={0.07} h={levels * levelH} mat={MAT.machineTrim} dimmed={dimmed} />
      ))}
      {Array.from({ length: levels }).map((_, i) => {
        const y = baseH + i * levelH + levelH / 2;
        const levelFull = (i + 1) / levels <= fillRatio + 0.001;
        return (
          <group key={i}>
            <Box pos={[0, y - levelH / 2 + 0.04, 0]} size={[1.8, 0.06, 2.0]} mat={familyMat} dimmed={dimmed} />
            {[-0.6, 0, 0.6].map((cx, j) => (
              <Box
                key={j}
                pos={[cx, y - 0.15, 0]}
                size={[0.45, levelH - 0.3, 1.6]}
                mat={levelFull ? MAT.binFull : MAT.binEmpty}
                dimmed={dimmed}
              />
            ))}
          </group>
        );
      })}
    </group>
  );
}

export function ASRSPointMesh({ fillRatio = 0, familyMat, dimmed }) {
  return (
    <group>
      <Box pos={[0, 0.3, 0]} size={[1.2, 0.4, 1.0]} mat={familyMat} dimmed={dimmed} />
      <Box pos={[0, 0.52, 0]} size={[1.15, 0.04, 0.7]} mat={MAT.machineTrim} dimmed={dimmed} />
    </group>
  );
}

export const MESH_BY_TYPE = {
  dock:             DockMesh,
  buffer:           BufferMesh,
  inspection_area:  InspectionMesh,
  store:            StoreMesh,
  lift:             LiftMesh,
  ramp:             RampMesh,
  dispatch:         DispatchMesh,
  external:         ExternalMesh,
  ASRS:             ASRSMesh,
  ASRS_point:       ASRSPointMesh,
  ASRS_zone:        ASRSMesh,
};

export const MESH_BY_ZONE = {
  SMT:              SMTMesh,
  FCT:              FCTMesh,
  TRSS:             TRSSMesh,
  '1P Assembly':    Assembly1PMesh,
  'SFG Packing':    SFGPackMesh,
  VC:               VCMesh,
  Packaging:        PackMesh,
};

export function getMeshComponent(loc) {
  return MESH_BY_ZONE[loc.zone] ?? MESH_BY_TYPE[loc.location_type] ?? null;
}