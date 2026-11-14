// Code-built prototypes of the four proposed model sets (docs/research/nation-identity.md section 2).
// Each layout uses the Kit (a mirror of assets/blender/styles_kit.py) in Blender coordinates, so the
// owner can retype it into styles_defs.py or import the exported GLB as a starting point.
// Every model: under 1500 triangles, fits 1 x 1 x 1, +Y up, origin at base centre, one part 'team'.
import * as THREE from 'three';
import { Kit, type Palette } from './kit';

export const PROTO_STYLES = ['soviet_bloc', 'western_modern', 'egyptian', 'highland'] as const;
export type ProtoStyle = (typeof PROTO_STYLES)[number];
export const PROTO_KINDS = ['capital', 'city', 'town', 'temple', 'fort'] as const;
export type ProtoKind = (typeof PROTO_KINDS)[number];
export type HighlandVariant = 'himalayan' | 'andean' | 'alpine';
export const HIGHLAND_VARIANTS: HighlandVariant[] = ['himalayan', 'andean', 'alpine'];

const PI = Math.PI;

// Palettes verbatim from nation-identity.md section 2 (plus a 'dark' slot for poles and openings).
export const PALETTES: Record<ProtoStyle, Palette> = {
  soviet_bloc: { panel: '#A8A8A0', dark: '#6E6E68', sand: '#C9B79A', gold: '#D4A93A', ground: '#5A5A55', pole: '#3A3A36' },
  western_modern: { glass: '#7FB6CC', darkglass: '#3E5566', stone: '#EDE6D6', brick: '#9A6B4F', lawn: '#5E8C4A', pole: '#3A3A3A' },
  egyptian: { lime: '#E6D3A3', sand: '#C8A26A', mud: '#8A6A45', lapis: '#2F6E9E', gold: '#D4A93A', dark: '#3E2E1E' },
  highland: {}, // per variant, below
};
export const HIGHLAND_PALETTES: Record<HighlandVariant, Palette> = {
  himalayan: { wall: '#F2EEE4', band: '#8E2A1E', roof: '#D4A93A', terrace: '#8C8273', rock: '#7A7266', dark: '#3A2E26' },
  andean: { wall: '#8C8273', band: '#6E665A', roof: '#B5543A', terrace: '#6F8F4E', rock: '#6E665A', dark: '#3A3026' },
  alpine: { wall: '#E8E0D0', band: '#6B4A2E', roof: '#5B5F66', terrace: '#8E8B85', rock: '#7A776F', dark: '#4A3628' },
};

// ---------------------------------------------------------------- soviet_bloc

function sovietStar(b: Kit, x: number, y: number, z0: number, s: number): void {
  // The spire star: a small diamond turned 45 degrees (team).
  b.box(x, y, z0, s, s * 0.4, s, 'team', [0, PI / 4, 0]);
}

const soviet: Record<ProtoKind, (b: Kit) => void> = {
  capital(b) {
    b.box(0, -0.05, 0, 0.96, 0.9, 0.02, 'ground'); // parade square
    // Seven-tier wedding cake tower
    const tiers: [number, number][] = [[0.34, 0.14], [0.28, 0.12], [0.23, 0.1], [0.18, 0.09], [0.14, 0.08], [0.1, 0.07], [0.07, 0.06]];
    let z = 0.02;
    tiers.forEach(([w, h], i) => { b.box(0, 0.15, z, w, w, h, i % 2 === 0 ? 'sand' : 'panel'); z += h; });
    b.cone(0, 0.15, z, 0.03, 0.22, 'gold', 6);
    sovietStar(b, 0, 0.15, z + 0.2, 0.06);
    // Two slab wings
    for (const s of [-1, 1]) b.slab(s * 0.33, 0.12, 0.02, 0.18, 0.46, 0.3, 'sand', 5, 3);
    // Parade banners
    for (const s of [-1, 1]) b.flag(s * 0.18, -0.35, 0.02, 0.3, 0.1, 0.12, 'team', 'pole');
  },
  city(b) {
    for (const [i, y] of [-0.3, -0.06, 0.18].entries()) {
      b.slab(-0.12, y, 0, 0.6, 0.13, 0.28, 'panel', 5, 7);
      b.box(-0.12 + (i - 1) * 0.15, y, 0.28, 0.12, 0.02, 0.05, 'team'); // rooftop banner
    }
    b.box(-0.425, -0.3, 0.02, 0.012, 0.13, 0.24, 'team'); // one stripe on the end wall
    b.box(0.34, 0.28, 0, 0.16, 0.16, 0.58, 'dark'); // brutalist tower
    b.frustum(0.34, 0.28, 0.58, 0.2, 0.2, 0.12, 0.12, 0.08, 'panel');
    b.cyl(0.36, -0.28, 0, 0.04, 0.72, 'dark', 8, 0.03); // chimney
    b.cyl(0.36, -0.28, 0.6, 0.034, 0.05, 'team', 8);
  },
  town(b) {
    b.slab(0.02, 0.28, 0, 0.6, 0.14, 0.26, 'panel', 5, 7);
    b.slab(-0.3, -0.08, 0, 0.14, 0.44, 0.26, 'panel', 5, 1);
    b.box(-0.3, -0.08, 0.26, 0.1, 0.02, 0.05, 'team');
    // Small cultural palace with columns
    b.box(0.2, -0.16, 0, 0.32, 0.22, 0.13, 'sand');
    b.box(0.2, -0.16, 0.13, 0.34, 0.24, 0.025, 'panel');
    for (const k of [-1.5, -0.5, 0.5, 1.5]) b.cyl(0.2 + k * 0.07, -0.3, 0, 0.014, 0.13, 'panel', 6);
    b.box(0.2, -0.3, 0.13, 0.32, 0.05, 0.02, 'panel');
    b.box(0.2, -0.275, 0.155, 0.12, 0.012, 0.06, 'team'); // banner over the entrance
  },
  temple(b) {
    b.box(0, 0, 0, 0.9, 0.7, 0.02, 'ground');
    b.shed(-0.12, 0.08, 0.02, 0.5, 0.42, 0.32, 'dark', 0, 0.06); // wedge palace of culture
    b.box(-0.12, -0.135, 0.06, 0.5, 0.012, 0.03, 'team'); // red stripe along the wedge
    b.obelisk(0.3, -0.18, 0.02, 0.08, 0.68, 'panel', 'gold');
    sovietStar(b, 0.3, -0.18, 0.77, 0.07);
  },
  fort(b) {
    // Low blast wall with a gap at the front
    b.box(0, 0.4, 0, 0.84, 0.04, 0.06, 'panel');
    for (const s of [-1, 1]) {
      b.box(s * 0.4, 0, 0, 0.04, 0.84, 0.06, 'panel');
      b.box(s * 0.26, -0.4, 0, 0.32, 0.04, 0.06, 'panel');
    }
    b.battered(-0.08, 0.05, 0, 0.42, 0.32, 0.15, 'dark', 0.8); // bunker
    b.box(-0.08, -0.106, 0.05, 0.16, 0.012, 0.03, 'pole'); // firing slit
    // Radar dish on a mast
    b.box(0.22, 0.2, 0, 0.04, 0.04, 0.3, 'pole');
    b.cyl(0.22, 0.17, 0.32, 0.13, 0.04, 'panel', 10, 0.03, [PI / 4, 0, 0]);
    b.flag(0.24, -0.22, 0, 0.48, 0.16, 0.1, 'team', 'pole');
  },
};

// ---------------------------------------------------------------- western_modern

function glassTower(b: Kit, x: number, y: number, w: number, h: number, spire = false): void {
  b.tower(x, y, 0, w, w, h, 'glass', Math.max(3, Math.round(h * 14)));
  b.box(x, y, h, w + 0.01, w + 0.01, 0.03, 'team'); // tower crown strip
  if (spire) b.cone(x, y, h + 0.03, 0.02, 0.18, 'darkglass', 4);
}

function suburbHouse(b: Kit, x: number, y: number, rz: number): void {
  b.at(x, y, rz, () => {
    b.box(0, 0, 0, 0.14, 0.11, 0.08, 'stone');
    b.gable(0, 0, 0.08, 0.14, 0.11, 0.05, 'brick', 0, 0.015);
    b.box(0, -0.065, 0.045, 0.07, 0.03, 0.008, 'team'); // awning
  });
}

const western: Record<ProtoKind, (b: Kit) => void> = {
  capital(b) {
    b.box(0, 0, 0, 0.96, 0.96, 0.015, 'lawn');
    // Capitol: white base, colonnade ring, drum and dome
    b.box(0, -0.2, 0.015, 0.46, 0.28, 0.1, 'stone');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 2 * PI;
      b.cyl(Math.cos(a) * 0.1, -0.2 + Math.sin(a) * 0.1, 0.115, 0.01, 0.07, 'stone', 5);
    }
    b.cyl(0, -0.2, 0.115, 0.085, 0.075, 'stone', 10);
    b.lathe(0, -0.2, 0.19, [[0.1, 0], [0.093, 0.04], [0.07, 0.075], [0.038, 0.098], [0.0, 0.105]], 'stone', 10);
    b.cyl(0, -0.2, 0.29, 0.015, 0.04, 'stone', 6);
    b.flag(0, -0.2, 0.33, 0.12, 0.08, 0.05);
    // Portico
    for (const k of [-1.5, -0.5, 0.5, 1.5]) b.cyl(k * 0.05, -0.36, 0.015, 0.012, 0.1, 'stone', 6);
    b.gable(0, -0.36, 0.115, 0.22, 0.05, 0.04, 'stone', 0, 0.005);
    // Three glass towers of different heights
    glassTower(b, -0.3, 0.26, 0.17, 0.55);
    glassTower(b, 0.03, 0.3, 0.18, 0.82);
    glassTower(b, 0.32, 0.22, 0.16, 0.66);
  },
  city(b) {
    glassTower(b, -0.22, 0.2, 0.18, 0.6);
    glassTower(b, 0.08, 0.26, 0.19, 0.78, true);
    glassTower(b, 0.34, 0.06, 0.15, 0.5);
    glassTower(b, -0.05, -0.08, 0.15, 0.42);
    for (const [x, y, h] of [[-0.34, -0.3, 0.2], [-0.08, -0.36, 0.16], [0.22, -0.32, 0.24]] as const) {
      b.box(x, y, 0, 0.2, 0.18, h, 'brick');
      b.box(x, y, h, 0.21, 0.19, 0.015, 'stone');
    }
  },
  town(b) {
    b.box(0, 0, 0, 0.96, 0.96, 0.012, 'lawn');
    const angles = [-170, -135, -100, -65, -30, 5];
    angles.forEach((deg) => {
      const a = (deg * PI) / 180;
      suburbHouse(b, -0.05 + Math.cos(a) * 0.36, 0.02 + Math.sin(a) * 0.36, a + PI / 2);
    });
    // Clock-tower town hall
    b.box(0.22, 0.28, 0.012, 0.24, 0.16, 0.14, 'brick');
    b.gable(0.22, 0.28, 0.152, 0.24, 0.16, 0.05, 'darkglass', 0, 0.01);
    b.box(0.22, 0.2, 0.012, 0.07, 0.07, 0.38, 'stone');
    b.box(0.22, 0.164, 0.3, 0.045, 0.004, 0.045, 'darkglass'); // clock face
    b.cone(0.22, 0.2, 0.39, 0.055, 0.1, 'darkglass', 4, [0, 0, PI / 4]);
    b.flag(0.22, 0.2, 0.49, 0.1, 0.08, 0.05);
  },
  temple(b) {
    // Glass-and-steel spired church
    b.box(0, 0.08, 0, 0.26, 0.56, 0.22, 'stone');
    b.gable(0, 0.08, 0.22, 0.56, 0.26, 0.14, 'darkglass', PI / 2, 0.015);
    for (const y of [-0.06, 0.08, 0.22]) for (const s of [-1, 1]) b.box(s * 0.131, y, 0.04, 0.004, 0.05, 0.15, 'glass');
    b.tower(0, -0.26, 0, 0.14, 0.14, 0.46, 'glass', 6);
    b.box(0, -0.26, 0.46, 0.15, 0.15, 0.025, 'team');
    b.cone(0, -0.26, 0.485, 0.07, 0.42, 'darkglass', 4, [0, 0, PI / 4]);
    b.box(0, -0.26, 0.86, 0.012, 0.012, 0.1, 'team');
    b.box(0, -0.26, 0.92, 0.06, 0.012, 0.012, 'team');
  },
  fort(b) {
    // Star fort turned airbase: low wall square with four corner bastions
    b.box(0, 0, 0, 0.8, 0.8, 0.02, 'lawn');
    for (const s of [-1, 1]) {
      b.battered(0, s * 0.38, 0, 0.7, 0.05, 0.05, 'stone', 0.7);
      b.battered(s * 0.38, 0, 0, 0.05, 0.7, 0.05, 'stone', 0.7);
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) b.frustum(sx * 0.4, sy * 0.4, 0, 0.14, 0.14, 0.1, 0.1, 0.06, 'stone', PI / 4);
    b.vault(-0.08, 0.12, 0.02, 0.15, 0.42, 'darkglass', 0, 6); // hangar
    b.box(-0.08, -0.095, 0.02, 0.2, 0.01, 0.1, 'team'); // hangar door stripe
    // Control tower
    b.cyl(0.24, -0.18, 0.02, 0.03, 0.26, 'stone', 6);
    b.cyl(0.24, -0.18, 0.28, 0.05, 0.06, 'glass', 8, 0.07);
    b.cyl(0.24, -0.18, 0.34, 0.072, 0.015, 'darkglass', 8);
    b.box(0.24, 0.24, 0.02, 0.025, 0.025, 0.2, 'pole');
    b.box(0.24, 0.24, 0.22, 0.12, 0.02, 0.04, 'stone', [0, 0, 0.5]); // radar bar
    b.flag(0.32, -0.32, 0.02, 0.3, 0.1, 0.06);
  },
};

// ---------------------------------------------------------------- egyptian

/** Pylon: two tapered towers, a lintel between, a lapis cornice and two banner poles (team). */
function pylon(b: Kit, x: number, y: number, s: number): void {
  b.at(x, y, 0, () => {
    for (const k of [-1, 1]) {
      b.battered(k * 0.13 * s, 0, 0, 0.2 * s, 0.09 * s, 0.34 * s, 'sand', 0.8);
      b.box(k * 0.13 * s, 0, 0.33 * s, 0.17 * s, 0.075 * s, 0.025 * s, 'lapis');
      b.box(k * 0.13 * s, -0.055 * s, 0, 0.012, 0.012, 0.44 * s, 'dark');
      b.box(k * 0.13 * s + 0.03 * s, -0.055 * s, 0.34 * s, 0.06 * s, 0.008, 0.09 * s, 'team');
    }
    b.box(0, 0, 0, 0.08 * s, 0.07 * s, 0.24 * s, 'lime');
    b.box(0, 0, 0.24 * s, 0.12 * s, 0.08 * s, 0.04 * s, 'sand');
    b.box(0, -0.036 * s, 0, 0.05 * s, 0.002, 0.15 * s, 'dark');
  });
}

const egyptian: Record<ProtoKind, (b: Kit) => void> = {
  capital(b) {
    b.box(0, 0, 0, 0.96, 0.96, 0.015, 'sand');
    pylon(b, -0.08, -0.1, 1);
    for (const s of [-1, 1]) b.obelisk(-0.08 + s * 0.12, -0.36, 0.015, 0.045, 0.34, 'lime', 'team');
    b.box(-0.08, 0.22, 0.015, 0.44, 0.3, 0.15, 'lime'); // temple box behind
    b.box(-0.08, 0.22, 0.165, 0.46, 0.32, 0.025, 'lapis');
    for (const k of [-1.5, -0.5, 0.5, 1.5]) b.cyl(-0.08 + k * 0.09, 0.06, 0.015, 0.02, 0.15, 'sand', 6); // hypostyle
    b.frustum(0.33, 0.3, 0.015, 0.3, 0.3, 0, 0, 0.24, 'lime'); // pyramid
    b.frustum(0.33, 0.3, 0.215, 0.055, 0.055, 0, 0, 0.04, 'gold');
  },
  city(b) {
    b.box(0, 0, 0, 0.96, 0.96, 0.012, 'sand');
    const grid: [number, number, number][] = [[-0.34, -0.32, 0.09], [-0.12, -0.34, 0.12], [0.1, -0.33, 0.08], [0.33, -0.3, 0.11],
      [-0.35, -0.08, 0.12], [0.34, -0.06, 0.09], [-0.34, 0.16, 0.08], [0.33, 0.17, 0.12]];
    grid.forEach(([x, y, h], i) => {
      b.box(x, y, 0.012, 0.17, 0.16, h, 'mud');
      if (i % 2 === 0) b.box(x + 0.04, y + 0.03, 0.012 + h, 0.06, 0.06, 0.03, 'lime'); // roof stair hut
    });
    pylon(b, 0, 0.0, 0.62);
    b.box(0, 0.1, 0.012, 0.22, 0.14, 0.12, 'lime'); // small temple behind the pylon
    for (const [x, y] of [[-0.12, 0.38], [0.02, 0.38], [0.16, 0.38]] as const) {
      b.cyl(x, y, 0.012, 0.055, 0.05, 'mud', 8);
      b.lathe(x, y, 0.062, [[0.055, 0], [0.045, 0.04], [0.02, 0.07], [0, 0.08]], 'lime', 8); // granary domes
    }
  },
  town(b) {
    b.box(0, 0, 0, 0.9, 0.9, 0.012, 'sand');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 2 * PI + 0.3;
      const x = Math.cos(a) * 0.3, y = Math.sin(a) * 0.3;
      const h = 0.09 + 0.03 * (i % 3);
      b.at(x, y, a, () => {
        b.box(0, 0, 0.012, 0.15, 0.16, h, 'mud');
        b.box(0, 0, 0.012 + h, 0.155, 0.165, 0.015, 'lime'); // parapet roof
        b.box(0.076, 0, 0.012, 0.004, 0.04, 0.07, 'dark'); // door on the street side
      });
    }
    b.obelisk(0, 0, 0.012, 0.06, 0.48, 'lime', 'team');
  },
  temple(b) {
    // Step pyramid (Djoser style), six steps, with a front stair and banner poles
    b.box(0, 0, 0, 0.98, 0.9, 0.015, 'sand');
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const w = 0.86 - i * 0.13, d = 0.7 - i * 0.1;
      b.battered(0, 0.04, 0.015 + i * 0.09, w, d, 0.09, i % 2 === 0 ? 'lime' : 'sand', 0.94);
    }
    b.frustum(0, -0.38, 0.015, 0.1, 0.12, 0.08, 0.02, 0.1, 'sand', 0, 0, 0.05); // entrance ramp
    for (const s of [-1, 1]) {
      b.box(s * 0.12, -0.4, 0.015, 0.012, 0.012, 0.26, 'dark');
      b.box(s * 0.12 + 0.03, -0.4, 0.2, 0.06, 0.008, 0.075, 'team');
    }
  },
  fort(b) {
    const half = 0.38;
    for (const s of [-1, 1]) {
      b.battered(0, s * half, 0, 2 * half, 0.09, 0.2, 'mud', 0.7);
      b.battered(s * half, 0, 0, 0.09, 2 * half, 0.2, 'mud', 0.7);
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      b.battered(sx * half, sy * half, 0, 0.17, 0.17, 0.3, 'mud', 0.8);
      b.box(sx * half, sy * half, 0.3, 0.14, 0.14, 0.02, 'sand');
    }
    b.box(0, -half - 0.02, 0, 0.18, 0.08, 0.26, 'sand'); // gate block
    b.box(0, -half - 0.062, 0, 0.07, 0.004, 0.15, 'dark');
    b.box(0, 0.06, 0, 0.26, 0.22, 0.16, 'mud'); // inner keep
    b.flag(0, -half - 0.02, 0.26, 0.2, 0.1, 0.07);
  },
};

// ---------------------------------------------------------------- highland

/** Dzong-style house: battered whitewashed block, ochre band under a low roof. */
function dzongHouse(b: Kit, x: number, y: number, z0: number, w: number, d: number, h: number): void {
  b.battered(x, y, z0, w, d, h, 'wall', 0.88);
  b.box(x, y, z0 + h - 0.02, w * 0.9, d * 0.9, 0.025, 'band');
  b.frustum(x, y, z0 + h + 0.005, w * 0.98, d * 0.98, w * 0.5, d * 0.5, 0.04, 'roof');
}

/** Chalet: plaster box, timber band, shallow gable with wide eaves. */
function chalet(b: Kit, x: number, y: number, z0: number, rz: number): void {
  b.at(x, y, rz, () => {
    b.box(0, 0, z0, 0.18, 0.14, 0.1, 'wall');
    b.box(0, 0, z0 + 0.1, 0.18, 0.14, 0.04, 'band');
    b.gable(0, 0, z0 + 0.14, 0.18, 0.14, 0.05, 'roof', 0, 0.035);
    b.box(0, -0.072, z0 + 0.06, 0.08, 0.008, 0.012, 'team'); // banner under the eaves
  });
}

const highland: Record<ProtoKind, (b: Kit) => void> = {
  capital(b) {
    const z = b.terrace(0, 0.03, 0, 0.98, 0.9, 3, 0.07, 0.08, 'terrace', 0.02);
    b.battered(0, 0.07, z, 0.54, 0.42, 0.3, 'wall', 0.86); // dzong outer block
    b.box(0, 0.07, z + 0.24, 0.48, 0.37, 0.04, 'band');
    for (const k of [-1, 0, 1]) b.box(k * 0.14, -0.142, z + 0.12, 0.04, 0.006, 0.05, 'dark'); // small windows
    const z2 = z + 0.3;
    b.battered(0, 0.07, z2, 0.2, 0.18, 0.18, 'wall', 0.9); // central tower
    b.box(0, 0.07, z2 + 0.15, 0.19, 0.17, 0.03, 'team'); // roof band
    b.frustum(0, 0.07, z2 + 0.18, 0.3, 0.28, 0.2, 0.18, 0.025, 'roof'); // flared roof, lower flare
    b.frustum(0, 0.07, z2 + 0.205, 0.2, 0.18, 0.04, 0.04, 0.08, 'roof');
    b.cyl(0, 0.07, z2 + 0.285, 0.015, 0.05, 'roof', 6);
    b.flag(-0.3, -0.3, 0.07, 0.3, 0.08, 0.1); // prayer banner on the lower terrace
    b.flag(0.3, -0.3, 0.07, 0.3, 0.08, 0.1);
  },
  city(b) {
    // Four terrace levels climbing to the back; level i starts at yf and runs to the back edge
    for (let i = 0; i < 4; i++) {
      const yf = -0.48 + i * 0.24, z = (i + 1) * 0.07;
      b.box(0, (yf + 0.48) / 2, 0, 0.96, 0.48 - yf, z, 'terrace');
      const xs = i === 3 ? [-0.3, 0.0] : [-0.3, 0.02, 0.32];
      xs.forEach((x, j) => dzongHouse(b, x, yf + 0.12, z, 0.17, 0.12, 0.09 + 0.02 * ((i + j) % 2)));
    }
    // Watchtower on the top level
    b.battered(0.32, 0.36, 0.28, 0.13, 0.13, 0.38, 'wall', 0.82);
    b.box(0.32, 0.36, 0.6, 0.11, 0.11, 0.04, 'team');
    b.frustum(0.32, 0.36, 0.66, 0.16, 0.16, 0.0, 0.0, 0.1, 'roof');
  },
  town(b) {
    b.box(0, 0.0, 0, 0.96, 0.96, 0.06, 'terrace');
    b.box(0, 0.24, 0.06, 0.96, 0.48, 0.08, 'terrace');
    chalet(b, -0.22, -0.26, 0.06, 0.1);
    chalet(b, 0.22, -0.24, 0.06, -0.1);
    chalet(b, -0.22, 0.22, 0.14, 0);
    chalet(b, 0.22, 0.24, 0.14, 0.15);
    b.box(0, -0.24, 0.0, 0.08, 0.06, 0.06, 'rock'); // steps up the terrace
  },
  temple(b) {
    // Monastery clinging to an angled cliff
    b.frustum(0.12, 0.08, 0, 0.62, 0.56, 0.28, 0.3, 0.7, 'rock', 0, 0.1, 0.06);
    b.frustum(-0.26, -0.1, 0, 0.3, 0.3, 0.12, 0.12, 0.2, 'rock');
    b.box(-0.1, -0.08, 0.3, 0.36, 0.32, 0.03, 'rock'); // ledge
    dzongHouse(b, -0.13, -0.08, 0.33, 0.3, 0.24, 0.22);
    dzongHouse(b, 0.08, -0.12, 0.2, 0.16, 0.12, 0.13);
    b.box(-0.13, -0.2, 0.43, 0.2, 0.01, 0.04, 'team'); // banner across the front
    b.flag(-0.24, -0.16, 0.6, 0.18, 0.08, 0.06);
  },
  fort(b) {
    // Gate tower spanning the notch between two rocks
    for (const s of [-1, 1]) b.frustum(s * 0.3, 0, 0, 0.4, 0.6, 0.12, 0.24, 0.58, 'rock', 0, -s * 0.05, 0);
    b.box(0, 0, 0, 0.42, 0.18, 0.24, 'wall'); // bridge wall
    b.box(0, 0, 0.2, 0.42, 0.19, 0.03, 'band');
    b.box(0, -0.092, 0, 0.1, 0.004, 0.14, 'dark'); // gate opening
    b.battered(0, 0, 0.23, 0.2, 0.16, 0.24, 'wall', 0.88);
    b.box(0, 0, 0.42, 0.18, 0.15, 0.04, 'team');
    b.frustum(0, 0, 0.47, 0.26, 0.22, 0.04, 0.04, 0.1, 'roof');
  },
};

const SETS: Record<ProtoStyle, Record<ProtoKind, (b: Kit) => void>> = {
  soviet_bloc: soviet, western_modern: western, egyptian, highland,
};

export function isProtoStyle(s: string): s is ProtoStyle {
  return (PROTO_STYLES as readonly string[]).includes(s);
}

/**
 * Build one prototype model. A fresh group each call (one mesh per material slot, the team mesh
 * and material named 'team'). userData.tris holds the triangle count.
 */
export function protoModel(style: ProtoStyle, kind: ProtoKind, variant: HighlandVariant = 'himalayan'): THREE.Group {
  const palette = style === 'highland' ? HIGHLAND_PALETTES[variant] : PALETTES[style];
  const b = new Kit(style, palette);
  SETS[style][kind](b);
  const g = b.build(`${style}_${kind}`);
  if (import.meta.env.DEV && g.userData.tris > 1500) console.warn(`proto: ${style}/${kind} has ${g.userData.tris} triangles (budget 1500)`);
  return g;
}
