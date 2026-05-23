import { Environment, ContactShadows } from '@react-three/drei';

// ─── Industrial lighting ──────────────────────────────────────────────────
// PBR-friendly setup so machines, glass, and concrete actually read as
// materials rather than flat painted boxes:
//   • Studio HDRI (warehouse preset) provides subtle reflections/specular.
//   • One warm directional key with soft shadows for shape and contact.
//   • Cool back-fill so the dark side never crushes to black.
//   • Hemisphere lift to seat the scene against the sky/ground tones.
//   • Contact shadows ground the buildings on the site pad.
export default function SceneAtmosphere() {
  return (
    <>
      <color attach="background" args={['#0c1322']} />
      <fog attach="fog" args={['#0c1322', 90, 240]} />

      <Environment preset="warehouse" background={false} />

      <ambientLight intensity={0.32} color="#cbd5e1" />

      <directionalLight
        position={[28, 55, 22]}
        intensity={1.05}
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
        intensity={0.32}
        color="#9bb3d4"
      />

      <hemisphereLight args={['#7588a6', '#0e1726', 0.38]} />

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
