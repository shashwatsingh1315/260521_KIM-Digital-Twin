import React, { useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import {
  DockMesh, BufferMesh, InspectionMesh, StoreMesh, SMTMesh,
  FCTMesh, TRSSMesh, Assembly1PMesh, SFGPackMesh, VCMesh, PackMesh,
  ASRSMesh, ASRSPointMesh, LiftMesh, RampMesh, DispatchMesh, ExternalMesh
} from '../scene/MachineMeshes.jsx';

const MODELS = [
  { id: 'DockMesh', name: 'Dock Loading Gate', component: DockMesh, type: 'dock' },
  { id: 'BufferMesh', name: 'Pallet Buffer', component: BufferMesh, type: 'buffer' },
  { id: 'InspectionMesh', name: 'Quality Inspection', component: InspectionMesh, type: 'inspection_area' },
  { id: 'StoreMesh', name: 'Component Store', component: StoreMesh, type: 'store' },
  { id: 'SMTMesh', name: 'SMT Conveyor Line', component: SMTMesh, type: 'station_zone (SMT)' },
  { id: 'FCTMesh', name: 'Functional Test Station', component: FCTMesh, type: 'station_zone (FCT)' },
  { id: 'TRSSMesh', name: 'TRSS Assembly', component: TRSSMesh, type: 'station_zone (TRSS)' },
  { id: 'Assembly1PMesh', name: '1P Robotic Assembly', component: Assembly1PMesh, type: 'station_zone (1P)' },
  { id: 'SFGPackMesh', name: 'SFG Boxing Robot', component: SFGPackMesh, type: 'station_zone (SFG)' },
  { id: 'VCMesh', name: 'Laser Engraving (VC)', component: VCMesh, type: 'station_zone (VC)' },
  { id: 'PackMesh', name: 'Automated Packaging', component: PackMesh, type: 'station_zone (Pack)' },
  { id: 'ASRSMesh', name: 'ASRS Racking', component: ASRSMesh, type: 'ASRS' },
  { id: 'ASRSPointMesh', name: 'ASRS I/O Transfer', component: ASRSPointMesh, type: 'ASRS_point' },
  { id: 'LiftMesh', name: 'Vertical Lift Shaft', component: LiftMesh, type: 'lift' },
  { id: 'RampMesh', name: 'Inter-floor Ramp', component: RampMesh, type: 'ramp' },
  { id: 'DispatchMesh', name: 'Dispatch Dock', component: DispatchMesh, type: 'dispatch' },
  { id: 'ExternalMesh', name: 'External Roadway', component: ExternalMesh, type: 'external' }
];

export default function AssetInspector({ onClose }) {
  const [selectedModelId, setSelectedModelId] = useState(MODELS[0].id);
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modelParam = params.get('model');
    if (modelParam) {
      const match = MODELS.find(m => m.id === modelParam);
      if (match) setSelectedModelId(match.id);
    }
  }, []);

  const SelectedComponent = MODELS.find(m => m.id === selectedModelId)?.component;

  return (
    <div className="inspector-overlay">
      <div className="inspector-panel">
        <div className="inspector-header">
          <div className="inspector-header-left">
            <h2>Model Gallery</h2>
            <div className="inspector-subtitle">Asset Inspector</div>
          </div>
          <button className="inspector-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="inspector-workspace">
          <div className="inspector-sidebar">
            <div className="inspector-section">
              <span className="inspector-label">Select Model</span>
              <select
                className="inspector-select"
                value={selectedModelId}
                onChange={e => setSelectedModelId(e.target.value)}
              >
                {MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            
            <div className="inspector-info-card">
              <div className="inspector-info-title">Model Specs</div>
              <div className="inspector-spec-row">
                <span className="spec-label">ID:</span>
                <span className="spec-val font-mono">{selectedModelId}</span>
              </div>
              <div className="inspector-spec-row">
                <span className="spec-label">Type:</span>
                <span className="spec-val">{MODELS.find(m => m.id === selectedModelId)?.type}</span>
              </div>
            </div>

            <div className="inspector-section">
              <span className="inspector-label">Camera Presets</span>
              <div className="camera-grid">
                <button className="btn-ctrl" onClick={() => window.dispatchEvent(new CustomEvent('cam-preset', {detail: [0, 3, 6]}))}>Front</button>
                <button className="btn-ctrl" onClick={() => window.dispatchEvent(new CustomEvent('cam-preset', {detail: [6, 3, 0]}))}>Side</button>
                <button className="btn-ctrl" onClick={() => window.dispatchEvent(new CustomEvent('cam-preset', {detail: [0, 7, 0.01]}))}>Top</button>
                <button className="btn-ctrl" onClick={() => window.dispatchEvent(new CustomEvent('cam-preset', {detail: [4, 4, 4]}))}>Iso</button>
              </div>
            </div>

            <div className="inspector-section">
              <label className="checkbox-container">
                <input type="checkbox" checked={autoRotate} onChange={e => setAutoRotate(e.target.checked)} />
                <span className="checkbox-label">Auto-Rotate</span>
              </label>
            </div>
          </div>

          <div className="inspector-viewport">
            <Canvas shadows gl={{ preserveDrawingBuffer: true }} camera={{ position: [4, 4, 4], fov: 45 }}>
              <ambientLight intensity={0.5} />
              <directionalLight position={[5, 8, 5]} intensity={1.8} castShadow />
              <directionalLight position={[-5, 5, 5]} intensity={0.6} color="#8ec5fc" />
              <directionalLight position={[-5, 4, -5]} intensity={1.2} color="#ffeaa7" />
              <directionalLight position={[0, -5, 0]} intensity={0.4} color="#ffd2fc" />

              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
                <circleGeometry args={[2.5, 64]} />
                <meshStandardMaterial color="#141822" roughness={0.7} metalness={0.2} />
              </mesh>
              <gridHelper args={[6, 12, '#2563eb', '#1e293b']} />

              <group position={[0, 0, 0]}>
                {SelectedComponent && <SelectedComponent fillRatio={0.5} />}
              </group>

              <Environment preset="city" />
              <ContactShadows position={[0, 0.01, 0]} opacity={0.6} scale={10} blur={2} resolution={512} color="#000000" />

              <EffectComposer disableNormalPass>
                <Bloom luminanceThreshold={0.5} mipmapBlur intensity={1.5} />
              </EffectComposer>

              <InspectorCameraControls autoRotate={autoRotate} />
            </Canvas>
          </div>
        </div>
      </div>
    </div>
  );
}

function InspectorCameraControls({ autoRotate }) {
  const { camera, controls } = useThree();
  
  useEffect(() => {
    const handler = (e) => {
      const [x, y, z] = e.detail;
      camera.position.set(x, y, z);
      if (controls) {
         controls.target.set(0, 1, 0);
         controls.update();
      }
    };
    window.addEventListener('cam-preset', handler);
    return () => window.removeEventListener('cam-preset', handler);
  }, [camera, controls]);

  return <OrbitControls makeDefault autoRotate={autoRotate} target={[0, 1, 0]} />;
}
