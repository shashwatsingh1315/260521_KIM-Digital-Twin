// TwinAtmosphere.jsx — self-contained lighting for the twin scene.
//
// Deliberately does NOT use drei <Environment>: that preset fetches a remote
// HDRI from a CDN, which fails in offline / headless / sandboxed environments
// and crashes the whole R3F tree. The directional + ambient + hemisphere rig
// below renders standard PBR materials well without any network dependency.

export default function TwinAtmosphere() {
  // No shadow maps: shadow rendering is the dominant per-frame cost under
  // software rendering (SwiftShader/headless) and tanks the frame rate. The
  // directional + ambient + hemisphere rig reads the standard PBR materials
  // well without them.
  return (
    <>
      <color attach="background" args={['#0c1322']} />
      <fog attach="fog" args={['#0c1322', 90, 240]} />

      <ambientLight intensity={0.6} color="#cbd5e1" />

      <directionalLight
        position={[28, 55, 22]}
        intensity={1.2}
        color="#fff3dc"
      />

      <directionalLight
        position={[-24, 32, -14]}
        intensity={0.4}
        color="#9bb3d4"
      />

      <hemisphereLight args={['#7588a6', '#0e1726', 0.55]} />
    </>
  );
}
