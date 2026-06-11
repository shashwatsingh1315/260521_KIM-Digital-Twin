import { EffectComposer, Bloom, N8AO, Vignette, SMAA } from '@react-three/postprocessing';

// Polish-first post-processing for the main factory scene. Bloom is pushed
// harder than the inspector's config so emissive state lights and trim catch
// the eye; N8AO adds depth in the crevices between machines, columns, and
// the slab edges; Vignette frames the shot.
//
// On mobile we drop the expensive passes (AO + Vignette) and keep only Bloom
// + SMAA so the scene still has *some* polish at touch-device frame rates.
export default function ScenePostFX({ isMobile = false }) {
  if (isMobile) {
    return (
      <EffectComposer disableNormalPass multisampling={0}>
        <Bloom
          intensity={0.7}
          luminanceThreshold={0.65}
          luminanceSmoothing={0.2}
          mipmapBlur
          radius={0.6}
        />
        <SMAA />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer disableNormalPass={false} multisampling={0}>
      <N8AO
        aoRadius={0.5}
        intensity={1.4}
        distanceFalloff={0.8}
        halfRes
        color="#0a1020"
      />
      <Bloom
        intensity={1.0}
        luminanceThreshold={0.45}
        luminanceSmoothing={0.22}
        mipmapBlur
        radius={0.75}
      />
      <Vignette
        offset={0.42}
        darkness={0.4}
      />
      <SMAA />
    </EffectComposer>
  );
}
