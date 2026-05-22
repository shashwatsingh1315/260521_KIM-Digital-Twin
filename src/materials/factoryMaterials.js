// ─── Factory material palette ─────────────────────────────────────────────
// Tonal hierarchy (lightest reads as foreground / most important):
//   FLOOR  →  BUILDING  →  MACHINE BODY  →  ZONE ACCENT  →  STATE
// Keep this small. Every new material = more visual noise.

export const MAT = {
  // ── Base structural tones (3 values, darkest → lightest) ────────────────
  floor:        { color: '#0e1726' },
  building:     { color: '#1f2a3d' },
  machineBody:  { color: '#4a5a76' },
  machineTrim:  { color: '#7d8aa3' },
  concrete:     { color: '#3a4254' },

  // ── Family tones (4 values for process families) ────────────────────────
  familyProduction: { color: '#22d3ee' },
  familyLogistics:  { color: '#fbbf24' },
  familyStorage:    { color: '#a78bfa' },
  familyInspect:    { color: '#e879f9' },

  // ── State signals (only used to communicate live data) ──────────────────
  // Buffer fill ratio uses these via dynamic color, not direct mat ref.
  stateOk:      { color: '#10b981', emissive: '#059669', emissiveIntensity: 0.6 },
  stateWarn:    { color: '#f59e0b', emissive: '#d97706', emissiveIntensity: 0.6 },
  stateAlert:   { color: '#ef4444', emissive: '#dc2626', emissiveIntensity: 0.9 },

  // ── Utility ─────────────────────────────────────────────────────────────
  glassDim:     { color: '#cbd5e1', transparent: true, opacity: 0.08, depthWrite: false },
  binEmpty:     { color: '#2a3650' },
  binFull:      { color: '#94a3b8' },
};

// State color helper — returns the right MAT for a 0..1 fill ratio.
export function fillStateMat(ratio) {
  if (ratio >= 0.9) return MAT.stateAlert;
  if (ratio >= 0.6) return MAT.stateWarn;
  return MAT.stateOk;
}

export function fillStateColor(ratio) {
  if (ratio >= 0.9) return '#ef4444';
  if (ratio >= 0.6) return '#f59e0b';
  return '#10b981';
}
