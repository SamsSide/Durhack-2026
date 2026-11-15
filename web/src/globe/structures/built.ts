// Landmark models built in code, for looks the downloaded model sets do not cover: the camps, hut villages
// and standing stones of a stone age tribe (style 'primitive', see towns/ageStyle), and the glasshouse farm
// of a future nation (style 'arcology'). Same unit as the GLB models: one footprint wide (x and z from -0.5
// to 0.5), base at y = 0, a few hundred triangles each. Every colour lives in BUILT_COLORS.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ModelPart } from './models';

export const BUILT_COLORS = {
  earth: '#b8a07a',
  mud: '#c9ae86',
  thatch: '#cdb06a',
  thatchDark: '#b09450',
  hide: '#cdb692',
  hideDark: '#a98a64',
  wood: '#6e5236',
  dark: '#3a2c22',
  stone: '#a8a49a',
  stoneDark: '#8a867d',
  soil: '#7a5a3c',
  crop: '#7f9a4a',
  ember: '#ff9a3a',
  pad: '#cfd6da',
  glass: '#a9dcd6',
  rib: '#eef2f4',
  hydro: '#6fae6a',
  glow: '#59dcff',
} as const;
type Col = keyof typeof BUILT_COLORS | 'team';

/** Geometry gathered by colour, then merged into one part per colour. */
class Kit {
  private by = new Map<Col, THREE.BufferGeometry[]>();
  add(col: Col, g: THREE.BufferGeometry): void {
    const list = this.by.get(col) ?? [];
    list.push(g.index ? g.toNonIndexed() : g);
    this.by.set(col, list);
  }
  box(col: Col, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0): void {
    this.add(col, new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y + h / 2, z));
  }
  cyl(col: Col, rt: number, rb: number, h: number, seg: number, x: number, y: number, z: number): void {
    this.add(col, new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y + h / 2, z));
  }
  parts(): ModelPart[] {
    const out: ModelPart[] = [];
    for (const [col, list] of this.by) {
      const geometry = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!geometry) continue;
      const team = col === 'team';
      const glow = col === 'ember' || col === 'glow';
      const color = team ? '#ffffff' : BUILT_COLORS[col];
      const material = glow
        ? new THREE.MeshBasicMaterial({ color, toneMapped: false })
        : new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95 });
      out.push({ geometry, material, team });
    }
    return out;
  }
}

// ---- pieces ------------------------------------------------------------------------------------------

/** A round hut: a low mud wall under a tall thatch cone, its door towards +z turned by `ry`. */
function hut(k: Kit, x: number, z: number, r: number, h: number, ry = 0, dark = false): void {
  k.cyl('mud', r * 0.92, r, h * 0.36, 8, x, 0, z);
  k.cyl(dark ? 'thatchDark' : 'thatch', 0.02 * r, r * 1.28, h * 0.72, 8, x, h * 0.28, z);
  k.box('dark', r * 0.5, h * 0.3, r * 0.2, x + Math.sin(ry) * r * 0.9, 0, z + Math.cos(ry) * r * 0.9, ry);
}
/** A hide tent on poles. */
function tent(k: Kit, x: number, z: number, r: number, h: number, ry = 0, dark = false): void {
  k.cyl(dark ? 'hideDark' : 'hide', 0.06 * r, r, h, 6, x, 0, z);
  k.cyl('wood', 0.03 * r, 0.03 * r, h * 0.22, 4, x, h * 0.95, z);
  k.box('dark', r * 0.45, h * 0.42, r * 0.2, x + Math.sin(ry) * r * 0.72, 0, z + Math.cos(ry) * r * 0.72, ry);
}
/** A fire in a ring of stones: `s` is its width. */
function fire(k: Kit, x: number, z: number, s: number): void {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.box('stoneDark', s * 0.3, s * 0.16, s * 0.24, x + Math.cos(a) * s * 0.5, 0, z + Math.sin(a) * s * 0.5, -a);
  }
  k.box('wood', s * 0.8, s * 0.12, s * 0.14, x, s * 0.04, z, 0.5);
  k.box('wood', s * 0.8, s * 0.12, s * 0.14, x, s * 0.1, z, -0.7);
  k.cyl('ember', 0, s * 0.3, s * 0.9, 5, x, s * 0.12, z);
}
/** One standing stone, a little narrower at the top. */
function stone(k: Kit, x: number, z: number, w: number, h: number, ry: number, dark = false): void {
  k.add(dark ? 'stoneDark' : 'stone', new THREE.CylinderGeometry(w * 0.5, w * 0.68, h, 4).rotateY(ry + Math.PI / 4).translate(x, h / 2, z));
}
/** A ring of standing stones of radius `r`, every `lintel`-th pair joined by a lintel. */
function stoneRing(k: Kit, r: number, n: number, h: number, w: number, lintel: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    const hh = h * (0.82 + 0.18 * ((i * 7) % 5) / 4);
    stone(k, Math.cos(a) * r, Math.sin(a) * r, w, hh, -a, i % 3 === 1);
    if (lintel > 0 && i % lintel === 0) {
      const b = ((i + 1) / n) * Math.PI * 2 + 0.2, m = (a + b) / 2;
      const len = 2 * r * Math.sin((b - a) / 2) + w;
      k.box('stone', w * 0.9, w * 0.55, len, Math.cos(m) * r * Math.cos((b - a) / 2), h * 0.98, Math.sin(m) * r * Math.cos((b - a) / 2), -m);
    }
  }
}
/** A carved pole with a band and a pennant in the nation's colour. */
function totem(k: Kit, x: number, z: number, h: number): void {
  k.cyl('wood', h * 0.035, h * 0.05, h, 5, x, 0, z);
  k.box('team', h * 0.13, h * 0.1, h * 0.13, x, h * 0.6, z);
  k.box('team', h * 0.3, h * 0.16, h * 0.02, x + h * 0.17, h * 0.8, z);
  k.box('wood', h * 0.2, h * 0.04, h * 0.06, x, h * 0.74, z);
}
/** Two posts and a bar with hides hung to dry. */
function rack(k: Kit, x: number, z: number, s: number, ry: number): void {
  const c = Math.cos(ry), sn = Math.sin(ry);
  for (const d of [-0.5, 0.5]) k.cyl('wood', s * 0.04, s * 0.04, s * 0.6, 4, x + c * d * s, 0, z - sn * d * s);
  k.box('wood', s * 1.1, s * 0.05, s * 0.05, x, s * 0.58, z, ry);
  for (const d of [-0.25, 0.2]) k.box('hide', s * 0.32, s * 0.36, s * 0.03, x + c * d * s, s * 0.22, z - sn * d * s, ry);
}
const ground = (k: Kit, r: number): void => k.cyl('earth', r, r * 1.04, 0.012, 12, 0, 0, 0);

// ---- the stone age set ---------------------------------------------------------------------------------

function capital(): ModelPart[] {
  const k = new Kit();
  stoneRing(k, 0.42, 14, 0.19, 0.06, 4);
  hut(k, 0, -0.14, 0.18, 0.42, 0);                 // the great hut
  k.box('team', 0.16, 0.04, 0.02, 0, 0.17, 0.045); // a band over its door
  tent(k, -0.22, 0.02, 0.085, 0.2, 1.2);
  tent(k, 0.22, 0.02, 0.085, 0.2, -1.2, true);
  fire(k, 0, 0.17, 0.15);                          // the great fire
  totem(k, -0.13, 0.24, 0.36);
  totem(k, 0.13, 0.24, 0.36);
  return k.parts();
}
function city(): ModelPart[] {
  const k = new Kit();
  hut(k, -0.02, -0.14, 0.19, 0.44, 0.2);
  hut(k, 0.25, 0.1, 0.1, 0.28, -1.2, true);
  hut(k, -0.27, 0.08, 0.1, 0.27, 1.1);
  tent(k, 0.08, 0.3, 0.08, 0.18, 0);
  fire(k, 0, 0.12, 0.12);
  totem(k, -0.14, 0.27, 0.34);
  rack(k, 0.3, -0.18, 0.14, 0.6);
  return k.parts();
}
function town(): ModelPart[] {
  const k = new Kit();
  hut(k, -0.08, -0.1, 0.17, 0.4, 0.4);
  hut(k, 0.22, 0.02, 0.1, 0.27, -1.0, true);
  tent(k, -0.22, 0.2, 0.085, 0.19, 0.8);
  fire(k, 0.04, 0.17, 0.11);
  totem(k, 0.2, 0.26, 0.3);
  return k.parts();
}
function village(): ModelPart[] {
  const k = new Kit();
  ground(k, 0.42);
  hut(k, -0.16, -0.1, 0.12, 0.3, 0.7);
  hut(k, 0.17, -0.08, 0.11, 0.28, -0.7, true);
  hut(k, 0.02, 0.2, 0.1, 0.25, 3.1);
  fire(k, 0, 0.02, 0.09);
  totem(k, -0.24, 0.2, 0.26);
  return k.parts();
}
function farm(): ModelPart[] {
  const k = new Kit();
  // two dug plots with rows of young crops, a hut, a drying rack and a brush fence
  for (const [x, z, w, d] of [[-0.2, 0.14, 0.5, 0.6], [0.28, 0.24, 0.36, 0.4]] as const) {
    k.box('soil', w, 0.012, d, x, 0, z);
    for (let i = 0; i < 5; i++) k.box('crop', w * 0.86, 0.022, d * 0.08, x, 0.012, z - d * 0.4 + i * d * 0.2);
  }
  hut(k, 0.24, -0.24, 0.13, 0.3, -0.6);
  rack(k, -0.2, -0.3, 0.16, 0.2);
  for (let i = 0; i < 9; i++) k.cyl('wood', 0, 0.014, 0.07, 4, -0.47 + i * 0.118, 0, 0.47);
  for (let i = 0; i < 7; i++) k.cyl('wood', 0, 0.014, 0.07, 4, -0.47, 0, -0.16 + i * 0.1);
  k.box('team', 0.06, 0.04, 0.012, 0.24, 0.3, -0.24);
  k.cyl('wood', 0.008, 0.008, 0.34, 4, 0.21, 0, -0.24);
  return k.parts();
}
function temple(): ModelPart[] {
  const k = new Kit();
  ground(k, 0.44);
  stoneRing(k, 0.34, 8, 0.34, 0.09, 2);
  k.box('stoneDark', 0.2, 0.07, 0.12, 0, 0, 0, 0.3);   // the altar stone
  fire(k, 0, 0.14, 0.08);
  k.cyl('wood', 0.01, 0.012, 0.5, 4, 0.02, 0, -0.12);
  k.box('team', 0.14, 0.09, 0.012, 0.09, 0.4, -0.12);
  return k.parts();
}
function fort(): ModelPart[] {
  const k = new Kit();
  ground(k, 0.46);
  const n = 22;
  for (let i = 0; i < n; i++) {
    if (i === 5 || i === 6) continue; // the way in
    const a = (i / n) * Math.PI * 2;
    k.cyl('wood', 0, 0.045, 0.3 + 0.04 * (i % 2), 5, Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4);
  }
  for (const [x, z] of [[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07]] as const) k.cyl('wood', 0.012, 0.014, 0.42, 4, x - 0.1, 0, z - 0.1);
  k.box('wood', 0.2, 0.025, 0.2, -0.1, 0.42, -0.1);
  k.cyl('thatch', 0, 0.16, 0.12, 4, -0.1, 0.52, -0.1);
  k.box('team', 0.12, 0.08, 0.012, -0.1 + 0.07, 0.68, -0.1);
  k.cyl('wood', 0.008, 0.008, 0.14, 4, -0.1, 0.63, -0.1);
  tent(k, 0.14, 0.1, 0.09, 0.2, -2.2);
  fire(k, 0.02, -0.02, 0.07);
  return k.parts();
}

// ---- the future farm -----------------------------------------------------------------------------------

/** A glasshouse farm: three long glass halls on a pale pad, rows of green between them, a small mast. */
function glasshouse(): ModelPart[] {
  const k = new Kit();
  k.box('pad', 0.96, 0.02, 0.96, 0, 0, 0);
  for (const x of [-0.3, 0, 0.3]) {
    k.box('glass', 0.2, 0.1, 0.66, x, 0.02, -0.08);
    k.add('glass', new THREE.CylinderGeometry(0.115, 0.115, 0.66, 3).rotateX(-Math.PI / 2).scale(1, 0.45, 1).translate(x, 0.12 + 0.0575 * 0.45, -0.08)); // a pitched glass roof
    for (let i = 0; i < 5; i++) k.box('rib', 0.214, 0.125, 0.014, x, 0.02, -0.4 + i * 0.16);
    k.box('rib', 0.03, 0.012, 0.68, x, 0.166, -0.08);
    k.box('hydro', 0.16, 0.008, 0.14, x, 0.02, 0.36);
  }
  for (const x of [-0.15, 0.15]) k.box('glow', 0.012, 0.006, 0.9, x, 0.02, 0);
  k.cyl('rib', 0.035, 0.045, 0.2, 6, 0.4, 0.02, 0.4);
  k.cyl('team', 0.06, 0.06, 0.025, 8, 0.4, 0.22, 0.4);
  return k.parts();
}

export interface Built { style: string; kind: string; footprint: number; parts: ModelPart[] }

/** Every model built in code, made once (the model set keeps them for the life of the page). */
export function builtModels(): Built[] {
  return [
    { style: 'primitive', kind: 'capital', footprint: 0.82, parts: capital() },
    { style: 'primitive', kind: 'city', footprint: 0.8, parts: city() },
    { style: 'primitive', kind: 'town', footprint: 0.78, parts: town() },
    { style: 'primitive', kind: 'village', footprint: 0.8, parts: village() },
    { style: 'primitive', kind: 'farm', footprint: 0.8, parts: farm() },
    { style: 'primitive', kind: 'temple', footprint: 0.7, parts: temple() },
    { style: 'primitive', kind: 'fort', footprint: 0.7, parts: fort() },
    { style: 'arcology', kind: 'farm', footprint: 0.8, parts: glasshouse() },
  ];
}
