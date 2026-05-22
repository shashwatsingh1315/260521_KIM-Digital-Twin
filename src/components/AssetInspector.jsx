import React, { useEffect, useState, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Environment, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import {
  DockMesh, BufferMesh, InspectionMesh, StoreMesh, SMTMesh,
  FCTMesh, TRSSMesh, Assembly1PMesh, SFGPackMesh, VCMesh, PackMesh,
  ASRSMesh, ASRSPointMesh, LiftMesh, RampMesh, DispatchMesh, ExternalMesh
} from '../scene/MachineMeshes.jsx';
import { MAT } from '../materials/factoryMaterials.js';

const MODELS = [
  { id: 'SMTMesh',        name: 'SMT Line',           component: SMTMesh,        type: 'SMT',         color: MAT.familyProduction.color },
  { id: 'FCTMesh',        name: 'FCT Station',         component: FCTMesh,        type: 'FCT',         color: MAT.familyProduction.color },
  { id: 'TRSSMesh',       name: 'TRSS Assembly',       component: TRSSMesh,       type: 'TRSS',        color: MAT.familyProduction.color },
  { id: 'Assembly1PMesh', name: '1P Assembly',         component: Assembly1PMesh, type: '1P',          color: MAT.familyProduction.color },
  { id: 'SFGPackMesh',    name: 'SFG Boxing',          component: SFGPackMesh,    type: 'SFG Pack',    color: MAT.familyProduction.color },
  { id: 'VCMesh',         name: 'Value Creation',      component: VCMesh,         type: 'VC',          color: MAT.familyProduction.color },
  { id: 'PackMesh',       name: 'Packaging',           component: PackMesh,       type: 'Pack',        color: MAT.familyProduction.color },
  { id: 'ASRSMesh',       name: 'ASRS Rack',           component: ASRSMesh,       type: 'ASRS',        color: MAT.familyStorage.color,  scale: [1, 0.22, 1] },
  { id: 'ASRSPointMesh',  name: 'ASRS I/O Port',       component: ASRSPointMesh,  type: 'ASRS point',  color: MAT.familyStorage.color },
  { id: 'BufferMesh',     name: 'Kanban Buffer',        component: BufferMesh,     type: 'buffer',      color: MAT.familyStorage.color },
  { id: 'StoreMesh',      name: 'Component Store',     component: StoreMesh,      type: 'store',       color: MAT.familyStorage.color },
  { id: 'LiftMesh',       name: 'Material Lift',       component: LiftMesh,       type: 'lift',        color: MAT.familyLogistics.color },
  { id: 'RampMesh',       name: 'Inter-floor Ramp',    component: RampMesh,       type: 'ramp',        color: MAT.familyLogistics.color },
  { id: 'DockMesh',       name: 'Loading Dock',        component: DockMesh,       type: 'dock',        color: MAT.familyLogistics.color },
  { id: 'DispatchMesh',   name: 'Dispatch Staging',    component: DispatchMesh,   type: 'dispatch',    color: MAT.familyLogistics.color },
  { id: 'ExternalMesh',   name: 'External Gate',       component: ExternalMesh,   type: 'external',    color: MAT.familyLogistics.color },
  { id: 'InspectionMesh', name: 'FAT / IQC Station',   component: InspectionMesh, type: 'inspection',  color: MAT.familyInspect.color },
];

const COLS = 5;
const SPACING = 6.5;
const ROWS = Math.ceil(MODELS.length / COLS);
const GRID_W = (COLS - 1) * SPACING;
const GRID_D = (ROWS - 1) * SPACING;

// ─── All models in one scene ──────────────────────────────────────────────────
function ModelGrid({ selectedId, onSelect }) {
  return (
    <group position={[-GRID_W / 2, 0, -GRID_D / 2]}>
      {MODELS.map((model, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const x = col * SPACING;
        const z = row * SPACING;
        const isSelected = model.id === selectedId;
        const Comp = model.component;
        const scale = model.scale ?? [1, 1, 1];

        return (
          <group
            key={model.id}
            position={[x, 0, z]}
            onClick={e => { e.stopPropagation(); onSelect(model.id); }}
            onPointerEnter={() => { document.body.style.cursor = 'pointer'; }}
            onPointerLeave={() => { document.body.style.cursor = 'default'; }}
          >
            {/* Podium */}
            <mesh position={[0, -0.05, 0]} receiveShadow>
              <cylinderGeometry args={[2.0, 2.0, 0.1, 32]} />
              <meshStandardMaterial
                color={isSelected ? '#1e3a5f' : '#0f172a'}
                emissive={isSelected ? model.color : '#000000'}
                emissiveIntensity={isSelected ? 0.25 : 0}
                roughness={0.4}
                metalness={0.6}
              />
            </mesh>

            {/* Selection ring */}
            {isSelected && (
              <mesh position={[0, -0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[2.1, 2.5, 48]} />
                <meshBasicMaterial color={model.color} transparent opacity={0.7} />
              </mesh>
            )}

            {/* The machine mesh */}
            <group scale={scale}>
              <Comp fillRatio={0.5} />
            </group>

            {/* Label */}
            <Html position={[0, -0.18, 2.2]} center distanceFactor={22}>
              <div style={{
                fontSize: 9,
                color: isSelected ? model.color : 'rgba(148,163,184,0.85)',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                background: 'rgba(0,0,0,0.75)',
                padding: '1px 5px',
                borderRadius: 3,
                border: isSelected ? `1px solid ${model.color}55` : 'none',
                pointerEvents: 'none',
              }}>
                {model.name}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

// ─── Camera fly-to on selection ───────────────────────────────────────────────
function GalleryCameraControls({ selectedId, autoRotate }) {
  const { camera, controls } = useThree();
  const targetPos = useRef(null);
  const targetLook = useRef(null);

  useEffect(() => {
    const idx = MODELS.findIndex(m => m.id === selectedId);
    if (idx < 0) return;
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const x = col * SPACING - GRID_W / 2;
    const z = row * SPACING - GRID_D / 2;
    // Fly close to the selected model
    targetPos.current = new THREE.Vector3(x + 4, 5, z + 6);
    targetLook.current = new THREE.Vector3(x, 1, z);
  }, [selectedId]);

  useFrame((_, delta) => {
    if (!targetPos.current || !targetLook.current || !controls) return;
    camera.position.lerp(targetPos.current, delta * 3);
    controls.target.lerp(targetLook.current, delta * 3);
    controls.update();
    if (camera.position.distanceTo(targetPos.current) < 0.15) {
      targetPos.current = null;
      targetLook.current = null;
    }
  });

  const centerX = 0, centerZ = 0;
  return (
    <OrbitControls
      makeDefault
      autoRotate={autoRotate && !selectedId}
      autoRotateSpeed={0.4}
      target={[centerX, 1, centerZ]}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AssetInspector({ onClose }) {
  const [selectedId, setSelectedId] = useState(null);
  const [autoRotate, setAutoRotate] = useState(true);

  const selected = MODELS.find(m => m.id === selectedId);

  const handleSelect = (id) => {
    setSelectedId(prev => prev === id ? null : id);
    setAutoRotate(false);
  };

  return (
    <div className="inspector-overlay">
      <div className="inspector-panel">
        <div className="inspector-header">
          <div className="inspector-header-left">
            <h2>Model Gallery</h2>
            <div className="inspector-subtitle">{MODELS.length} assets · click any model to inspect</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={autoRotate} onChange={e => setAutoRotate(e.target.checked)} />
              Auto-rotate
            </label>
            <button
              style={{ fontSize: 11, padding: '3px 10px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: 4, cursor: 'pointer' }}
              onClick={() => { setSelectedId(null); setAutoRotate(true); }}
            >
              Fit All
            </button>
            <button className="inspector-close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Sidebar — model list */}
          <div style={{ width: 180, borderRight: '1px solid var(--border-color)', overflowY: 'auto', padding: '8px 0' }}>
            {['familyProduction', 'familyStorage', 'familyLogistics', 'familyInspect'].map(family => {
              const familyModels = MODELS.filter(m => m.color === MAT[family].color);
              const label = { familyProduction: 'Production', familyStorage: 'Storage', familyLogistics: 'Logistics', familyInspect: 'Inspection' }[family];
              return (
                <div key={family}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: MAT[family].color, padding: '8px 12px 4px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {label}
                  </div>
                  {familyModels.map(m => (
                    <div
                      key={m.id}
                      onClick={() => handleSelect(m.id)}
                      style={{
                        padding: '5px 12px',
                        cursor: 'pointer',
                        fontSize: 11,
                        color: selectedId === m.id ? m.color : 'var(--text-muted)',
                        background: selectedId === m.id ? `${m.color}18` : 'transparent',
                        borderLeft: selectedId === m.id ? `2px solid ${m.color}` : '2px solid transparent',
                        transition: 'all 0.15s',
                      }}
                    >
                      {m.name}
                      <div style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>{m.type}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* 3D viewport — all models */}
          <div style={{ flex: 1, position: 'relative' }}>
            <Canvas
              shadows
              camera={{ position: [0, 22, 28], fov: 50 }}
              style={{ background: '#0a0d14' }}
            >
              <ambientLight intensity={0.4} color="#dde8ff" />
              <directionalLight position={[10, 20, 10]} intensity={1.6} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
              <directionalLight position={[-10, 10, -5]} intensity={0.5} color="#2563eb" />
              <directionalLight position={[0, -8, 0]} intensity={0.2} color="#fde68a" />

              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
                <planeGeometry args={[80, 80]} />
                <meshStandardMaterial color="#0d1220" roughness={0.9} metalness={0.05} />
              </mesh>

              <ModelGrid selectedId={selectedId} onSelect={handleSelect} />

              <Environment preset="warehouse" environmentIntensity={0.5} />
              <ContactShadows position={[0, -0.07, 0]} opacity={0.5} scale={60} blur={2} far={8} resolution={512} color="#05080f" />

              <EffectComposer disableNormalPass>
                <Bloom luminanceThreshold={0.4} mipmapBlur intensity={0.8} radius={0.5} />
              </EffectComposer>

              <GalleryCameraControls selectedId={selectedId} autoRotate={autoRotate} />
            </Canvas>

            {/* Selected model info overlay */}
            {selected && (
              <div style={{
                position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(10,13,20,0.9)', border: `1px solid ${selected.color}55`,
                borderRadius: 8, padding: '8px 16px', display: 'flex', gap: 16, alignItems: 'center',
                backdropFilter: 'blur(8px)',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: selected.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: selected.color }}>{selected.name}</div>
                  <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>{selected.id} · {selected.type}</div>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                >×</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
