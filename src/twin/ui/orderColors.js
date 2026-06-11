// orderColors.js — shared per-order highlight palette.
//
// The dashboard order rows and the 3D UnitStream tint must agree, so both the
// CSS hex strings and the pre-allocated THREE.Color instances live here.
// Assignment is positional: order index → palette index (wraps past 8).

import * as THREE from 'three';

export const ORDER_HEX = [
  '#38bdf8', // sky
  '#f472b6', // pink
  '#a3e635', // lime
  '#fbbf24', // amber
  '#a78bfa', // violet
  '#fb7185', // rose
  '#34d399', // emerald
  '#e879f9', // fuchsia
];

export const ORDER_THREE = ORDER_HEX.map((h) => new THREE.Color(h));

export function orderHex(index) {
  return ORDER_HEX[((index % ORDER_HEX.length) + ORDER_HEX.length) % ORDER_HEX.length];
}

export function orderThree(index) {
  return ORDER_THREE[((index % ORDER_THREE.length) + ORDER_THREE.length) % ORDER_THREE.length];
}
