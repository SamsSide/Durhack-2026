// Small instanced props that make a nation read at a glance (docs/research/nation-identity.md 3.4):
// banners, statues, obelisks, smokestacks, radio masts, halos, barrels, cranes, watchtowers, standing
// stones, spires and the stone platforms of terraced mountain towns. Every one is built from primitives
// in code, under 100 triangles, in a unit where 1 is one building footprint (and about one storey).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Gov } from './identity';
import type { Identity } from './identity';

export type PropKind =
  | 'platform' | 'banner' | 'statue' | 'obelisk' | 'smokestack' | 'mast' | 'ring' | 'barrel'
  | 'crane' | 'watchtower' | 'stones' | 'spire';

export interface PropPart { geometry: THREE.BufferGeometry; material: THREE.Material; team: boolean; color: THREE.Color }
export type PropSet = Record<PropKind, PropPart[]>;

const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0, ry = 0): THREE.BufferGeometry =>
  new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y + h / 2, z);
const cyl = (rt: number, rb: number, h: number, seg: number, y = 0, x = 0, z = 0): THREE.BufferGeometry =>
  new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y + h / 2, z);
const merge = (gs: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const m = mergeGeometries(gs, false);
  gs.forEach((g) => g.dispose());
  return m ?? new THREE.BoxGeometry(0.1, 0.1, 0.1);
};

function part(geometry: THREE.BufferGeometry, color: string, team = false, glow = false): PropPart {
  const material: THREE.Material = glow
    ? new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })
    : new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.9 });
  return { geometry, material, team, color: new THREE.Color(color) };
}

/** Build every prop mesh once per field; the field disposes them. */
export function makePropSet(): PropSet {
  const stones: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    stones.push(box(0.07, 0.22 + 0.05 * (i % 2), 0.045, Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26, -a));
  }
  return {
    platform: [part(cyl(0.5, 0.58, 1, 8), '#8d8a82')],
    banner: [
      part(box(0.03, 1.0, 0.03), '#cfc6b0'),
      part(box(0.3, 0.2, 0.02, 0.165, 0.76, 0), '#ffffff', true),
    ],
    statue: [part(merge([box(0.3, 0.26, 0.3), cyl(0.05, 0.09, 0.42, 5, 0.26), new THREE.SphereGeometry(0.075, 5, 4).translate(0, 0.76, 0)]), '#d6d0bd')],
    obelisk: [part(merge([cyl(0.045, 0.1, 0.9, 4), cyl(0.0, 0.045, 0.14, 4, 0.9)]), '#dcd6c4')],
    smokestack: [part(merge([cyl(0.07, 0.1, 0.78, 7), cyl(0.075, 0.075, 0.06, 7, 0.78)]), '#8a5a45')],
    mast: [part(merge([cyl(0.012, 0.03, 1.5, 4), box(0.3, 0.015, 0.015, 0, 1.0), box(0.2, 0.015, 0.015, 0, 1.25)]), '#cfd4d8')],
    ring: [part(new THREE.TorusGeometry(0.24, 0.03, 4, 12).rotateX(Math.PI / 2), '#ffffff', true, true)],
    barrel: [
      part(cyl(0.06, 0.06, 0.13, 6), '#8a4a2a'),
      part(cyl(0, 0.05, 0.14, 5, 0.13), '#ff8a3a', false, true),
    ],
    crane: [
      part(merge([box(0.05, 0.82, 0.05), box(0.55, 0.045, 0.045, 0.2, 0.8)]), '#b08a3c'),
      part(merge([box(0.12, 0.1, 0.1, 0.3, 0), box(0.1, 0.08, 0.1, 0.42, 0)]), '#6b4a2a'),
    ],
    watchtower: [
      part(merge([cyl(0.07, 0.1, 0.55, 4), box(0.22, 0.07, 0.22, 0, 0.55)]), '#8d8573'),
      part(cyl(0, 0.16, 0.14, 4, 0.62), '#ffffff', true),
    ],
    stones: [part(merge(stones), '#9a968c')],
    spire: [part(cyl(0.04, 0.06, 0.55, 5), '#efe6cf'), part(cyl(0, 0.055, 0.2, 5, 0.55), '#d4a93a')],
  };
}

export function disposePropSet(set: PropSet): void {
  for (const parts of Object.values(set)) for (const p of parts) { p.geometry.dispose(); p.material.dispose(); }
}

export interface Smoke { color: string; puffs: number }
export interface PropSpec {
  kind: PropKind;
  ang: number;      // radians relative to the settlement's free arc
  rad: number;      // fraction of tile width from the settlement centre
  scale: number;    // multiplier on the settlement's size
  lift?: number;    // height above the ground, in building sizes
  smoke?: Smoke;
}

export interface PropCtx {
  kind: string; id: Identity; border: boolean; coastal: boolean;
  /** A tribe of a very early world (towns/ageStyle): standing stones only, nothing carved, forged or built of dressed stone. */
  primitive?: boolean;
  /** The nation's tech age as a number (ageIndex in @terra/shared); props follow it the way towns do. */
  age?: number;
}

const BANNER_GOVS = new Set<Gov>(['communist', 'junta']);

/** Which props a settlement of this kind gets, from its nation's identity. */
export function propsFor(ctx: PropCtx): PropSpec[] {
  const { kind, id } = ctx;
  const out: PropSpec[] = [];
  const era = id.eraIndex;
  const age = ctx.age ?? -1;
  if (ctx.primitive) {
    if (kind === 'village' || kind === 'camp' || kind === 'town') out.push({ kind: 'stones', ang: 0.4, rad: 0.5, scale: 0.8 });
    return out;
  }
  if (kind === 'capital') {
    if (BANNER_GOVS.has(id.gov)) out.push({ kind: 'banner', ang: -0.5, rad: 0.5, scale: 1.0 }, { kind: 'banner', ang: 0.5, rad: 0.5, scale: 1.0 });
    if (id.gov === 'monarchy' || id.gov === 'democracy' || id.era === 'classical') out.push({ kind: 'statue', ang: 0, rad: 0.42, scale: 0.55 });
    if (BANNER_GOVS.has(id.gov) || (id.gov === 'monarchy' && id.era === 'bronze')) out.push({ kind: 'obelisk', ang: 0.95, rad: 0.5, scale: 0.9 });
    if (id.era === 'modern' || age === 4) out.push({ kind: 'mast', ang: -0.95, rad: 0.5, scale: 1.0 });
    if (id.era === 'future' || age >= 5) out.push({ kind: 'ring', ang: 0, rad: 0, scale: 1.1, lift: 1.1 });
    if (id.era === 'post_apoc' && age < 4) out.push({ kind: 'barrel', ang: 0.6, rad: 0.45, scale: 0.55, smoke: { color: '#4a4541', puffs: 3 } });
  }
  if (kind === 'city') {
    if (age >= 5) { /* a future city has no chimneys */ }
    else if (id.era === 'industrial') out.push({ kind: 'smokestack', ang: 0.2, rad: 0.5, scale: 0.8, smoke: { color: '#4d4d4d', puffs: 2 } });
    else if (id.era === 'modern') out.push({ kind: 'smokestack', ang: 0.2, rad: 0.5, scale: 0.8, smoke: { color: '#c4c4c4', puffs: 1 } });
    if (id.gov === 'merchant' && ctx.coastal) out.push({ kind: 'crane', ang: -0.3, rad: 0.5, scale: 0.8 });
  }
  if (kind === 'fort' && BANNER_GOVS.has(id.gov)) out.push({ kind: 'banner', ang: -0.5, rad: 0.5, scale: 0.9 }, { kind: 'banner', ang: 0.5, rad: 0.5, scale: 0.9 });
  if (kind === 'temple' && id.gov === 'theocracy') out.push({ kind: 'spire', ang: 0.3, rad: 0.5, scale: 0.9 });
  if ((kind === 'village' || kind === 'camp') && (id.gov === 'tribal' || era <= 0) && age < 4) out.push({ kind: 'stones', ang: 0.4, rad: 0.5, scale: 0.8 });
  if (kind === 'port' && id.gov === 'merchant') out.push({ kind: 'crane', ang: 0.3, rad: 0.45, scale: 0.8 });
  if (id.mood === 'martial' && ctx.border && age < 4 && (kind === 'town' || kind === 'city' || kind === 'capital' || kind === 'fort')) {
    out.push({ kind: 'watchtower', ang: -1.3, rad: 0.55, scale: 0.75 });
  }
  return out;
}
