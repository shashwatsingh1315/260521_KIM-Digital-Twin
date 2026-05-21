// Maps location_type:zone (or just location_type) → GLB path under public/models/.
// Returns null when no GLB is registered — triggers procedural fallback in LocationNode.
// Add GLB files to public/models/ and register here; no other code changes needed.
export const MODEL_REGISTRY = {
  // Extend as Kenney / Quaternius assets are added:
  // 'ASRS:SFG-ASRS':     '/models/kenney/storageRackDouble.glb',
  // 'ASRS:FG-ASRS':      '/models/kenney/storageRackDouble.glb',
  // 'dispatch:DISPATCH': '/models/kenney/truckFlat.glb',
};

export function modelPath(loc) {
  return MODEL_REGISTRY[`${loc.location_type}:${loc.zone}`]
      ?? MODEL_REGISTRY[loc.location_type]
      ?? null;
}
