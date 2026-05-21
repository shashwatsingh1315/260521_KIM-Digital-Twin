export const MAT = {
  concrete:      { roughness: 0.92, metalness: 0.02, color: '#2f343f' },
  metalDark:     { roughness: 0.28, metalness: 0.85, color: '#1b1f2b' },
  metalLight:    { roughness: 0.22, metalness: 0.90, color: '#6b7280' },
  metalSteel:    { roughness: 0.35, metalness: 0.70, color: '#4b5563' },
  safetyYellow:  { roughness: 0.50, metalness: 0.20, color: '#d97706', emissive: '#b45309', emissiveIntensity: 0.15 },
  signalRed:     { roughness: 0.40, metalness: 0.10, color: '#ef4444', emissive: '#dc2626', emissiveIntensity: 0.8 },
  signalGreen:   { roughness: 0.40, metalness: 0.10, color: '#10b981', emissive: '#059669', emissiveIntensity: 0.8 },
  signalAmber:   { roughness: 0.40, metalness: 0.10, color: '#f59e0b', emissive: '#d97706', emissiveIntensity: 0.8 },
  glass:         { roughness: 0.02, metalness: 0.95, color: '#e0f2fe', transparent: true, opacity: 0.12, depthWrite: false },
  glassOrange:   { roughness: 0.05, metalness: 0.90, color: '#ffedd5', transparent: true, opacity: 0.35, depthWrite: false },
  floor:         { roughness: 0.85, metalness: 0.05, color: '#0b0f19' },
  wallPanel:     { roughness: 0.60, metalness: 0.20, color: '#111827', transparent: true, opacity: 0.45, depthWrite: false },
  
  // Custom theme-specific high-fidelity materials
  emissiveCyan:  { roughness: 0.30, metalness: 0.10, color: '#06b6d4', emissive: '#0891b2', emissiveIntensity: 1.2 },
  emissiveBlue:  { roughness: 0.30, metalness: 0.10, color: '#3b82f6', emissive: '#2563eb', emissiveIntensity: 1.0 },
  emissiveOrange:{ roughness: 0.30, metalness: 0.10, color: '#f97316', emissive: '#ea580c', emissiveIntensity: 1.4 },
  glowWhite:     { roughness: 0.20, metalness: 0.10, color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.5 },
  
  woodPallet:    { roughness: 0.85, metalness: 0.05, color: '#854d0e' },
  cardboardBox:  { roughness: 0.90, metalness: 0.02, color: '#b45309' },
  pcbGreen:      { roughness: 0.60, metalness: 0.10, color: '#166534' },
  siliconChip:   { roughness: 0.15, metalness: 0.90, color: '#1f2937' },
  goldContacts:  { roughness: 0.25, metalness: 0.95, color: '#fbbf24' },
  plasticBlue:   { roughness: 0.45, metalness: 0.15, color: '#1d4ed8' },
  plasticYellow: { roughness: 0.45, metalness: 0.15, color: '#ca8a04' },
  carbonPanel:   { roughness: 0.70, metalness: 0.80, color: '#0f172a' },
  wrapFilm:      { roughness: 0.01, metalness: 0.98, color: '#ffffff', transparent: true, opacity: 0.08, depthWrite: false }
};
