// B12: trade routes. A thin great-circle line between the capitals of every pair of nations with a
// trade pact (pale gold, dashed) or an alliance (gold, solid). Rebuilt only when the set of pacts or
// a capital changes; hidden in terrain mode. Mount inside the ProvinceMeshContext provider. Lane b.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { World } from '@terra/shared';
import { useWorld } from '../../state/world';
import { tileHeight } from '../mesh/buildProvinceMesh';

const SEGS = 40;
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

/** Line-segment positions (pairs of points) for every route of one stance, with the distance along
 * each route so dashes run evenly from capital to capital. */
function buildPositions(world: World, stance: 'trade' | 'alliance'): { pos: Float32Array; dist: Float32Array } {
  const out: number[] = [];
  const dist: number[] = [];
  for (const r of world.relations) {
    if (r.stance !== stance) continue;
    if (!world.countries[r.a]?.alive || !world.countries[r.b]?.alive) continue;
    const a = capitalPoint(world, r.a), b = capitalPoint(world, r.b);
    if (!a || !b || a.distanceToSquared(b) < 1e-8) continue;
    const pts = arcPoints(a, b);
    let d = 0;
    for (let i = 0; i < SEGS; i++) {
      const p = pts[i]!, q = pts[i + 1]!;
      out.push(p.x, p.y, p.z, q.x, q.y, q.z);
      const step = p.distanceTo(q);
      dist.push(d, d + step);
      d += step;
    }
  }
  return { pos: new Float32Array(out), dist: new Float32Array(dist) };
}

export function Routes() {
  const world = useWorld((s) => s.world);
  const lines = useMemo(() => {
    const group = new THREE.Group();
    group.renderOrder = 18;
    const make = (dashed: boolean, color: THREE.Color) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
      const mat = dashed
        ? new THREE.LineDashedMaterial({ color, transparent: true, opacity: OPACITY, depthWrite: false, dashSize: 0.012, gapSize: 0.008, toneMapped: false })
        : new THREE.LineBasicMaterial({ color, transparent: true, opacity: OPACITY, depthWrite: false, toneMapped: false });
      const seg = new THREE.LineSegments(geo, mat);
      seg.frustumCulled = false;
      group.add(seg);
      return seg;
    };
    return { group, trade: make(true, TRADE), alliance: make(false, ALLIANCE) };
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
        const { pos, dist } = buildPositions(w, stance);
        seg.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        seg.geometry.setAttribute('lineDistance', new THREE.BufferAttribute(dist, 1));
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
