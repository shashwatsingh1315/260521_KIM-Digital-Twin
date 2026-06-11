import * as THREE from 'three';

// ─── Factory material palette ─────────────────────────────────────────────
// Tonal hierarchy (lightest reads as foreground / most important):
//   FLOOR  →  BUILDING  →  MACHINE BODY  →  ZONE ACCENT  →  STATE
// Keep this small. Every new material = more visual noise.

export const MAT = {
  // ── Base structural tones (3 values, darkest → lightest) ────────────────
  floor:        { color: '#0e1726' },
  building:     { color: '#1f2a3d' },
  machineBody:  { color: '#525d72' },
  machineTrim:  { color: '#8590a8' },
  concrete:     { color: '#3a4254' },

  // ── Family tones (4 values for process families) ────────────────────────
  // Keep in sync with T.family in src/twin/ui/kit.jsx (the 2D UI palette).
  familyProduction: { color: '#22d3ee', emissive: '#0e7490', emissiveIntensity: 0.15 },
  familyLogistics:  { color: '#fbbf24', emissive: '#92400e', emissiveIntensity: 0.15 },
  familyStorage:    { color: '#a78bfa', emissive: '#5b21b6', emissiveIntensity: 0.15 },
  familyInspect:    { color: '#e879f9', emissive: '#86198f', emissiveIntensity: 0.15 },

  // ── State signals (only used to communicate live data) ──────────────────
  // Buffer fill ratio uses these via dynamic color, not direct mat ref.
  stateOk:      { color: '#10b981', emissive: '#059669', emissiveIntensity: 0.9 },
  stateWarn:    { color: '#f59e0b', emissive: '#d97706', emissiveIntensity: 1.1 },
  stateAlert:   { color: '#ef4444', emissive: '#dc2626', emissiveIntensity: 1.4 },

  // ── Utility ─────────────────────────────────────────────────────────────
  glassDim:     { color: '#cbd5e1', transparent: true, opacity: 0.08, depthWrite: false },
  binEmpty:     { color: '#2a3650' },
  binFull:      { color: '#94a3b8' },

  // ── Hero-mesh accent stripe (saturated, slightly self-lit) ──────────────
  // Color is applied per machine via the family tone — this just sets the
  // emissive bias so the stripe pops under bloom.
  accentStripe: { color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.4 },
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

// ─── Procedural textures ──────────────────────────────────────────────────
// One small offscreen canvas → CanvasTexture, generated once at module load.
// Shared across every standard material in the scene. Cheap to make, free to
// reuse, gives every flat box a hint of physical surface.

function makeBrushedMetalNormal(size = 256) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  // Base flat-normal blue
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, size, size);
  // Horizontal "brushed" strokes — random alpha sine bands give a directional
  // normal that catches grazing light without dominating the surface.
  for (let i = 0; i < 1200; i++) {
    const y = Math.random() * size;
    const len = 30 + Math.random() * 180;
    const x = Math.random() * size;
    const v = 110 + Math.random() * 40; // around 0.5 in normal-space
    ctx.strokeStyle = `rgba(${v}, ${v}, 255, ${0.06 + Math.random() * 0.08})`;
    ctx.lineWidth = 0.4 + Math.random() * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (Math.random() - 0.5) * 1.2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 4;
  return tex;
}

function makeFloorGridNormal(size = 512) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, size, size);
  // 8 cells per tile — every 1m = 1 grid line when tex.repeat ≈ floor size / 8.
  const cells = 8;
  const step = size / cells;
  ctx.strokeStyle = 'rgba(80,80,255,0.85)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i <= cells; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  // Subtle scuff splotches
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(128,128,255,${0.05 + Math.random() * 0.05})`;
    const r = 4 + Math.random() * 14;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  // Bake in a 6× tile so a 30 m floor plate shows ~5 m grid cells.
  tex.repeat.set(6, 6);
  tex.anisotropy = 8;
  return tex;
}

function makeWarningStripeTexture(size = 128) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#f5b400';
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(-Math.PI / 4);
  for (let x = -size; x < size; x += 24) {
    ctx.fillRect(x, -size, 12, size * 2);
  }
  ctx.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  // Hazard stripes — wide tile so the diagonals stay legible.
  tex.repeat.set(16, 1);
  return tex;
}

export const metalNormalMap   = makeBrushedMetalNormal();
export const floorGridNormalMap = makeFloorGridNormal();
export const warningStripeMap = makeWarningStripeTexture();
