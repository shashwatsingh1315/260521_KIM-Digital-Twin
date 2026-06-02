import { MAT, fillStateColor, metalNormalMap } from '../materials/factoryMaterials.js';

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

// PBR defaults so machines pick up the studio HDRI and the shared brushed-
// metal normal map — gives every body+trim surface a hint of physical sheen
// without per-machine cost.
//   • Body  → matte painted steel (rougher, less metal)
//   • Trim  → polished metal (more reflective)
//   • Glass → stays translucent, no normal map
function pbrProps(mat) {
  const isGlass = !!mat.transparent;
  if (isGlass) {
    return { roughness: 0.15, metalness: 0.1, envMapIntensity: 1.2 };
  }
  // Heuristic: trim mat is set explicitly when the caller wants the polished
  // look (machineTrim color). All other opaque materials read as painted body.
  const isTrim = mat === MAT.machineTrim || mat.color === MAT.machineTrim.color;
  return {
    roughness: isTrim ? 0.35 : 0.62,
    metalness: isTrim ? 0.72 : 0.28,
    envMapIntensity: 1.1,
    normalMap: metalNormalMap || undefined,
    'normalScale-x': 0.35,
    'normalScale-y': 0.35,
  };
}

function Box({ pos = [0, 0, 0], size = [1, 1, 1], mat = MAT.machineBody, rot = [0, 0, 0], dimmed }) {
  return (
    <mesh position={pos} rotation={rot} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        {...mat}
        {...pbrProps(mat)}
        transparent={dimmed || mat.transparent}
        opacity={dimmed ? 0.12 : (mat.opacity ?? 1)}
      />
    </mesh>
  );
}

function Cyl({ pos = [0, 0, 0], r = 0.2, h = 1, seg = 24, mat = MAT.machineBody, rot = [0, 0, 0], dimmed }) {
  return (
    <mesh position={pos} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[r, r, h, seg]} />
      <meshStandardMaterial
        {...mat}
        {...pbrProps(mat)}
        transparent={dimmed || mat.transparent}
        opacity={dimmed ? 0.12 : (mat.opacity ?? 1)}
      />
    </mesh>
  );
}

// ─── Shared hero-mesh detail helpers ──────────────────────────────────────
// Stack light: a 3-segment safety tower. Green = low fill, amber = mid, red =
// near-full. Only the active level emits at full intensity; the others stay
// faintly lit so the silhouette stays recognizable.
function StackLight({ pos = [0, 0, 0], fillRatio = 0, dimmed, h = 0.16, r = 0.085 }) {
  const lvls = [
    { mat: MAT.stateOk,    active: fillRatio < 0.6 },
    { mat: MAT.stateWarn,  active: fillRatio >= 0.6 && fillRatio < 0.9 },
    { mat: MAT.stateAlert, active: fillRatio >= 0.9 },
  ];
  return (
    <group position={pos}>
      {/* Slim support pole */}
      <Cyl pos={[0, 0.3, 0]} r={r * 0.45} h={0.6} mat={MAT.machineTrim} dimmed={dimmed} />
      {lvls.map((lvl, i) => {
        const m = lvl.active
          ? lvl.mat
          : { color: lvl.mat.color, emissive: lvl.mat.emissive, emissiveIntensity: 0.06 };
        return (
          <Cyl key={i} pos={[0, 0.6 + i * h + h / 2, 0]} r={r} h={h * 0.92}
               seg={16} mat={m} dimmed={dimmed} />
        );
      })}
      {/* Cap */}
      <Cyl pos={[0, 0.6 + 3 * h + 0.05, 0]} r={r * 0.7} h={0.06}
           mat={MAT.machineTrim} dimmed={dimmed} />
    </group>
  );
}

// HMI / control panel — small framed screen glowing in the family color.
// Used on the front of hero machines to break up flat painted faces.
function HMIPanel({ pos = [0, 0, 0], rot = [0, 0, 0], familyMat, w = 0.5, h = 0.35, dimmed }) {
  const screenCol = familyMat?.color || '#22d3ee';
  return (
    <group position={pos} rotation={rot}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w + 0.08, h + 0.08, 0.06]} />
        <meshStandardMaterial
          color={MAT.machineTrim.color}
          roughness={0.35}
          metalness={0.7}
          transparent={dimmed} opacity={dimmed ? 0.12 : 1}
        />
      </mesh>
      <mesh position={[0, 0, 0.034]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          color={screenCol}
          emissive={screenCol}
          emissiveIntensity={dimmed ? 0.05 : 0.7}
          roughness={0.25}
          metalness={0}
          transparent={dimmed} opacity={dimmed ? 0.18 : 1}
        />
      </mesh>
    </group>
  );
}

// Accent stripe — a thin painted band in the family color, slightly emissive
// so bloom catches it.
function AccentStripe({ pos = [0, 0, 0], size = [1, 0.05, 0.02], rot = [0, 0, 0], familyMat, dimmed }) {
  const col = familyMat?.color || '#22d3ee';
  return (
    <mesh position={pos} rotation={rot} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={col}
        emissive={col}
        emissiveIntensity={dimmed ? 0.05 : 0.35}
        roughness={0.45}
        metalness={0.25}
        transparent={dimmed} opacity={dimmed ? 0.12 : 1}
      />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESS ZONES
// ═══════════════════════════════════════════════════════════════════════════

export function SMTMesh({ fillRatio = 0, familyMat, dimmed }) {
  return (
    <group>
      {/* Plinth */}
      <Box pos={[0, 0.08, 0]} size={[2.8, 0.16, 1.15]} mat={MAT.concrete} dimmed={dimmed} />
      {/* Main reflow oven body */}
      <Box pos={[0, 0.5, 0]} size={[2.6, 0.7, 1.0]} mat={familyMat} dimmed={dimmed} />
      {/* Polished steel hood */}
      <Box pos={[0, 0.88, 0]} size={[2.5, 0.06, 0.72]} mat={MAT.machineTrim} dimmed={dimmed} />
      {/* Family-colour accent stripe along the front face */}
      <AccentStripe pos={[0, 0.5, 0.51]} size={[2.5, 0.06, 0.02]}
                    familyMat={familyMat} dimmed={dimmed} />
      {/* Vent stacks on top */}
      <Cyl pos={[-1.1, 1.45, 0]} r={0.07} h={1.2} mat={MAT.machineTrim} dimmed={dimmed} />
      <Cyl pos={[ 1.1, 1.45, 0]} r={0.07} h={1.2} mat={MAT.machineTrim} dimmed={dimmed} />
      {/* Conveyor entry / exit slots either side */}
      <Box pos={[-1.32, 0.5, 0]} size={[0.06, 0.18, 0.5]} mat={{ color: '#0d141f' }} dimmed={dimmed} />
      <Box pos={[ 1.32, 0.5, 0]} size={[0.06, 0.18, 0.5]} mat={{ color: '#0d141f' }} dimmed={dimmed} />
      {/* Feeder cabinet sticking out the back */}
      <Box pos={[0, 0.4, -0.7]} size={[1.6, 0.8, 0.4]} mat={MAT.machineTrim} dimmed={dimmed} />
      {/* Cable conduit running from feeder up the side */}
      <Cyl pos={[-1.2, 0.9, -0.55]} r={0.05} h={1.5} mat={{ color: '#1f1f1f' }} dimmed={dimmed} />
      {/* HMI panel on the operator side */}
      <HMIPanel pos={[0.55, 0.55, 0.52]} rot={[0, 0, 0]} familyMat={familyMat}
                w={0.55} h={0.32} dimmed={dimmed} />
      {/* Stack light on the corner */}
      <StackLight pos={[1.15, 0.88, 0]} fillRatio={fillRatio} dimmed={dimmed} />
    </group>
  );
}

export function FCTMesh({ fillRatio = 0, familyMat, dimmed }) {
  return (
    <group>
      {/* Plinth */}
      <Box pos={[0, 0.05, 0]} size={[1.5, 0.1, 1.3]} mat={MAT.concrete} dimmed={dimmed} />
      {/* Main body */}
      <Box pos={[0, 0.85, 0]} size={[1.4, 1.7, 1.2]} mat={familyMat} dimmed={dimmed} />
      {/* Polished steel cap with chamfer */}
      <Box pos={[0, 1.74, 0]} size={[1.45, 0.1, 1.25]} mat={MAT.machineTrim} dimmed={dimmed} />
      {/* Front bezel + emissive screen */}
      <HMIPanel pos={[0, 1.0, 0.61]} rot={[0, 0, 0]} familyMat={familyMat}
                w={0.85} h={0.55} dimmed={dimmed} />
      {/* Ventilation slits on the back */}
      {[1.35, 1.5, 1.65].map((y, i) => (
        <Box key={i} pos={[0, y, -0.61]} size={[0.9, 0.04, 0.02]}
             mat={{ color: '#0d141f' }} dimmed={dimmed} />
      ))}
      {/* Accent stripe wrapping the front */}
      <AccentStripe pos={[0, 0.3, 0.61]} size={[1.3, 0.06, 0.02]}
                    familyMat={familyMat} dimmed={dimmed} />
      {/* Stack light */}
      <StackLight pos={[0.55, 1.78, 0]} fillRatio={fillRatio} dimmed={dimmed} />
      {/* Cable conduit */}
      <Cyl pos={[-0.6, 0.9, -0.5]} r={0.05} h={1.5} mat={{ color: '#1f1f1f' }} dimmed={dimmed} />
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
    <group scale={[0.5, 0.5, 0.5]}>
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
      {/* Plinth */}
      <Box pos={[-0.3, 0.05, 0]} size={[2.0, 0.1, 1.5]} mat={MAT.concrete} dimmed={dimmed} />
      {/* Main enclosure */}
      <Box pos={[-0.3, 0.92, 0]} size={[1.8, 1.7, 1.4]} mat={familyMat} dimmed={dimmed} />
      {/* Polished steel cap */}
      <Box pos={[-0.3, 1.82, 0]} size={[1.85, 0.08, 1.45]} mat={MAT.machineTrim} dimmed={dimmed} />
      {/* Inspection viewport (tinted glass) */}
      <Box pos={[-0.3, 1.1, 0.71]} size={[1.2, 0.45, 0.02]} mat={MAT.glassDim} dimmed={dimmed} />
      {/* Conveyor entry rollers (left) */}
      {[0, 0.18, 0.36].map((dx, i) => (
        <Cyl key={`re${i}`} pos={[-1.28 - dx, 0.6, 0]} r={0.08} h={0.5}
             rot={[Math.PI / 2, 0, 0]} mat={MAT.machineTrim} seg={16} dimmed={dimmed} />
      ))}
      {/* Conveyor exit rollers (right) */}
      <Box pos={[1.0, 0.5, 0]} size={[0.9, 0.18, 0.6]} mat={MAT.machineTrim} dimmed={dimmed} />
      {[0, 0.18, 0.36, 0.54].map((dx, i) => (
        <Cyl key={`ro${i}`} pos={[0.7 + dx, 0.6, 0]} r={0.07} h={0.5}
             rot={[Math.PI / 2, 0, 0]} mat={MAT.machineTrim} seg={16} dimmed={dimmed} />
      ))}
      {/* Vacuum-head tube hanging down inside the enclosure */}
      <Cyl pos={[-0.3, 1.45, 0]} r={0.09} h={0.35} mat={MAT.machineTrim} dimmed={dimmed} />
      <Cyl pos={[-0.3, 1.62, 0]} r={0.13} h={0.06} mat={familyMat} dimmed={dimmed} />
      {/* Accent stripe */}
      <AccentStripe pos={[-0.3, 0.3, 0.71]} size={[1.6, 0.06, 0.02]}
                    familyMat={familyMat} dimmed={dimmed} />
      {/* HMI on the operator side */}
      <HMIPanel pos={[-0.7, 0.65, 0.71]} familyMat={familyMat}
                w={0.45} h={0.28} dimmed={dimmed} />
      {/* Stack light */}
      <StackLight pos={[0.45, 1.85, 0.55]} fillRatio={fillRatio} dimmed={dimmed} />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOCATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

// Dock — truck-facing side is local -z (the roller-shutter door faces -z).
// Per-location Y-rotation on LocationNode aims it outward toward the road.
export function DockMesh({ fillRatio = 0, familyMat, dimmed }) {
  return (
    <group>
      {/* Concrete apron */}
      <Box pos={[0, 0.05, 0]} size={[2.6, 0.1, 2.0]} mat={MAT.concrete} dimmed={dimmed} />
      {/* Painted edge strip on the truck side */}
      <Box pos={[0, 0.11, -0.95]} size={[2.4, 0.02, 0.18]} mat={{ color: '#d9a23a' }} dimmed={dimmed} />
      {/* Building wall section with door opening */}
      <Box pos={[0, 1.4, 0.6]} size={[2.6, 2.8, 0.12]} mat={MAT.machineTrim} dimmed={dimmed} />
      {/* Roller-shutter door frame (faces -z) */}
      <Box pos={[0, 1.4, -0.95]} size={[2.4, 2.6, 0.12]} mat={familyMat} dimmed={dimmed} />
      {/* Shutter slats — 8 horizontal bands */}
      {Array.from({ length: 8 }).map((_, i) => (
        <Box key={`sl${i}`} pos={[0, 0.4 + i * 0.28, -0.88]}
             size={[1.8, 0.22, 0.04]} mat={MAT.machineTrim} dimmed={dimmed} />
      ))}
      {/* Dock leveller plate, slightly angled */}
      <Box pos={[0, 0.18, -0.55]} size={[1.6, 0.06, 0.7]} rot={[-0.12, 0, 0]}
           mat={MAT.machineTrim} dimmed={dimmed} />
      {/* Bumper bollards either side of the opening */}
      <Cyl pos={[-1.05, 0.35, -0.95]} r={0.09} h={0.7} mat={{ color: '#d9a23a' }} dimmed={dimmed} />
      <Cyl pos={[ 1.05, 0.35, -0.95]} r={0.09} h={0.7} mat={{ color: '#d9a23a' }} dimmed={dimmed} />
      {/* Door header lamp */}
      <Box pos={[0, 2.75, -0.95]} size={[0.6, 0.12, 0.06]} mat={MAT.stateOk} dimmed={dimmed} />
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
  const lightCol = familyMat?.color || '#e879f9';
  return (
    <group>
      {/* Inspection bench */}
      <Box pos={[0, 0.55, 0]} size={[1.8, 0.1, 1.4]} mat={familyMat} dimmed={dimmed} />
      <Box pos={[0, 0.62, 0]} size={[1.75, 0.02, 1.35]} mat={MAT.machineTrim} dimmed={dimmed} />
      {/* Side support legs */}
      <Box pos={[-0.8, 0.28, 0]} size={[0.1, 0.55, 1.2]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[ 0.8, 0.28, 0]} size={[0.1, 0.55, 1.2]} mat={MAT.machineTrim} dimmed={dimmed} />
      {/* Vertical mast for overhead lighting */}
      <Cyl pos={[0, 1.4, -0.55]} r={0.06} h={1.6} mat={MAT.machineTrim} dimmed={dimmed} />
      {/* Overhead light bar — emissive, gives the bench an inspection-cool glow */}
      <Box pos={[0, 2.1, -0.1]} size={[1.4, 0.08, 0.18]} mat={MAT.machineTrim} dimmed={dimmed} />
      <mesh position={[0, 2.05, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.3, 0.16]} />
        <meshStandardMaterial
          color={lightCol}
          emissive={lightCol}
          emissiveIntensity={dimmed ? 0.05 : 1.6}
          roughness={0.4}
          metalness={0}
          transparent={dimmed} opacity={dimmed ? 0.18 : 1}
        />
      </mesh>
      {/* Operator stool placeholder */}
      <Cyl pos={[0, 0.42, 1.05]} r={0.18} h={0.04} mat={MAT.machineTrim} dimmed={dimmed} />
      <Cyl pos={[0, 0.22, 1.05]} r={0.03} h={0.4} mat={MAT.machineTrim} dimmed={dimmed} />
      {/* Side HMI on the back panel */}
      <HMIPanel pos={[0.6, 1.0, -0.65]} rot={[0, Math.PI, 0]} familyMat={familyMat}
                w={0.4} h={0.3} dimmed={dimmed} />
      {/* Stack light */}
      <StackLight pos={[0.75, 0.62, -0.55]} fillRatio={fillRatio} dimmed={dimmed} />
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

// Lift/VRC: GF instance renders the shaft spanning every floor the lift
// actually services; upper-floor instances render only a small landing
// surround. Material flows through the shaft, never through the wall.
// KMP lifts/VRCs service GF↔FF↔SF (3F is reached by manual trolley, no shaft).
// Top serviced floor y-elevations:
const LIFT_TOP_FLOOR_Y = { KMP: 10, WH: 20, EXT: 0 };
// Motor-room overrun on top of the shaft (realistic ~1.5m elevator headhouse).
const SHAFT_HEADHOUSE_H = 1.5;
const SHAFT_BY_ZONE = {
  // VRC = vertical reciprocating conveyor — smaller bin-only shaft
  VRC:  { w: 1.4, d: 1.4, postR: 0.07 },
  Lift: { w: 1.8, d: 1.8, postR: 0.09 },
};
export function LiftMesh({ fillRatio = 0, familyMat, dimmed, loc }) {
  const site = loc?.site ?? 'KMP';
  const isGround = loc?.floor === 'GF';
  const topY = LIFT_TOP_FLOOR_Y[site] ?? 15;
  const dims = SHAFT_BY_ZONE[loc?.zone] ?? SHAFT_BY_ZONE.Lift;
  const { w, d, postR } = dims;
  const hx = w / 2, hz = d / 2;
  const corners = [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]];

  if (isGround) {
    // Shaft = top-serviced-floor elevation + headhouse. KMP shafts top out at
    // SF (y=10) + a 1.5m motor room. The shaft does NOT reach the building
    // roof — 3F is served by manual trolley, not the lift.
    const shaftH = topY + SHAFT_HEADHOUSE_H;
    return (
      <group>
        {/* Vertical guide rails — full shaft length */}
        {corners.map(([x, z], i) => (
          <Cyl key={`r${i}`} pos={[x, shaftH / 2, z]} r={postR} h={shaftH} mat={MAT.machineTrim} dimmed={dimmed} />
        ))}
        {/* Translucent shaft enclosure (open mesh look) — only spans the
            serviced floors, not the headhouse */}
        <mesh position={[0, topY / 2, -hz - 0.02]}>
          <planeGeometry args={[w, topY]} />
          <meshStandardMaterial color="#5b6678" roughness={0.4} metalness={0.5}
            transparent opacity={dimmed ? 0.06 : 0.22} side={2} depthWrite={false} />
        </mesh>
        <mesh position={[0, topY / 2,  hz + 0.02]}>
          <planeGeometry args={[w, topY]} />
          <meshStandardMaterial color="#5b6678" roughness={0.4} metalness={0.5}
            transparent opacity={dimmed ? 0.06 : 0.22} side={2} depthWrite={false} />
        </mesh>
        {/* Headhouse (motor room) sits between topY and topY+1.5 */}
        <Box pos={[0, topY + SHAFT_HEADHOUSE_H / 2, 0]}
             size={[w + 0.15, SHAFT_HEADHOUSE_H, d + 0.15]}
             mat={MAT.machineTrim} dimmed={dimmed} />
        {/* Small access hatch / cap on the headhouse */}
        <Box pos={[0, topY + SHAFT_HEADHOUSE_H + 0.06, 0]}
             size={[w - 0.4, 0.12, d - 0.4]} mat={familyMat} dimmed={dimmed} />
        {/* Cab parked at ground level */}
        <Box pos={[0, 0.6, 0]} size={[w - 0.2, 0.1, d - 0.2]} mat={familyMat} dimmed={dimmed} />
        <Box pos={[0, 1.4, 0]} size={[w - 0.2, 0.05, d - 0.2]} mat={MAT.machineTrim} dimmed={dimmed} />
        {/* Floor-indicator panel above the GF door — emissive digit plate */}
        <Box pos={[0, 2.4, hz + 0.02]} size={[0.45, 0.22, 0.06]} mat={MAT.machineTrim} dimmed={dimmed} />
        <mesh position={[0, 2.4, hz + 0.06]}>
          <planeGeometry args={[0.34, 0.16]} />
          <meshStandardMaterial
            color="#ff7a3a"
            emissive="#ff7a3a"
            emissiveIntensity={dimmed ? 0.05 : 1.4}
            roughness={0.2}
            metalness={0}
            transparent={dimmed} opacity={dimmed ? 0.18 : 1}
          />
        </mesh>
        {/* Control panel beside the door */}
        <HMIPanel pos={[hx + 0.08, 1.3, hz + 0.02]} rot={[0, 0, 0]}
                  familyMat={familyMat} w={0.32} h={0.5} dimmed={dimmed} />
        {/* Stack light on the headhouse corner */}
        <StackLight pos={[hx - 0.1, topY + 0.05, hz - 0.1]} fillRatio={fillRatio} dimmed={dimmed} />
      </group>
    );
  }
  // Upper-floor landing — just an opening surround + call button.
  return (
    <group>
      {corners.map(([x, z], i) => (
        <Box key={`p${i}`} pos={[x, 1.0, z]} size={[postR * 2.5, 2.0, postR * 2.5]} mat={MAT.machineTrim} dimmed={dimmed} />
      ))}
      {/* Header lintel */}
      <Box pos={[0, 2.1, 0]} size={[w + 0.1, 0.18, d + 0.1]} mat={familyMat} dimmed={dimmed} />
      {/* Floor doorsill */}
      <Box pos={[0, 0.05, 0]} size={[w + 0.1, 0.1, d + 0.1]} mat={MAT.machineTrim} dimmed={dimmed} />
      {/* Call button */}
      <Cyl pos={[hx + 0.1, 1.2, 0]} r={0.05} h={0.04} rot={[Math.PI / 2, 0, 0]} mat={MAT.stateOk} dimmed={dimmed} />
    </group>
  );
}

// Bridge conveyor — long axis runs along LOCAL +z. The per-location ROT map
// in LocationNode.jsx applies +π/2 (KMP-SF-RAMP) or -π/2 (WH-SF-RAMP) so the
// conveyor's long axis ends up along world +x / -x respectively, both pointing
// toward the bridge centerline. Drive-head motor sits at local -z (building
// side); discharge rollers at local +z (bridge side).
export function RampMesh({ fillRatio = 0, familyMat, dimmed }) {
  const len = 4.5;
  const wid = 1.6;
  const rollerCount = 11;
  const rollers = [];
  for (let i = 0; i < rollerCount; i++) {
    const z = -len / 2 + 0.3 + (i * (len - 0.6)) / (rollerCount - 1);
    rollers.push(
      <Cyl key={`r${i}`} pos={[0, 0.55, z]} r={0.07} h={wid - 0.3}
           rot={[0, 0, Math.PI / 2]} mat={MAT.machineTrim} dimmed={dimmed} />
    );
  }
  return (
    <group>
      {/* Deck */}
      <Box pos={[0, 0.4, 0]} size={[wid, 0.12, len]} mat={MAT.concrete} dimmed={dimmed} />
      {/* Side rails (run along local z, on either x side) */}
      <Box pos={[-wid / 2 + 0.05, 0.7, 0]} size={[0.06, 0.45, len]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[ wid / 2 - 0.05, 0.7, 0]} size={[0.06, 0.45, len]} mat={MAT.machineTrim} dimmed={dimmed} />
      {/* Roller bed */}
      {rollers}
      {/* Drive-head motor housing at local -z (building side / entry end) */}
      <Box pos={[0, 0.55, -len / 2 + 0.05]} size={[wid + 0.1, 0.65, 0.35]} mat={familyMat} dimmed={dimmed} />
      <Cyl pos={[0, 0.55, -len / 2 - 0.05]} r={0.18} h={wid - 0.2}
           rot={[0, 0, Math.PI / 2]} mat={MAT.machineTrim} dimmed={dimmed} />
      {/* Discharge end-stop at local +z (bridge midpoint side) */}
      <Cyl pos={[0, 0.55, len / 2 + 0.02]} r={0.16} h={wid - 0.2}
           rot={[0, 0, Math.PI / 2]} mat={MAT.machineTrim} dimmed={dimmed} />
      {/* Leg posts under the deck (along local z) */}
      {[-len / 2 + 0.3, 0, len / 2 - 0.3].map((zPos, i) => (
        <group key={`leg${i}`}>
          <Box pos={[-wid / 2 + 0.1, 0.18, zPos]} size={[0.08, 0.36, 0.08]} mat={MAT.machineTrim} dimmed={dimmed} />
          <Box pos={[ wid / 2 - 0.1, 0.18, zPos]} size={[0.08, 0.36, 0.08]} mat={MAT.machineTrim} dimmed={dimmed} />
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
  const totalH = baseH + levels * levelH;
  
  // Architectural Dimensions: 32.901m (W) x 50.609m (D)
  // We divide by the global 1.6x scale factor applied in LocationNode.
  const targetX = 32.901 / 1.6;
  const targetZ = 50.609 / 1.6;
  const beaconCol = fillStateColor(fillRatio);

  return (
    <group>
      {/* Concrete base pad */}
      <Box pos={[0, baseH / 2, 0]} size={[targetX, baseH, targetZ]} mat={MAT.concrete} dimmed={dimmed} />

      {/* Vertical posts at corners */}
      {[
        [-targetX / 2 + 0.5, -targetZ / 2 + 0.5], 
        [targetX / 2 - 0.5, -targetZ / 2 + 0.5], 
        [-targetX / 2 + 0.5, targetZ / 2 - 0.5], 
        [targetX / 2 - 0.5, targetZ / 2 - 0.5]
      ].map(([x, z], i) => (
        <Cyl key={i} pos={[x, baseH + (levels * levelH) / 2, z]}
             r={0.15} h={levels * levelH} mat={MAT.machineTrim} dimmed={dimmed} />
      ))}

      {/* Massive Procedural Bins */}
      {Array.from({ length: levels }).map((_, i) => {
        const y = baseH + i * levelH + levelH / 2;
        const levelFull = (i + 1) / levels <= fillRatio + 0.001;
        const binW = targetX / 3 - 0.6;
        const binD = targetZ - 1.2;
        const spacingX = targetX / 3;
        return (
          <group key={i}>
            {/* Shelf base */}
            <Box pos={[0, y - levelH / 2 + 0.04, 0]} size={[targetX - 0.4, 0.06, targetZ - 0.4]} mat={familyMat} dimmed={dimmed} />
            {/* 3 rows of bins */}
            {[-spacingX, 0, spacingX].map((cx, j) => (
              <Box
                key={j}
                pos={[cx, y - 0.15, 0]}
                size={[binW, levelH - 0.3, binD]}
                mat={levelFull ? MAT.binFull : MAT.binEmpty}
                dimmed={dimmed}
              />
            ))}
          </group>
        );
      })}
      {/* Crane gantry beam spanning the top */}
      <Box pos={[0, totalH + 0.25, 0]} size={[2.4, 0.18, 0.3]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Box pos={[0, totalH + 0.55, 0]} size={[2.2, 0.12, 0.5]} mat={familyMat} dimmed={dimmed} />
      {/* Crane carriage with hanging hoist line */}
      <Box pos={[0.4, totalH + 0.05, 0]} size={[0.5, 0.25, 0.55]} mat={MAT.machineTrim} dimmed={dimmed} />
      <Cyl pos={[0.4, totalH - 0.8, 0]} r={0.03} h={1.6} mat={{ color: '#1f1f1f' }} dimmed={dimmed} />
      <Box pos={[0.4, totalH - 1.6, 0]} size={[0.45, 0.1, 0.45]} mat={MAT.machineTrim} dimmed={dimmed} />
      {/* Status beacon on top of the gantry — colour reflects fill level */}
      <Cyl pos={[-0.95, totalH + 0.85, 0]} r={0.12} h={0.32} seg={20}
           mat={{ color: beaconCol, emissive: beaconCol, emissiveIntensity: dimmed ? 0.05 : 1.4 }}
           dimmed={dimmed} />
      <Cyl pos={[-0.95, totalH + 1.04, 0]} r={0.09} h={0.06} mat={MAT.machineTrim} dimmed={dimmed} />
      {/* Identification stripe on the bottom front face */}
      <AccentStripe pos={[0, baseH + 0.4, 1.04]} size={[1.6, 0.1, 0.02]}
                    familyMat={familyMat} dimmed={dimmed} />
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

// Stair landing — small footprint, a few diagonal step boxes + railing,
// used for KMP SF↔3F manual-trolley access (lift only reaches SF).
export function StairMesh({ fillRatio = 0, familyMat, dimmed }) {
  const steps = 6;
  const stepH = 0.18;
  const stepD = 0.28;
  return (
    <group>
      {/* Landing platform */}
      <Box pos={[0, 0.06, 0]} size={[1.6, 0.12, 1.4]} mat={MAT.concrete} dimmed={dimmed} />
      {/* Diagonal step run (stylised — represents the staircase silhouette) */}
      {Array.from({ length: steps }).map((_, i) => (
        <Box key={i}
             pos={[0, 0.18 + i * stepH * 0.5, -0.5 + i * stepD * 0.5]}
             size={[1.0, stepH, stepD]}
             mat={MAT.machineTrim} dimmed={dimmed} />
      ))}
      {/* Yellow handrail */}
      <Cyl pos={[ 0.55, 0.9, 0]} r={0.04} h={1.6}
           rot={[0.4, 0, 0]} mat={{ color: '#e9c046' }} dimmed={dimmed} />
      <Cyl pos={[-0.55, 0.9, 0]} r={0.04} h={1.6}
           rot={[0.4, 0, 0]} mat={{ color: '#e9c046' }} dimmed={dimmed} />
      {/* Floor-level kerb stripe */}
      <Box pos={[0, 0.13, 0.7]} size={[1.4, 0.04, 0.06]}
           mat={{ color: '#e9c046' }} dimmed={dimmed} />
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
  stair:            StairMesh,
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