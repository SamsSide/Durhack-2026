// Code-built wonder models, used until the X4 manifest has `wonders.<kind>`. Each one: +Y up, origin at the
// centre of its base, about 1 x 1 wide, flat shaded, well under 3,000 triangles, with a `team` part. Lane b.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ModelPart } from '../structures/models';
import type { WonderKind } from './types';

type Mat = 'stone' | 'light' | 'sand' | 'marble' | 'bronze' | 'glass' | 'steel' | 'gold' | 'roof' | 'team';

const MATS: Record<Mat, () => THREE.MeshStandardMaterial> = {
  stone: () => new THREE.MeshStandardMaterial({ color: '#9a9184', roughness: 0.95, flatShading: true }),
  light: () => new THREE.MeshStandardMaterial({ color: '#d8d0c0', roughness: 0.9, flatShading: true }),
  sand: () => new THREE.MeshStandardMaterial({ color: '#d9b77a', roughness: 0.95, flatShading: true }),
  marble: () => new THREE.MeshStandardMaterial({ color: '#f1ece2', roughness: 0.6, flatShading: true }),
  bronze: () => new THREE.MeshStandardMaterial({ color: '#7f9a7a', roughness: 0.5, metalness: 0.5, flatShading: true }),
  glass: () => new THREE.MeshStandardMaterial({ color: '#86b6d8', roughness: 0.18, metalness: 0.65, emissive: '#1b3550', emissiveIntensity: 0.35, flatShading: true }),
  steel: () => new THREE.MeshStandardMaterial({ color: '#b9c0c8', roughness: 0.35, metalness: 0.7, flatShading: true }),
  gold: () => new THREE.MeshStandardMaterial({ color: '#d9b450', roughness: 0.3, metalness: 0.8, emissive: '#5a4310', emissiveIntensity: 0.4, flatShading: true }),
  roof: () => new THREE.MeshStandardMaterial({ color: '#5b6a78', roughness: 0.85, flatShading: true }),
  team: () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, flatShading: true }),
};

class Builder {
  private bins = new Map<Mat, THREE.BufferGeometry[]>();
  add(mat: Mat, g: THREE.BufferGeometry, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0): this {
    let geo = g.index ? g.toNonIndexed() : g;
    geo.deleteAttribute('uv');
    if (rx || ry || rz) geo = geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
    geo.translate(x, y, z);
    const list = this.bins.get(mat) ?? [];
    list.push(geo);
    this.bins.set(mat, list);
    return this;
  }
  /** Box with its base at y. */
  box(mat: Mat, w: number, h: number, d: number, x = 0, y = 0, z = 0, ry = 0): this {
    return this.add(mat, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, ry);
  }
  /** Cylinder (or n-sided prism) with its base at y. */
  cyl(mat: Mat, rTop: number, rBot: number, h: number, x = 0, y = 0, z = 0, seg = 12): this {
    return this.add(mat, new THREE.CylinderGeometry(rTop, rBot, h, seg), x, y + h / 2, z);
  }
  cone(mat: Mat, r: number, h: number, x = 0, y = 0, z = 0, seg = 8, ry = 0): this {
    return this.add(mat, new THREE.ConeGeometry(r, h, seg), x, y + h / 2, z, ry);
  }
  dome(mat: Mat, r: number, x = 0, y = 0, z = 0, seg = 12): this {
    return this.add(mat, new THREE.SphereGeometry(r, seg, Math.max(4, seg / 2), 0, Math.PI * 2, 0, Math.PI / 2), x, y, z);
  }
  ball(mat: Mat, r: number, x = 0, y = 0, z = 0): this {
    return this.add(mat, new THREE.IcosahedronGeometry(r, 0), x, y, z);
  }
  parts(): ModelPart[] {
    const out: ModelPart[] = [];
    for (const [mat, list] of this.bins) {
      const geometry = mergeGeometries(list, false);
      if (!geometry) continue;
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      out.push({ geometry, material: MATS[mat](), team: mat === 'team' });
    }
    return out;
  }
}

function pyramid(b: Builder): void {
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    const w = 1 - i * 0.13, h = 0.1;
    b.box(i % 2 ? 'sand' : 'light', w, h, w, 0, i * h);
  }
  // Stair up the front, and a team-coloured shrine on top.
  b.box('stone', 0.16, 0.7, 0.08, 0, 0, 0.47 - 0.35, 0);
  b.box('team', 0.16, 0.12, 0.16, 0, steps * 0.1);
  b.cone('gold', 0.1, 0.1, 0, steps * 0.1 + 0.12, 0, 4, Math.PI / 4);
}

function mausoleum(b: Builder): void {
  b.box('light', 1, 0.08, 1);
  b.box('marble', 0.56, 0.36, 0.56, 0, 0.08);
  b.box('team', 0.2, 0.22, 0.02, 0, 0.08, 0.285);        // arch in the nation's colour
  b.cyl('marble', 0.2, 0.22, 0.08, 0, 0.44, 0, 16);       // drum
  b.dome('marble', 0.24, 0, 0.52, 0, 16);
  b.cone('gold', 0.03, 0.14, 0, 0.75);
  for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]] as const) {
    b.cyl('marble', 0.035, 0.045, 0.62, x, 0.08, z, 8);
    b.cyl('team', 0.05, 0.05, 0.03, x, 0.5, z, 8);          // balcony band
    b.dome('marble', 0.045, x, 0.7, z, 8);
    b.cone('gold', 0.012, 0.06, x, 0.74, z, 4);
  }
}

function colossus(b: Builder): void {
  b.box('stone', 0.7, 0.12, 0.7);
  b.box('light', 0.5, 0.14, 0.5, 0, 0.12);
  b.box('team', 0.52, 0.04, 0.52, 0, 0.2);                 // banner band round the plinth
  // Figure, about 0.7 tall, standing astride.
  b.box('bronze', 0.07, 0.3, 0.08, -0.07, 0.26, 0, 0).box('bronze', 0.07, 0.3, 0.08, 0.07, 0.26, 0, 0);
  b.box('bronze', 0.22, 0.24, 0.12, 0, 0.55);
  b.add('bronze', new THREE.BoxGeometry(0.24, 0.12, 0.13), 0, 0.62, 0);  // shoulders
  b.ball('bronze', 0.07, 0, 0.76, 0);
  for (let i = 0; i < 7; i++) b.cone('bronze', 0.015, 0.06, Math.cos(i) * 0.05, 0.8, Math.sin(i) * 0.03, 4); // crown of rays
  b.add('bronze', new THREE.BoxGeometry(0.06, 0.3, 0.06), 0.15, 0.8, 0, 0, 0, -0.25);  // raised arm
  b.add('bronze', new THREE.BoxGeometry(0.05, 0.22, 0.05), -0.14, 0.52, 0, 0, 0, 0.15); // lowered arm
  b.cyl('gold', 0.035, 0.02, 0.06, 0.19, 0.94, 0, 6);
  b.ball('gold', 0.04, 0.19, 1.02, 0);                     // torch flame
}

function cathedral(b: Builder): void {
  b.box('stone', 0.5, 0.05, 1);
  b.box('light', 0.32, 0.34, 0.8, 0, 0.05, 0.05);          // nave
  b.add('team', new THREE.CylinderGeometry(0.2, 0.2, 0.8, 3), 0, 0.45, 0.05, 0, Math.PI / 2, 0); // pitched roof
  b.box('light', 0.62, 0.28, 0.2, 0, 0.05, 0.1);           // transept
  b.add('team', new THREE.CylinderGeometry(0.15, 0.15, 0.62, 3), 0, 0.38, 0.1, Math.PI / 2, Math.PI / 2, 0);
  b.cyl('light', 0.14, 0.16, 0.1, 0, 0.05, 0.42, 10);      // apse
  for (const x of [-0.12, 0.12]) {                          // twin towers and spires at the west front
    b.box('light', 0.12, 0.6, 0.12, x, 0.05, -0.4);
    b.cone('roof', 0.085, 0.36, x, 0.65, -0.4, 4, Math.PI / 4);
    b.cone('gold', 0.012, 0.05, x, 1.0, -0.4, 4);
  }
  b.box('gold', 0.08, 0.08, 0.01, 0, 0.3, -0.465);         // rose window
  b.cone('roof', 0.06, 0.25, 0, 0.55, 0.1, 4, Math.PI / 4); // crossing spire
}

function palaceOfSoviets(b: Builder): void {
  b.box('stone', 0.9, 0.08, 0.9);
  const tiers = [[0.42, 0.16], [0.34, 0.14], [0.27, 0.13], [0.2, 0.12], [0.14, 0.1]] as const;
  let y = 0.08;
  tiers.forEach(([r, h], i) => {
    b.cyl(i === 1 ? 'team' : 'light', r, r, h, 0, y, 0, 16);
    for (let k = 0; k < 12; k++) {                          // columns round each tier
      const a = (k / 12) * Math.PI * 2;
      b.box('stone', 0.02, h * 0.9, 0.02, Math.cos(a) * r * 1.02, y, Math.sin(a) * r * 1.02);
    }
    y += h;
  });
  // Statue on top: a plinth, a figure with an arm raised.
  b.box('steel', 0.08, 0.04, 0.08, 0, y);
  b.box('steel', 0.05, 0.13, 0.04, 0, y + 0.04);
  b.ball('steel', 0.025, 0, y + 0.2, 0);
  b.add('steel', new THREE.BoxGeometry(0.02, 0.12, 0.02), 0.04, y + 0.23, 0, 0, 0, -0.3);
  b.cone('gold', 0.02, 0.04, 0.06, y + 0.29, 0, 5);
}

function skyscraper(b: Builder): void {
  b.box('steel', 0.7, 0.1, 0.7);                            // podium
  b.box('glass', 0.38, 0.7, 0.38, 0, 0.1);
  b.box('glass', 0.3, 0.14, 0.3, 0, 0.8);                   // setback
  b.box('team', 0.31, 0.03, 0.31, 0, 0.94);                 // crown band
  b.box('steel', 0.2, 0.05, 0.2, 0, 0.97);
  for (let y = 0.2; y < 0.8; y += 0.1) b.box('steel', 0.39, 0.008, 0.39, 0, y); // floor lines
  b.cyl('steel', 0.006, 0.012, 0.2, 0, 1.02, 0, 4);         // antenna
  b.ball('gold', 0.012, 0, 1.22, 0);
}

function spaceElevator(b: Builder): void {
  b.cyl('steel', 0.45, 0.5, 0.06, 0, 0, 0, 16);              // ground station
  b.cyl('team', 0.46, 0.46, 0.03, 0, 0.06, 0, 16);
  b.dome('glass', 0.18, 0, 0.09, 0, 12);
  for (let k = 0; k < 3; k++) {                               // anchor struts
    const a = (k / 3) * Math.PI * 2;
    b.add('steel', new THREE.BoxGeometry(0.03, 0.45, 0.03), Math.cos(a) * 0.14, 0.25, Math.sin(a) * 0.14, -a, 0, 0.45);
  }
  b.cyl('steel', 0.018, 0.03, 8, 0, 0.1, 0, 6);              // the tether, far into the sky
  b.box('gold', 0.07, 0.06, 0.07, 0, 2.6);                   // a climber on its way up
  b.box('gold', 0.05, 0.05, 0.05, 0, 5.4);
  b.cyl('steel', 0.12, 0.12, 0.08, 0, 8.05, 0, 10);          // orbital station
  b.cyl('team', 0.25, 0.25, 0.02, 0, 8.08, 0, 16);
}

/** The piece drawn on the wonder's own tile for the Great Wall: a gatehouse in the wall. */
function greatWallGate(b: Builder): void {
  b.box('stone', 1, 0.22, 0.2);
  for (let i = 0; i < 9; i++) b.box('stone', 0.06, 0.05, 0.22, -0.48 + i * 0.12, 0.22); // crenellations
  b.box('light', 0.34, 0.42, 0.34);
  b.box('stone', 0.38, 0.04, 0.38, 0, 0.42);
  b.cone('team', 0.3, 0.2, 0, 0.46, 0, 4, Math.PI / 4);      // tiled roof in the nation's colour
  for (const x of [-0.5, 0.5]) { b.box('light', 0.2, 0.32, 0.24, x, 0); b.cone('team', 0.17, 0.12, x, 0.32, 0, 4, Math.PI / 4); }
}

const BUILD: Record<WonderKind, (b: Builder) => void> = {
  great_wall: greatWallGate, mausoleum, pyramid, colossus, cathedral,
  palace_of_soviets: palaceOfSoviets, skyscraper, space_elevator: spaceElevator,
};

const cache = new Map<WonderKind, ModelPart[]>();

export function fallbackWonder(kind: WonderKind): ModelPart[] {
  let parts = cache.get(kind);
  if (!parts) { const b = new Builder(); BUILD[kind](b); parts = b.parts(); cache.set(kind, parts); }
  return parts;
}

/** Height of a part list (top of its bounding box), for the build clip and the scaffold. */
export function partsHeight(parts: ModelPart[]): number {
  let h = 0;
  for (const p of parts) {
    if (!p.geometry.boundingBox) p.geometry.computeBoundingBox();
    h = Math.max(h, p.geometry.boundingBox!.max.y);
  }
  return h || 1;
}

/** A thin lattice frame round the model: corner and middle poles, a ring every level, a brace per bay. */
export function scaffoldGeometry(height: number, half = 0.55): THREE.BufferGeometry {
  const h = Math.min(height, 1.3);
  const levels = Math.max(3, Math.round(h / 0.12));
  const pts: number[] = [];
  const seg = (a: number[], c: number[]) => pts.push(a[0]!, a[1]!, a[2]!, c[0]!, c[1]!, c[2]!);
  const ring = [[-half, -half], [0, -half], [half, -half], [half, 0], [half, half], [0, half], [-half, half], [-half, 0]] as const;
  for (const [x, z] of ring) seg([x, 0, z], [x, h, z]);
  for (let l = 0; l <= levels; l++) {
    const y = (l / levels) * h;
    for (let i = 0; i < ring.length; i++) {
      const [x0, z0] = ring[i]!, [x1, z1] = ring[(i + 1) % ring.length]!;
      seg([x0, y, z0], [x1, y, z1]);
      if (l < levels) {
        const y1 = ((l + 1) / levels) * h;
        if ((i + l) % 2 === 0) seg([x0, y, z0], [x1, y1, z1]); else seg([x1, y, z1], [x0, y1, z0]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}
