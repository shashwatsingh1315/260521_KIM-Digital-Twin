// TwinAtmosphere.jsx — self-contained lighting for the twin scene.
//
// Deliberately does NOT use drei <Environment>: that preset fetches a remote
// HDRI from a CDN, which fails in offline / headless / sandboxed environments
// and crashes the whole R3F tree. The directional + ambient + hemisphere rig
// below renders standard PBR materials well without any network dependency.

import { ContactShadows } from '@react-three/drei';

export default function TwinAtmosphere() {
  return (
    <>
      <color attach="background" args={['#0c1322']} />
      <fog attach="fog" args={['#0c1322', 90, 240]} />

      <ambientLight intensity={0.55} color="#cbd5e1" />

      <directionalLight
        position={[28, 55, 22]}
        intensity={1.15}
        color="#fff3dc"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-near={0.5}
        shadow-camera-far={160}
        shadow-bias={-0.0005}
      />

      <directionalLight
        position={[-24, 32, -14]}
        intensity={0.4}
        color="#9bb3d4"
      />

      <hemisphereLight args={['#7588a6', '#0e1726', 0.5]} />

      <ContactShadows
        position={[3, -0.015, 0]}
        opacity={0.55}
        scale={160}
        blur={2.6}
        far={20}
        resolution={1024}
        color="#000000"
      />
    </>
  );
}
