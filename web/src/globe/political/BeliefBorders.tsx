// The belief view: what the shown nation has got WRONG. While beliefs are on, the fill and the
// nation borders follow its beliefs (Globe.tsx, Borders.tsx); this layer marks every province whose
// believed owner differs from the truth with a pulsing holo wash and a dashed holo outline, so a
// stale view reads at a glance instead of looking like the normal map. Lane b (B7, B8).
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { useWorld } from '../../state/world';
import { useBelief } from '../../state/belief';
import { getPalette } from '../palette';
import { useProvinceMesh } from '../mesh/context';
import type { ProvinceMesh } from '../mesh/buildProvinceMesh';

const OUT = 1.0025;      // outline lift above the solid borders
const WASH_LIFT = 1.0012; // the wash sits just above the province tops
const REBUILD_MS = 400;

/** Tiles whose believed owner is not the true owner (ocean ignored). */
function staleTiles(believed: ArrayLike<number>, truth: ArrayLike<number>, isOcean: (t: number) => boolean): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < truth.length; i++) {
    if (isOcean(i)) continue;
    if ((believed[i] ?? -1) !== (truth[i] ?? -1)) out.add(i);
  }
  return out;
}

function Inner({ mesh }: { mesh: ProvinceMesh }) {
  const size = useThree((s) => s.size);
  const group = useMemo(() => new THREE.Group(), []);

  const lineMat = useMemo(() => new LineMaterial({
    color: new THREE.Color(getPalette().holo).getHex(),
    linewidth: 3, dashed: true, dashSize: 0.016, gapSize: 0.01,
    transparent: true, opacity: 1, depthWrite: false,
  }), []);
  const washMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color(getPalette().holo), transparent: true, opacity: 0.35,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false,
  }), []);

  useEffect(() => {
    const line = new LineSegments2(new LineSegmentsGeometry(), lineMat);
    line.frustumCulled = false;
    line.renderOrder = 4;
    line.visible = false;
    const wash = new THREE.Mesh(new THREE.BufferGeometry(), washMat);
    wash.frustumCulled = false;
    wash.renderOrder = 3;
    wash.visible = false;
    group.add(wash, line);

    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = 0;

    const build = () => {
      timer = null;
      last = performance.now();
      const s = useWorld.getState();
      const believed = useBelief.getState().owner;
      const world = s.world;
      if (s.beliefOf == null || !believed || !world) { line.visible = false; wash.visible = false; return; }
      const stale = staleTiles(believed, world.owner, (t) => world.tiles[t]?.terrain === 'ocean');

      // outline: every edge with a stale province on exactly one side, or a stale coast
      const pts: number[] = [];
      for (const e of mesh.edges) {
        const sa = stale.has(e.tileA), sb = stale.has(e.tileB);
        if (sa === sb) continue;
        pts.push(e.a[0] * OUT, e.a[1] * OUT, e.a[2] * OUT, e.b[0] * OUT, e.b[1] * OUT, e.b[2] * OUT);
      }
      line.geometry.dispose();
      if (pts.length) {
        const g = new LineSegmentsGeometry();
        g.setPositions(pts);
        line.geometry = g;
        line.computeLineDistances();
        line.visible = true;
      } else { line.geometry = new LineSegmentsGeometry(); line.visible = false; }

      // wash: the top fan of every stale province, lifted a hair
      const verts: number[] = [];
      for (const t of stale) {
        const start = mesh.tileVertexStart[t] ?? 0, n = mesh.tileTopVertexCount[t] ?? 0;
        for (let v = start; v < start + n; v++) verts.push(pos.getX(v) * WASH_LIFT, pos.getY(v) * WASH_LIFT, pos.getZ(v) * WASH_LIFT);
      }
      wash.geometry.dispose();
      const wg = new THREE.BufferGeometry();
      if (verts.length) wg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      wash.geometry = wg;
      wash.visible = verts.length > 0;
    };
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(build, Math.max(0, REBUILD_MS - (performance.now() - last)));
    };
    build();
    const unsubW = useWorld.subscribe(schedule);
    const unsubB = useBelief.subscribe(() => { if (timer) clearTimeout(timer); build(); });
    return () => {
      unsubW(); unsubB();
      if (timer) clearTimeout(timer);
      group.remove(wash, line);
      line.geometry.dispose();
      wash.geometry.dispose();
    };
  }, [mesh, group, lineMat, washMat]);

  useEffect(() => () => { lineMat.dispose(); washMat.dispose(); }, [lineMat, washMat]);

  useFrame(() => {
    lineMat.resolution.set(size.width, size.height);
    // a slow breath so the stale provinces catch the eye without strobing
    const k = 0.5 + 0.5 * Math.sin(performance.now() * 0.004);
    washMat.opacity = 0.3 + 0.25 * k;
    lineMat.opacity = 0.75 + 0.25 * k;
  });

  return <primitive object={group} />;
}

export function BeliefBorders() {
  const mesh = useProvinceMesh();
  const beliefOf = useWorld((s) => s.beliefOf);
  if (!mesh || beliefOf == null) return null;
  return <Inner mesh={mesh} />;
}
