// B12: trade routes. A thin great-circle ribbon between the capitals of every pair of nations with a
// trade pact (pale gold, dashed) or an alliance (gold, solid). Rebuilt only when the set of pacts or
// a capital changes; hidden in terrain mode. Mount inside the ProvinceMeshContext provider. Lane b.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { World } from '@terra/shared';
import { useWorld } from '../../state/world';
import { tileHeight } from '../mesh/buildProvinceMesh';

const SEGS = 80;
const HALF_WIDTH = 0.0016;
const OPACITY = 0.35;
const TRADE = new THREE.Color('#f3dc96'), ALLIANCE = new THREE.Color('#ffc940');

// Copied from Trade.tsx (the payment arcs) so the routes sit on the same curves.
function capitalPoint(world: World, id: number): THREE.Vector3 | null {
  const c = world.countries[id];
  const t = c ? world.tiles[c.capitalTile] : undefined;
  if (!t) return null;
  const v = new THREE.Vector3(t.center[0], t.center[1], t.center[2]).normalize();
  return v.multiplyScalar(tileHeight(t));
}

function arcPoints(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] {
  const ra = a.length(), rb = b.length();
  const na = a.clone().normalize(), nb = b.clone().normalize();
  const ang = Math.acos(Math.min(1, Math.max(-1, na.dot(nb))));
  const lift = 0.012 + ang * 0.1;
  const out: THREE.Vector3[] = [];
  const s = Math.sin(ang) || 1;
  for (let i = 0; i <= SEGS; i++) {
    const t = i / SEGS;
    const dir = ang < 1e-4 ? na.clone() : na.clone().multiplyScalar(Math.sin((1 - t) * ang) / s).add(nb.clone().multiplyScalar(Math.sin(t * ang) / s));
    const r = ra + (rb - ra) * t + Math.sin(Math.PI * t) * lift + 0.004;
    out.push(dir.normalize().multiplyScalar(r));
  }
  return out;
}

/** A key that changes only when a pact appears, ends or changes kind, or a pact member's capital moves. */
function routeKey(world: World): string {
  const parts: string[] = [];
  for (const r of world.relations) {
    if (r.stance !== 'trade' && r.stance !== 'alliance') continue;
    const a = world.countries[r.a], b = world.countries[r.b];
    if (!a?.alive || !b?.alive) continue;
    parts.push(`${r.a}-${r.b}${r.stance[0]}${a.capitalTile},${b.capitalTile}`);
  }
  return parts.join('|');
}

/** A flat ribbon along each route of one stance, lying on the sphere (facing outward). Trade pacts are
 * dashed: only every other pair of segments is drawn. Non-indexed triangles. */
function buildRibbons(world: World, stance: 'trade' | 'alliance'): Float32Array {
  const out: number[] = [];
  const tan = new THREE.Vector3(), up = new THREE.Vector3(), side = new THREE.Vector3();
  const sides: THREE.Vector3[] = [];
  for (const r of world.relations) {
    if (r.stance !== stance) continue;
    if (!world.countries[r.a]?.alive || !world.countries[r.b]?.alive) continue;
    const a = capitalPoint(world, r.a), b = capitalPoint(world, r.b);
    if (!a || !b || a.distanceToSquared(b) < 1e-8) continue;
    const pts = arcPoints(a, b);
    sides.length = 0;
    for (let i = 0; i <= SEGS; i++) {
      tan.copy(pts[Math.min(SEGS, i + 1)]!).sub(pts[Math.max(0, i - 1)]!).normalize();
      up.copy(pts[i]!).normalize();
      side.crossVectors(tan, up).normalize().multiplyScalar(HALF_WIDTH);
      sides.push(side.clone());
    }
    for (let i = 0; i < SEGS; i++) {
      if (stance === 'trade' && (i >> 1) % 2 === 1) continue;
      const p = pts[i]!, q = pts[i + 1]!, sp = sides[i]!, sq = sides[i + 1]!;
      const p0 = [p.x - sp.x, p.y - sp.y, p.z - sp.z], p1 = [p.x + sp.x, p.y + sp.y, p.z + sp.z];
      const q0 = [q.x - sq.x, q.y - sq.y, q.z - sq.z], q1 = [q.x + sq.x, q.y + sq.y, q.z + sq.z];
      out.push(...p0, ...p1, ...q1, ...p0, ...q1, ...q0);
    }
  }
  return new Float32Array(out);
}

export function Routes() {
  const world = useWorld((s) => s.world);
  const lines = useMemo(() => {
    const group = new THREE.Group();
    group.renderOrder = 18;
    const make = (color: THREE.Color) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: OPACITY, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      group.add(mesh);
      return mesh;
    };
    return { group, trade: make(TRADE), alliance: make(ALLIANCE) };
  }, []);

  useEffect(() => () => {
    for (const l of [lines.trade, lines.alliance]) { l.geometry.dispose(); (l.material as THREE.Material).dispose(); }
  }, [lines]);

  useEffect(() => {
    if (!world) return;
    let key = '';
    const rebuild = () => {
      const s = useWorld.getState();
      lines.group.visible = s.mapMode !== 'terrain';
      const w = s.world;
      if (!w || w !== world) return;
      const next = routeKey(w);
      if (next === key) return;
      key = next;
      for (const [seg, stance] of [[lines.trade, 'trade'], [lines.alliance, 'alliance']] as const) {
        seg.geometry.setAttribute('position', new THREE.BufferAttribute(buildRibbons(w, stance), 3));
        seg.geometry.computeBoundingSphere();
      }
    };
    rebuild();
    let lastVersion = useWorld.getState().version;
    let lastMode = useWorld.getState().mapMode;
    return useWorld.subscribe((s) => {
      if (s.version === lastVersion && s.mapMode === lastMode) return;
      lastVersion = s.version; lastMode = s.mapMode;
      rebuild();
    });
  }, [lines, world]);

  return <primitive object={lines.group} />;
}
