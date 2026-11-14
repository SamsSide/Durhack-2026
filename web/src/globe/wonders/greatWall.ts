// The Great Wall: a wall ribbon with small towers along a nation's land borders, ordered outward from the
// wonder's tile so it can be drawn growing (setDrawRange). World-space geometry, vertex coloured. Lane b.
import * as THREE from 'three';
import type { World } from '@terra/shared';
import type { ProvinceMesh } from '../mesh/buildProvinceMesh';

export interface WallGeometry { geometry: THREE.BufferGeometry; ends: number[] } // ends[i]: vertex count after segment i

const STONE = new THREE.Color('#b8aa8e');
const DARK = new THREE.Color('#8d8068');
const TOWER_EVERY = 4;

export function buildWall(world: World, mesh: ProvinceMesh, owner: number, fromTile: number, width: number, team: string): WallGeometry {
  const H = width * 0.05, T = width * 0.026, TW = width * 0.06, TH = width * 0.09; // about a town wall's height
  const from = new THREE.Vector3(...world.tiles[fromTile]!.center).normalize();
  const own = (t: number) => (world.owner[t] ?? -1) === owner;
  const land = (t: number) => world.tiles[t]?.terrain !== 'ocean';
  const list: { a: THREE.Vector3; b: THREE.Vector3; d: number }[] = [];
  for (const e of mesh.edges) {
    if (own(e.tileA) === own(e.tileB)) continue;
    if (!land(e.tileA) || !land(e.tileB)) continue; // land borders only, not coasts
    const a = new THREE.Vector3(...e.a), b = new THREE.Vector3(...e.b);
    const d = a.clone().add(b).normalize().angleTo(from);
    list.push({ a, b, d });
  }
  list.sort((x, y) => x.d - y.d);

  const pos: number[] = [], col: number[] = [];
  const teamC = new THREE.Color(team);
  const tri = (p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3, c: THREE.Color) => {
    pos.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
    for (let i = 0; i < 3; i++) col.push(c.r, c.g, c.b);
  };
  const quad = (p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3, s: THREE.Vector3, c: THREE.Color) => { tri(p, q, r, c); tri(p, r, s, c); };
  /** A box from four base corners (in order round) lifted by `up * h`; sides and top. */
  const prism = (base: THREE.Vector3[], up: THREE.Vector3, h: number, side: THREE.Color, top: THREE.Color) => {
    const tops = base.map((p) => p.clone().addScaledVector(up, h));
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(base[i]!, base[j]!, tops[j]!, tops[i]!, side); }
    quad(tops[0]!, tops[1]!, tops[2]!, tops[3]!, top);
    return tops;
  };
  const ends: number[] = [];
  const up = new THREE.Vector3(), dir = new THREE.Vector3(), lat = new THREE.Vector3();
  list.forEach((s, i) => {
    up.copy(s.a).add(s.b).normalize();
    dir.copy(s.b).sub(s.a);
    lat.crossVectors(dir, up).normalize().multiplyScalar(T / 2);
    const sink = up.clone().multiplyScalar(-H * 0.25); // sink a little so the wall sits in the ground
    const a = s.a.clone().add(sink), b = s.b.clone().add(sink);
    prism([a.clone().sub(lat), b.clone().sub(lat), b.clone().add(lat), a.clone().add(lat)], up, H * 1.25, STONE, DARK);
    if (i % TOWER_EVERY === 0) {
      const m = a.clone().add(b).multiplyScalar(0.5);
      const f = dir.clone().normalize().multiplyScalar(TW / 2), l = lat.clone().normalize().multiplyScalar(TW / 2);
      const base = [m.clone().sub(f).sub(l), m.clone().add(f).sub(l), m.clone().add(f).add(l), m.clone().sub(f).add(l)];
      const tops = prism(base, up, TH, STONE, DARK);
      const apex = m.clone().addScaledVector(up, TH + TW * 0.7);
      for (let k = 0; k < 4; k++) tri(tops[k]!, tops[(k + 1) % 4]!, apex, teamC);
    }
    ends.push(pos.length / 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return { geometry, ends };
}
