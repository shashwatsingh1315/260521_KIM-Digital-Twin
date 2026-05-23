import React, { useMemo, forwardRef, useImperativeHandle, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { location_node, path } from '../data/m800_model.js';
import SceneAtmosphere from '../scene/SceneAtmosphere.jsx';
import BuildingShells, { KMP_BOUNDS, WH_BOUNDS } from '../scene/BuildingShells.jsx';
import LocationNode from '../scene/LocationNode.jsx';
import FloorPaths from '../scene/FloorPaths.jsx';
import ParticleStream from '../scene/ParticleStream.jsx';
import ScenePostFX from '../scene/ScenePostFX.jsx';
import SetDressing from '../scene/SetDressing.jsx';
import { floorGridNormalMap, warningStripeMap } from '../materials/factoryMaterials.js';

const FLOOR_Y = { GF: 0, FF: 5, SF: 10, '3F': 15, '4F': 20 };

// Fixed floor plates — bounds match the building shell columns exactly.
// KMP and WH share the same floor heights (GF=0, FF=5, SF=10, 3F=15)
// so their SF floors align at the same y=10 level.
// Floor tones are intentionally a clean dark navy — close to the background
// but uniform, so machines (lighter, saturated accents) pop in silhouette.
const FLOOR_PLATES = [
  // ── KMP (production building) ──────────────────────────────────────────────
  { key: 'kmp-gf', cx: KMP_BOUNDS.x, y: FLOOR_Y.GF,    cz: KMP_BOUNDS.z, w: KMP_BOUNDS.w, d: KMP_BOUNDS.d, color: '#2b3954', label: 'KMP · GF' },
  { key: 'kmp-ff', cx: KMP_BOUNDS.x, y: FLOOR_Y.FF,    cz: KMP_BOUNDS.z, w: KMP_BOUNDS.w, d: KMP_BOUNDS.d, color: '#2b3954', label: 'KMP · FF' },
  { key: 'kmp-sf', cx: KMP_BOUNDS.x, y: FLOOR_Y.SF,    cz: KMP_BOUNDS.z, w: KMP_BOUNDS.w, d: KMP_BOUNDS.d, color: '#2b3954', label: 'KMP · SF' },
  { key: 'kmp-3f', cx: KMP_BOUNDS.x, y: FLOOR_Y['3F'], cz: KMP_BOUNDS.z, w: 30,           d: 10,           color: '#2b3954', label: 'KMP · 3F' },
  // ── WH (warehouse) — GF + matching SF at same y as KMP SF ─────────────────
  { key: 'wh-gf',  cx: WH_BOUNDS.x,  y: FLOOR_Y.GF,    cz: WH_BOUNDS.z,  w: WH_BOUNDS.w,  d: WH_BOUNDS.d,  color: '#26334d', label: 'WH · GF'  },
  { key: 'wh-ff',  cx: WH_BOUNDS.x,  y: FLOOR_Y.FF,    cz: WH_BOUNDS.z,  w: WH_BOUNDS.w,  d: WH_BOUNDS.d,  color: '#26334d', label: 'WH · FF'  },
  { key: 'wh-sf',  cx: WH_BOUNDS.x,  y: FLOOR_Y.SF,    cz: WH_BOUNDS.z,  w: WH_BOUNDS.w,  d: WH_BOUNDS.d,  color: '#26334d', label: 'WH · SF'  },
  { key: 'wh-3f',  cx: WH_BOUNDS.x,  y: FLOOR_Y['3F'], cz: WH_BOUNDS.z,  w: WH_BOUNDS.w,  d: WH_BOUNDS.d,  color: '#26334d', label: 'WH · 3F'  },
  { key: 'wh-4f',  cx: WH_BOUNDS.x,  y: FLOOR_Y['4F'], cz: WH_BOUNDS.z,  w: WH_BOUNDS.w,  d: WH_BOUNDS.d,  color: '#26334d', label: 'WH · 4F'  },
  // ── Ramp bridge: connects KMP SF RAMP (x=3) ↔ WH SF RAMP (x=6) at y=10 ──
  { key: 'bridge', cx: 4.5,           y: FLOOR_Y.SF,   cz: 0,            w: 7,            d: 5,            color: '#243149', label: '' },
];

// ─── Floor surface plates ──────────────────────────────────────────────────────
// Polished concrete-like floor slabs with subtle painted safety stripe along the
// long edge. Single corner label per plate. Materials are PBR so they pick up
// the environment subtly — the lift/VRC columns gleam, machines cast shadows.
function FloorSurfaces({ activeFloor }) {
  const dimmedOpacity = 0.14;
  const isFloorActive = (floor) => activeFloor === 'all' || activeFloor === floor;

  return (
    <>
      {FLOOR_PLATES.map(({ key, cx, y, cz, w, d, color, label }) => {
        const f = key === 'bridge' ? 'SF' : key.split('-')[1].toUpperCase();
        const active = isFloorActive(f);
        const slabColor = key.startsWith('wh') ? '#3a4660' : key === 'bridge' ? '#37445e' : '#3c4866';
        return (
          <group key={key} position={[cx, y - 0.01, cz]}>
            {/* Slab body — slim box so it has a visible thickness from the side */}
            <mesh position={[0, -0.06, 0]} receiveShadow castShadow>
              <boxGeometry args={[w, 0.12, d]} />
              <meshStandardMaterial
                color={slabColor}
                roughness={0.78}
                metalness={0.12}
                transparent={!active}
                opacity={active ? 1 : dimmedOpacity}
              />
            </mesh>
            {/* Inset painted area — work zone with a tiled grid normal map so
                the slab reads as a real floor, not a flat plane */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
              <planeGeometry args={[w - 1.4, d - 1.4]} />
              <meshStandardMaterial
                color={color}
                roughness={0.78}
                metalness={0.06}
                normalMap={floorGridNormalMap || undefined}
                normalScale-x={0.55}
                normalScale-y={0.55}
                transparent={!active}
                opacity={active ? 0.92 : dimmedOpacity}
              />
            </mesh>
            {/* Yellow/black hazard stripe along the front edge */}
            {key !== 'bridge' && warningStripeMap && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, d / 2 - 0.25]}>
                <planeGeometry args={[w - 1.2, 0.28]} />
                <meshStandardMaterial
                  map={warningStripeMap}
                  roughness={0.55}
                  metalness={0.15}
                  transparent={!active}
                  opacity={active ? 0.92 : dimmedOpacity}
                />
              </mesh>
            )}
            {label && (
              <Html position={[-w / 2 + 1, 0.06, d / 2 - 0.6]} distanceFactor={30}>
                <div style={{
                  fontSize: 10,
                  color: 'rgba(203, 213, 225, 0.78)',
                  fontFamily: 'monospace',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  opacity: active ? 1 : dimmedOpacity,
                }}>{label}</div>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────
const TwinScene = forwardRef(({ simState, layout, onSelectLoc, selectedLocId, activeFloor }, ref) => {
  const { camera, controls } = useThree();
  const [targetPos, setTargetPos] = useState(null);
  const [targetCtrl, setTargetCtrl] = useState(null);

  useImperativeHandle(ref, () => ({
    flyTo(preset) {
      if (!controls) return;
      if      (preset === 'kmp')    { setTargetPos(new THREE.Vector3(-22, 18, 24)); setTargetCtrl(new THREE.Vector3(-14, 5, 0)); }
      else if (preset === 'center') { setTargetPos(new THREE.Vector3(3, 26, 48));  setTargetCtrl(new THREE.Vector3(3, 5, 0)); }
      else if (preset === 'wh')     { setTargetPos(new THREE.Vector3(25, 18, 24)); setTargetCtrl(new THREE.Vector3(16, 5, 0)); }
      else if (preset === 'top')    { setTargetPos(new THREE.Vector3(3, 55, 0.1)); setTargetCtrl(new THREE.Vector3(3, 0, 0)); }
      // Floor-level presets — camera drops to eye-level for each floor
      else if (preset === 'GF')     { setTargetPos(new THREE.Vector3(3, 8, 30));   setTargetCtrl(new THREE.Vector3(3, 0, 0)); }
      else if (preset === 'FF')     { setTargetPos(new THREE.Vector3(3, 13, 30));  setTargetCtrl(new THREE.Vector3(3, 5, 0)); }
      else if (preset === 'SF')     { setTargetPos(new THREE.Vector3(3, 18, 30));  setTargetCtrl(new THREE.Vector3(3, 10, 0)); }
      else if (preset === '3F')     { setTargetPos(new THREE.Vector3(3, 23, 28));  setTargetCtrl(new THREE.Vector3(3, 15, 0)); }
      else if (preset === '4F')     { setTargetPos(new THREE.Vector3(3, 28, 28));  setTargetCtrl(new THREE.Vector3(3, 20, 0)); }
    },
  }));

  useFrame((state, delta) => {
    if (targetPos && targetCtrl && controls) {
      camera.position.lerp(targetPos, delta * 3.5);
      controls.target.lerp(targetCtrl, delta * 3.5);
      controls.update();
      if (camera.position.distanceTo(targetPos) < 0.1 && controls.target.distanceTo(targetCtrl) < 0.1) {
        setTargetPos(null);
        setTargetCtrl(null);
      }
    }
  });

  const leaves = useMemo(() =>
    location_node.filter(l => !['site', 'floor'].includes(l.location_type) && layout[l.location_id]),
  [layout]);

  const pathSegments = useMemo(() => {
    const map = {};
    for (const p of path) {
      const from = layout[p.from_location_id];
      const to   = layout[p.to_location_id];
      if (!from || !to) continue;
      map[p.path_id] = {
        start: new THREE.Vector3(from.x, from.y, from.z),
        end:   new THREE.Vector3(to.x, to.y, to.z),
      };
    }
    return map;
  }, [layout]);

  // Deselect when clicking empty space
  const handleBgClick = () => onSelectLoc?.(null);
  
  const isFloorActive = (floor) => activeFloor === 'all' || activeFloor === floor;

  return (
    <group onClick={handleBgClick}>
      <SceneAtmosphere />
      <BuildingShells />
      <FloorSurfaces activeFloor={activeFloor} />
      <SetDressing />
      {leaves.map(loc => {
        const active = isFloorActive(loc.floor);
        return (
          <LocationNode
            key={loc.location_id}
            loc={loc}
            pos={layout[loc.location_id]}
            simState={simState}
            onSelect={onSelectLoc}
            isSelected={selectedLocId === loc.location_id}
            dimmed={!active}
          />
        );
      })}
      <FloorPaths path={path} layout={layout} activeFloor={activeFloor} />
      <ParticleStream simState={simState} pathSegments={pathSegments} layout={layout} paths={path} />
    </group>
  );
});

// ─── Wrapper ──────────────────────────────────────────────────────────────────
export default function FactoryTwin({ simState, layout, sceneRef, isMobile, onSelectLoc, selectedLocId, activeFloor }) {
  const [hasWebGL, setHasWebGL] = React.useState(true);

  React.useEffect(() => {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) setHasWebGL(false);
    } catch { setHasWebGL(false); }
  }, []);

  if (!hasWebGL) return (
    <div style={{ padding: 20, color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: 8 }}>
      <h3>WebGL Not Supported</h3>
      <p>Enable hardware acceleration in your browser settings.</p>
    </div>
  );

  return (
    <Canvas
      camera={{ position: [0, 30, 40], fov: 45 }}
      style={{ background: 'transparent' }}
      dpr={[1, 2]}
      shadows="soft"
      gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.18 }}
    >
      <TwinScene ref={sceneRef} simState={simState} layout={layout} onSelectLoc={onSelectLoc} selectedLocId={selectedLocId} activeFloor={activeFloor} />
      <OrbitControls makeDefault enableDamping enablePan={!isMobile} />
      <ScenePostFX isMobile={isMobile} />
    </Canvas>
  );
}
