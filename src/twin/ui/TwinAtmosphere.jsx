// TwinAtmosphere.jsx — studio-quality lighting for the twin scene.
//
// Uses drei <Environment preset="warehouse"> wrapped in Suspense so the scene
// degrades gracefully in offline/headless environments (falls back to the
// directional + ambient + hemisphere rig which still renders PBR well).

import { Suspense } from 'react';
import { Environment, ContactShadows } from '@react-three/drei';

function HdriEnv() {
  return <Environment preset="warehouse" background={false} environmentIntensity={0.8} />;
}

export default function TwinAtmosphere() {
  return (
    <>
      <color attach="background" args={['#0c1322']} />
      <fog attach="fog" args={['#0c1322', 90, 240]} />

      {/* HDRI for metallic reflections — Suspense fallback for offline */}
      <Suspense fallback={null}>
        <HdriEnv />
      </Suspense>

      <ContactShadows
        position={[3, -0.015, 0]}
        opacity={0.55}
        scale={160}
        blur={2.6}
        far={20}
        resolution={1024}
        color="#000000"
      />

      <ambientLight intensity={0.32} color="#cbd5e1" />

      <directionalLight
        position={[28, 55, 22]}
        intensity={1.05}
        color="#fff3dc"
      />

      <directionalLight
        position={[-24, 32, -14]}
        intensity={0.32}
        color="#9bb3d4"
      />

      <hemisphereLight args={['#7588a6', '#0e1726', 0.38]} />
    </>
  );
}
