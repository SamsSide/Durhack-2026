// Dotted edge around a cut nation (cyan, crawling) and a deleted one (ruin grey, still). Lane b (B7).
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { useWorld } from '../../state/world';
import { getPalette } from '../palette';
import { useProvinceMesh } from '../mesh/context';
import type { ProvinceMesh } from '../mesh/buildProvinceMesh';
import { statusOf } from './statusTint';

const REBUILD_MS = 400;
const CRAWL = 0.018; // dash offset per second

interface Ring { line: LineSegments2; mat: LineMaterial; geo: LineSegmentsGeometry | null }

function makeRing(group: THREE.Group, color: string, width: number, order: number): Ring {
  const mat = new LineMaterial({
    color: new THREE.Color(color).getHex(), linewidth: width, transparent: true, opacity: 1,
    dashed: true, dashSize: 0.011, gapSize: 0.009, depthWrite: false,
  });
  const line = new LineSegments2(new LineSegmentsGeometry(), mat);
  line.frustumCulled = false;
  line.visible = false;
  line.renderOrder = order;
  group.add(line);
  return { line, mat, geo: null };
}

function setRing(r: Ring, pts: number[]): void {
  r.geo?.dispose();
  r.geo = null;
  if (pts.length === 0) { r.line.visible = false; return; }
  const geo = new LineSegmentsGeometry();
  geo.setPositions(pts);
  r.geo = geo;
  r.line.geometry = geo;
  r.line.computeLineDistances();
  r.line.visible = true;
}

function Inner({ mesh }: { mesh: ProvinceMesh }) {
  const size = useThree((s) => s.size);
  const group = useMemo(() => new THREE.Group(), []);
  const rings = useMemo(() => {
    const pal = getPalette();
    return { cut: makeRing(group, pal.holo, 4.2, 9), deleted: makeRing(group, pal.ink, 2.2, 5) };
  }, [group]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = 0;
    let seenSig = '';
    const run = () => {
      timer = null;
      last = performance.now();
      const { world } = useWorld.getState();
      if (!world) return;
      const cut: number[] = [], del: number[] = [];
      for (const e of mesh.edges) {
        const oa = world.owner[e.tileA] ?? -1, ob = world.owner[e.tileB] ?? -1;
        if (oa === ob) continue;
        const sa = oa >= 0 && world.tiles[e.tileA]?.terrain !== 'ocean' ? statusOf(oa) : undefined;
        const sb = ob >= 0 && world.tiles[e.tileB]?.terrain !== 'ocean' ? statusOf(ob) : undefined;
        if (!sa && !sb) continue;
        const pts = [...e.a, ...e.b];
        if (sa === 'cut' || sb === 'cut') cut.push(...pts); else del.push(...pts);
      }
      setRing(rings.cut, cut);
      setRing(rings.deleted, del);
    };
    const onChange = () => {
      const s = useWorld.getState();
      let sig = String(s.version);
      for (const a of s.agents) if (a.link === 'cut' || a.deleted) sig += `|${a.countryId}${a.deleted ? 'd' : 'c'}`;
      if (sig === seenSig || timer) return;
      seenSig = sig;
      timer = setTimeout(run, Math.max(0, REBUILD_MS - (performance.now() - last)));
    };
    onChange();
    const unsub = useWorld.subscribe(onChange);
    return () => { unsub(); if (timer) clearTimeout(timer); };
  }, [mesh, rings]);

  useEffect(() => () => {
    for (const r of Object.values(rings)) { r.geo?.dispose(); r.mat.dispose(); r.line.geometry.dispose(); }
  }, [rings]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (const r of Object.values(rings)) r.mat.resolution.set(size.width, size.height);
    rings.cut.mat.dashOffset = -t * CRAWL;
    rings.cut.mat.opacity = 0.9 + 0.1 * Math.sin(t * 2.2);
    rings.deleted.mat.opacity = 0.85;
  });

  return <primitive object={group} />;
}

export function StatusRings() {
  const mesh = useProvinceMesh();
  const world = useWorld((s) => s.world);
  if (!mesh || !world) return null;
  return <Inner mesh={mesh} />;
}
