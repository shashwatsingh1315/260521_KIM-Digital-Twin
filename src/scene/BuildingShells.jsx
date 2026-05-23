import * as THREE from 'three';

export const KMP_BOUNDS = { x: -16, z: 0, w: 38, d: 10, floors: 4, floorH: 5 };
export const WH_BOUNDS  = { x: 22,  z: 1.5, w: 28, d: 12, h: 25 };

// ─── Shared material descriptors ──────────────────────────────────────────
const concreteCol  = { color: '#cfd5df', roughness: 0.88, metalness: 0.05 };
const trimCol      = { color: '#5b6678', roughness: 0.55, metalness: 0.4 };
const slabEdgeCol  = { color: '#9ba5b4', roughness: 0.8, metalness: 0.1 };
const roofCol      = { color: '#2b3344', roughness: 0.7, metalness: 0.45 };
const glassCol     = {
  color: '#7fb1d6',
  roughness: 0.15,
  metalness: 0.15,
  transparent: true,
  opacity: 0.16,
  envMapIntensity: 1.4,
  depthWrite: false,
};

// ─── Primitives ───────────────────────────────────────────────────────────
function Column({ x, y, z, h, w = 0.5 }) {
  return (
    <mesh position={[x, y + h / 2, z]} castShadow receiveShadow>
      <boxGeometry args={[w, h, w]} />
      <meshStandardMaterial {...trimCol} />
    </mesh>
  );
}

// Slim slab edge ring at floor height `y`.
function FloorEdge({ cx, cz, w, d, y, thickness = 0.22 }) {
  return (
    <group position={[cx, y, cz]}>
      <mesh position={[0, 0, d / 2]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.4, thickness, 0.25]} />
        <meshStandardMaterial {...slabEdgeCol} />
      </mesh>
      <mesh position={[0, 0, -d / 2]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.4, thickness, 0.25]} />
        <meshStandardMaterial {...slabEdgeCol} />
      </mesh>
      <mesh position={[w / 2, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.25, thickness, d]} />
        <meshStandardMaterial {...slabEdgeCol} />
      </mesh>
      <mesh position={[-w / 2, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.25, thickness, d]} />
        <meshStandardMaterial {...slabEdgeCol} />
      </mesh>
    </group>
  );
}

// Tinted glass cladding panel on a long face.
function GlassPanel({ pos, size, rot = [0, 0, 0] }) {
  return (
    <mesh position={pos} rotation={rot}>
      <planeGeometry args={size} />
      <meshStandardMaterial {...glassCol} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Roof slab with parapet trim and a couple of HVAC bumps.
function Roof({ cx, cz, w, d, y }) {
  const parapets = [
    { p: [0, 0.45, d / 2 + 0.25], s: [w + 0.8, 0.6, 0.25] },
    { p: [0, 0.45, -d / 2 - 0.25], s: [w + 0.8, 0.6, 0.25] },
    { p: [w / 2 + 0.25, 0.45, 0], s: [0.25, 0.6, d + 0.8] },
    { p: [-w / 2 - 0.25, 0.45, 0], s: [0.25, 0.6, d + 0.8] },
  ];
  return (
    <group position={[cx, y, cz]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w + 0.8, 0.4, d + 0.8]} />
        <meshStandardMaterial {...roofCol} />
      </mesh>
      {parapets.map((e, i) => (
        <mesh key={i} position={e.p} castShadow>
          <boxGeometry args={e.s} />
          <meshStandardMaterial {...slabEdgeCol} />
        </mesh>
      ))}
      <mesh position={[-w / 4, 0.75, 0]} castShadow>
        <boxGeometry args={[2.6, 1.1, 1.6]} />
        <meshStandardMaterial {...trimCol} />
      </mesh>
      <mesh position={[w / 4, 0.6, d / 4]} castShadow>
        <cylinderGeometry args={[0.6, 0.6, 0.85, 24]} />
        <meshStandardMaterial {...trimCol} />
      </mesh>
      <mesh position={[w / 4, 1.2, d / 4]} castShadow>
        <cylinderGeometry args={[0.45, 0.45, 0.3, 24]} />
        <meshStandardMaterial {...concreteCol} />
      </mesh>
    </group>
  );
}

// ─── Full building: columns + slab edges + glass cladding + roof ──────────
function Building({ bounds }) {
  const { x: cx, z: cz, w, d } = bounds;
  const floors = bounds.floors ?? 1;
  const floorH = bounds.floorH ?? bounds.h ?? 5;
  const totalH = bounds.h ?? floors * floorH;

  // Column grid: 4 along long edge × 2 along short edge.
  const colXs = [-w / 2, -w / 6, w / 6, w / 2];
  const colZs = [-d / 2, d / 2];
  const columns = [];
  for (const cxOff of colXs) for (const czOff of colZs) {
    columns.push([cx + cxOff, cz + czOff]);
  }

  // Slab edges at each upper floor level.
  const slabYs = [];
  for (let i = 1; i <= floors; i++) slabYs.push(i * floorH);

  // Glass cladding bands on front + back of each floor.
  const glass = [];
  for (let i = 0; i < floors; i++) {
    const yMid = i * floorH + floorH / 2;
    const panelH = floorH - 0.6;
    const panelW = w - 2.0;
    glass.push(
      { key: `g-f-${i}`, pos: [cx, yMid, cz + d / 2 + 0.005], size: [panelW, panelH], rot: [0, 0, 0] },
      { key: `g-b-${i}`, pos: [cx, yMid, cz - d / 2 - 0.005], size: [panelW, panelH], rot: [0, Math.PI, 0] },
    );
  }

  return (
    <group>
      {columns.map(([colX, colZ], i) => (
        <Column key={`col-${i}`} x={colX} y={0} z={colZ} h={totalH} />
      ))}
      {slabYs.map(y => (
        <FloorEdge key={`edge-${y}`} cx={cx} cz={cz} w={w} d={d} y={y} />
      ))}
      {glass.map(p => (
        <GlassPanel key={p.key} pos={p.pos} size={p.size} rot={p.rot} />
      ))}
      <Roof cx={cx} cz={cz} w={w} d={d} y={totalH + 0.2} />
    </group>
  );
}

// Wide concrete site pad under the buildings.
function SiteGround() {
  return (
    <mesh position={[3, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[200, 110]} />
      <meshStandardMaterial color="#3b424f" roughness={0.95} metalness={0.04} />
    </mesh>
  );
}

export default function BuildingShells() {
  return (
    <group>
      <SiteGround />
      <Building bounds={KMP_BOUNDS} />
      <Building bounds={{ ...WH_BOUNDS, floors: 5, floorH: WH_BOUNDS.h / 5 }} />
    </group>
  );
}
