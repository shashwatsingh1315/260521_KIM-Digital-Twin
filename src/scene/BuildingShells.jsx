import { MAT } from '../materials/factoryMaterials.js';

// KMP multi-story: x≈[-36,4], z≈[-6,6], 4 floors of 5 units each
// WH high-bay:     x≈[8,38],  z≈[-5,8], single 11-unit tall bay

// Tighter bounds — covers all nodes with 2m margin, reduces empty floor void.
// KMP nodes: x -34..3, z -4..4  →  cx=-16, w=38, d=10
// WH nodes:  x 10..34, z -3..6  →  cx=22,  w=28, d=12
export const KMP_BOUNDS = { x: -16, z: 0, w: 38, d: 10, floors: 4, floorH: 5 };
export const WH_BOUNDS  = { x: 22,  z: 1.5, w: 28, d: 12, h: 15 };

// Keep internal aliases for use within this file
const KMP = KMP_BOUNDS;
const WH  = WH_BOUNDS;

function Column({ x, y, z, h, r, mat }) {
  return (
    <mesh position={[x, y + h / 2, z]} castShadow>
      <cylinderGeometry args={[r, r, h, 8]} />
      <meshStandardMaterial {...mat} />
    </mesh>
  );
}

function WallPanel({ x, y, z, w, h, d, mat, rot = [0, 0, 0] }) {
  return (
    <mesh position={[x, y, z]} rotation={rot} renderOrder={0}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial {...mat} />
    </mesh>
  );
}

function KMPBuilding() {
  const { x, z, w, d, floors, floorH } = KMP;
  const hw = w / 2, hd = d / 2;
  const corners = [
    [x - hw + 1, z - hd + 1],
    [x + hw - 1, z - hd + 1],
    [x - hw + 1, z + hd - 1],
    [x + hw - 1, z + hd - 1],
  ];

  const elements = [];

  for (let f = 0; f < floors; f++) {
    const baseY = f * floorH;

    // Structural columns at 4 corners
    for (const [cx, cz] of corners) {
      elements.push(
        <Column key={`col-${f}-${cx}-${cz}`} x={cx} y={baseY} z={cz} h={floorH} r={0.3} mat={MAT.metalDark} />
      );
    }

    // Mid-span columns on long (x) axis
    elements.push(
      <Column key={`col-mid-f${f}-neg`} x={x} y={baseY} z={z - hd + 1} h={floorH} r={0.25} mat={MAT.metalDark} />,
      <Column key={`col-mid-f${f}-pos`} x={x} y={baseY} z={z + hd - 1} h={floorH} r={0.25} mat={MAT.metalDark} />
    );

    // Translucent wall panels — front and back only (sides open for flow)
    elements.push(
      <WallPanel
        key={`wall-front-${f}`}
        x={x} y={baseY + floorH / 2} z={z + hd}
        w={w - 2} h={floorH - 0.3} d={0.12}
        mat={MAT.wallPanel}
      />,
      <WallPanel
        key={`wall-back-${f}`}
        x={x} y={baseY + floorH / 2} z={z - hd}
        w={w - 2} h={floorH - 0.3} d={0.12}
        mat={MAT.wallPanel}
      />
    );

  }

  // Roof truss beam
  elements.push(
    <mesh key="roof-beam-x" position={[x, floors * floorH + 0.2, z]} castShadow>
      <boxGeometry args={[w, 0.35, 0.35]} />
      <meshStandardMaterial {...MAT.metalDark} />
    </mesh>,
    <mesh key="roof-beam-z" position={[x, floors * floorH + 0.2, z]} castShadow>
      <boxGeometry args={[0.35, 0.35, d]} />
      <meshStandardMaterial {...MAT.metalDark} />
    </mesh>
  );

  // Safety stripes — yellow border strips along GF floor edges
  const stripeY = 0.03;
  const stripeT = 0.25; // stripe thickness
  elements.push(
    // Front edge
    <mesh key="stripe-front" position={[x, stripeY, z + hd - stripeT / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w - 2, stripeT]} />
      <meshStandardMaterial {...MAT.safetyYellow} transparent opacity={0.7} depthWrite={false} />
    </mesh>,
    // Back edge
    <mesh key="stripe-back" position={[x, stripeY, z - hd + stripeT / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w - 2, stripeT]} />
      <meshStandardMaterial {...MAT.safetyYellow} transparent opacity={0.7} depthWrite={false} />
    </mesh>,
    // Left edge
    <mesh key="stripe-left" position={[x - hw + stripeT / 2, stripeY, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[stripeT, d - 2]} />
      <meshStandardMaterial {...MAT.safetyYellow} transparent opacity={0.7} depthWrite={false} />
    </mesh>,
    // Right edge
    <mesh key="stripe-right" position={[x + hw - stripeT / 2, stripeY, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[stripeT, d - 2]} />
      <meshStandardMaterial {...MAT.safetyYellow} transparent opacity={0.7} depthWrite={false} />
    </mesh>
  );

  return <group>{elements}</group>;
}

function WHBuilding() {
  const { x, z, w, d, h } = WH;
  const hw = w / 2, hd = d / 2;
  const corners = [
    [x - hw + 1, z - hd + 1],
    [x + hw - 1, z - hd + 1],
    [x - hw + 1, z + hd - 1],
    [x + hw - 1, z + hd - 1],
  ];

  // Extra mid-span columns for wide bay
  const midCols = [
    [x - hw / 2, z - hd + 1], [x - hw / 2, z + hd - 1],
    [x,          z - hd + 1], [x,          z + hd - 1],
    [x + hw / 2, z - hd + 1], [x + hw / 2, z + hd - 1],
  ];

  return (
    <group>
      {/* Tall columns */}
      {[...corners, ...midCols].map(([cx, cz], i) => (
        <Column key={`wh-col-${i}`} x={cx} y={0} z={cz} h={h} r={0.4} mat={MAT.metalLight} />
      ))}

      {/* Glass side walls */}
      <WallPanel x={x} y={h / 2} z={z - hd} w={w - 2} h={h - 0.4} d={0.1} mat={MAT.glass} />
      <WallPanel x={x} y={h / 2} z={z + hd} w={w - 2} h={h - 0.4} d={0.1} mat={MAT.glass} />

      {/* End walls */}
      <WallPanel x={x - hw} y={h / 2} z={z} w={0.1} h={h - 0.4} d={d - 2} mat={MAT.wallPanel} />
      <WallPanel x={x + hw} y={h / 2} z={z} w={0.1} h={h - 0.4} d={d - 2} mat={MAT.wallPanel} />

      {/* SF mezzanine floor beams at y≈9.7 (just under the SF floor plate at y=10) */}
      <mesh position={[x, 9.7, z - hd + 1]}>
        <boxGeometry args={[w - 2, 0.45, 0.45]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
      <mesh position={[x, 9.7, z + hd - 1]}>
        <boxGeometry args={[w - 2, 0.45, 0.45]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
      {/* Cross beams every ~8 units */}
      {[-12, -4, 4, 12].map(ox => (
        <mesh key={`xb-${ox}`} position={[x + ox, 9.7, z]}>
          <boxGeometry args={[0.4, 0.4, d - 2]} />
          <meshStandardMaterial {...MAT.metalDark} />
        </mesh>
      ))}

      {/* Roof truss */}
      <mesh position={[x, h, z]}>
        <boxGeometry args={[w, 0.5, d]} />
        <meshStandardMaterial {...MAT.metalDark} transparent opacity={0.85} />
      </mesh>

      {/* Roof ridge beam */}
      <mesh position={[x, h + 0.25, z]}>
        <boxGeometry args={[w, 0.2, 0.2]} />
        <meshStandardMaterial {...MAT.metalDark} />
      </mesh>
    </group>
  );
}

export default function BuildingShells() {
  return (
    <group>
      <KMPBuilding />
      <WHBuilding />
    </group>
  );
}
