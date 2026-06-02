import * as THREE from 'three';
import { Instances, Instance } from '@react-three/drei';
import { KMP_BOUNDS, WH_BOUNDS } from './BuildingShells.jsx';
import { warningStripeMap } from '../materials/factoryMaterials.js';

// ─── Set dressing ─────────────────────────────────────────────────────────
// Ambient detail layer mounted *under* LocationNode so clicks pass through.
// Everything here is non-interactive (raycast = null) — it exists to fill the
// empty floor space and break the silhouette of the buildings.
//
// All scatter is seeded so the scene is deterministic between renders.

// Tiny seeded PRNG so the scatter is stable.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FLOOR_H = 5;
const NO_RAYCAST = () => null;

// ── Pallets (instanced wooden pallets scattered on storage floors) ─────────
function PalletField({ count, cx, cz, w, d, y, seed, exclusionRadius = 2 }) {
  const rng = mulberry32(seed);
  const items = [];
  let tries = 0;
  while (items.length < count && tries < count * 6) {
    tries++;
    const x = cx + (rng() - 0.5) * (w - 2);
    const z = cz + (rng() - 0.5) * (d - 2);
    // Avoid placing pallets directly on a machine origin (rough grid avoidance).
    const tooClose = items.some(
      (p) => Math.hypot(p.x - x, p.z - z) < exclusionRadius
    );
    if (tooClose) continue;
    const rot = rng() < 0.5 ? 0 : Math.PI / 2;
    const tilt = (rng() - 0.5) * 0.06;
    items.push({ x, z, rot, tilt });
  }
  return (
    <Instances limit={count + 4} range={items.length} raycast={NO_RAYCAST}>
      <boxGeometry args={[1.0, 0.14, 1.2]} />
      <meshStandardMaterial color="#7c5a32" roughness={0.85} metalness={0.05} />
      {items.map((p, i) => (
        <Instance
          key={i}
          position={[p.x, y + 0.07, p.z]}
          rotation={[p.tilt, p.rot, 0]}
        />
      ))}
    </Instances>
  );
}

// ── Bollards (yellow safety bollards at corners of openings) ───────────────
function BollardCluster({ positions }) {
  return (
    <Instances limit={positions.length + 4} range={positions.length} raycast={NO_RAYCAST}>
      <cylinderGeometry args={[0.13, 0.13, 0.85, 18]} />
      <meshStandardMaterial
        color="#e9c046"
        roughness={0.55}
        metalness={0.15}
        emissive="#e9c046"
        emissiveIntensity={0.18}
      />
      {positions.map((p, i) => (
        <Instance key={i} position={[p[0], (p[2] || 0) + 0.43, p[1]]} />
      ))}
    </Instances>
  );
}

// ── Overhead pipe runs (3 long cylinders along ceiling of each floor) ──────
function PipeRun({ cx, cz, w, y, dz, color }) {
  return (
    <mesh
      position={[cx, y, cz + dz]}
      rotation={[0, 0, Math.PI / 2]}
      raycast={NO_RAYCAST}
    >
      <cylinderGeometry args={[0.16, 0.16, w - 1.6, 18]} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.4} />
    </mesh>
  );
}

function CeilingPipes({ cx, cz, w, d, ceilingY }) {
  // Three pipes running along the long axis of each floor, offset on z.
  const colors = ['#cc4747', '#3a78c8', '#7a8392']; // fire, water, HVAC
  return (
    <>
      {[-d / 2 + 1.2, 0, d / 2 - 1.2].map((dz, i) => (
        <PipeRun
          key={i}
          cx={cx}
          cz={cz}
          w={w}
          y={ceilingY - 0.25}
          dz={dz - cz}
          color={colors[i]}
        />
      ))}
    </>
  );
}

// ── Cable tray (U-channel running between columns) ─────────────────────────
function CableTray({ x1, x2, y, z }) {
  const cx = (x1 + x2) / 2;
  const len = Math.abs(x2 - x1);
  return (
    <group position={[cx, y, z]} raycast={NO_RAYCAST}>
      <mesh>
        <boxGeometry args={[len, 0.04, 0.32]} />
        <meshStandardMaterial color="#3a4252" roughness={0.7} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0.08, 0.14]}>
        <boxGeometry args={[len, 0.16, 0.04]} />
        <meshStandardMaterial color="#3a4252" roughness={0.7} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0.08, -0.14]}>
        <boxGeometry args={[len, 0.16, 0.04]} />
        <meshStandardMaterial color="#3a4252" roughness={0.7} metalness={0.55} />
      </mesh>
    </group>
  );
}

// ── Walkway hatching (hazard-striped plane along floor spine) ──────────────
function WalkwayHatch({ cx, cz, w, d, y }) {
  if (!warningStripeMap) return null;
  return (
    <mesh
      position={[cx, y + 0.005, cz - d / 2 + 1.2]}
      rotation={[-Math.PI / 2, 0, 0]}
      raycast={NO_RAYCAST}
    >
      <planeGeometry args={[w - 4, 0.4]} />
      <meshStandardMaterial
        map={warningStripeMap}
        roughness={0.7}
        metalness={0.1}
        transparent
        opacity={0.78}
      />
    </mesh>
  );
}

// ── Roof clutter (extra HVAC blocks beyond the existing two bumps) ─────────
function RoofClutter({ cx, cz, w, d, y }) {
  return (
    <group position={[cx, y, cz]} raycast={NO_RAYCAST}>
      {/* Dish/antenna stub */}
      <mesh position={[w / 3, 1.1, -d / 3]}>
        <cylinderGeometry args={[0.06, 0.06, 1.8, 12]} />
        <meshStandardMaterial color="#2e3340" roughness={0.6} metalness={0.6} />
      </mesh>
      <mesh position={[w / 3, 2.0, -d / 3]} rotation={[Math.PI / 2.4, 0, 0]}>
        <coneGeometry args={[0.32, 0.18, 16, 1, true]} />
        <meshStandardMaterial color="#a5acbd" roughness={0.45} metalness={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* Secondary HVAC unit (smaller than the main two in BuildingShells) */}
      <mesh position={[-w / 3.2, 0.55, d / 4]} castShadow>
        <boxGeometry args={[1.6, 0.7, 1.0]} />
        <meshStandardMaterial color="#4a5260" roughness={0.6} metalness={0.45} />
      </mesh>
      <mesh position={[-w / 3.2, 0.95, d / 4]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.18, 18]} />
        <meshStandardMaterial color="#9aa3b2" roughness={0.45} metalness={0.4} />
      </mesh>
    </group>
  );
}

// ─── Main composer ────────────────────────────────────────────────────────
export default function SetDressing() {
  return (
    <group>
      {/* ── KMP GF storage strip pallets ── */}
      <PalletField
        count={22}
        cx={KMP_BOUNDS.x - 8}
        cz={KMP_BOUNDS.z + KMP_BOUNDS.d / 2 - 2}
        w={14}
        d={3}
        y={0}
        seed={101}
      />
      {/* ── WH GF storage zone pallets (around ASRS) ── */}
      <PalletField
        count={20}
        cx={WH_BOUNDS.x - 4}
        cz={WH_BOUNDS.z + WH_BOUNDS.d / 2 - 2.2}
        w={12}
        d={3}
        y={0}
        seed={202}
      />
      {/* ── WH SF Line B aisle pallets ── */}
      <PalletField
        count={14}
        cx={WH_BOUNDS.x}
        cz={WH_BOUNDS.z + WH_BOUNDS.d / 2 - 2}
        w={14}
        d={2.5}
        y={10}
        seed={303}
      />

      {/* ── Bollards at lift entries and dock corners ── */}
      <BollardCluster
        positions={[
          // KMP material lift (x=-20, z=-4)
          [-21.1, -3.0, 0], [-18.9, -3.0, 0], [-21.1, -5.0, 0], [-18.9, -5.0, 0],
          // KMP VRC (x=-20, z=4)
          [-21.1, 3.0, 0], [-18.9, 3.0, 0], [-21.1, 5.0, 0], [-18.9, 5.0, 0],
          // KMP gate apron edges
          [-35.2, -1.4, 0], [-32.8, -1.4, 0],
          // WH gate apron edges
          [33.2, -1.4, 0], [35.6, -1.4, 0],
          // Dispatch dock corners (x=20, z=6)
          [19, 7.3, 0], [21, 7.3, 0],
        ]}
      />

      {/* ── Overhead pipes disabled per user request ── */}

      {/* ── Cable trays running between column lines on the GF ── */}
      {[KMP_BOUNDS.x - KMP_BOUNDS.w / 2 + 0.5, KMP_BOUNDS.x + KMP_BOUNDS.w / 2 - 0.5].map((_, i) => null)}
      <CableTray
        x1={KMP_BOUNDS.x - KMP_BOUNDS.w / 2 + 1}
        x2={KMP_BOUNDS.x + KMP_BOUNDS.w / 2 - 1}
        y={4.6}
        z={KMP_BOUNDS.z - KMP_BOUNDS.d / 2 + 0.4}
      />
      <CableTray
        x1={KMP_BOUNDS.x - KMP_BOUNDS.w / 2 + 1}
        x2={KMP_BOUNDS.x + KMP_BOUNDS.w / 2 - 1}
        y={9.6}
        z={KMP_BOUNDS.z - KMP_BOUNDS.d / 2 + 0.4}
      />

      {/* ── Walkway hatching markings on the spine of each floor ── */}
      <WalkwayHatch cx={KMP_BOUNDS.x} cz={KMP_BOUNDS.z} w={KMP_BOUNDS.w} d={KMP_BOUNDS.d} y={0} />
      <WalkwayHatch cx={KMP_BOUNDS.x} cz={KMP_BOUNDS.z} w={KMP_BOUNDS.w} d={KMP_BOUNDS.d} y={5} />
      <WalkwayHatch cx={KMP_BOUNDS.x} cz={KMP_BOUNDS.z} w={KMP_BOUNDS.w} d={KMP_BOUNDS.d} y={10} />
      <WalkwayHatch cx={WH_BOUNDS.x}  cz={WH_BOUNDS.z}  w={WH_BOUNDS.w}  d={WH_BOUNDS.d}  y={0} />
      <WalkwayHatch cx={WH_BOUNDS.x}  cz={WH_BOUNDS.z}  w={WH_BOUNDS.w}  d={WH_BOUNDS.d}  y={5} />

      {/* ── Extra roof clutter beyond the BuildingShells defaults ── */}
      <RoofClutter
        cx={KMP_BOUNDS.x}
        cz={KMP_BOUNDS.z}
        w={KMP_BOUNDS.w}
        d={KMP_BOUNDS.d}
        y={KMP_BOUNDS.floors * KMP_BOUNDS.floorH + 0.4}
      />
      <RoofClutter
        cx={WH_BOUNDS.x}
        cz={WH_BOUNDS.z}
        w={WH_BOUNDS.w}
        d={WH_BOUNDS.d}
        y={WH_BOUNDS.h + 0.4}
      />
    </group>
  );
}
