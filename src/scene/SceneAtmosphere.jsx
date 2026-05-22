// ─── Ops-grade lighting ───────────────────────────────────────────────────
// Goal: flat, even illumination so semantic colors (buffer fill, zone accents,
// blocked particles) read truthfully from every angle. No "city" envmap, no
// rim lights, no dramatic shadows — this is a data viz, not a beauty render.
export default function SceneAtmosphere() {
  return (
    <>
      {/* Bright ambient so machines never sit in shadow */}
      <ambientLight intensity={0.85} color="#e2e8f0" />

      {/* Single soft directional key from above to give shape, no harsh shadow */}
      <directionalLight
        position={[15, 40, 20]}
        intensity={0.55}
        color="#ffffff"
        castShadow={false}
      />

      {/* Cool fill from the opposite side to avoid flat-dead look */}
      <directionalLight
        position={[-20, 25, -10]}
        intensity={0.3}
        color="#cbd5e1"
      />

      {/* Subtle warm rim from below to lift dark undersides */}
      <hemisphereLight args={['#475569', '#0e1726', 0.35]} />
    </>
  );
}
