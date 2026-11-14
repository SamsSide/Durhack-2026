// Dashed cyan borders of what the shown nation BELIEVES the map looks like (stale beliefs). Lane b.
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

const OUT = 1.0025; // lift above the solid borders

function Inner({ mesh }: { mesh: ProvinceMesh }) {
  const size = useThree((s) => s.size);
  const beliefOf = useWorld((s) => s.beliefOf);
  const owner = useBelief((s) => s.owner);
  const world = useWorld((s) => s.world);

  const mat = useMemo(() => new LineMaterial({
    color: new THREE.Color(getPalette().holo).getHex(),
    linewidth: 2.5, dashed: true, dashSize: 0.02, gapSize: 0.012,
    transparent: true, opacity: 0.95, depthWrite: false,
  }), []);

  const line = useMemo(() => {
    if (beliefOf == null || !owner || !world) return null;
    const pts: number[] = [];
    for (const e of mesh.edges) {
      const ta = world.tiles[e.tileA], tb = world.tiles[e.tileB];
      if (!ta || !tb || (ta.terrain === 'ocean' && tb.terrain === 'ocean')) continue;
      const oa = owner[e.tileA] ?? -1, ob = owner[e.tileB] ?? -1;
      if (oa === ob || (oa < 0 && ob < 0)) continue;
      pts.push(e.a[0] * OUT, e.a[1] * OUT, e.a[2] * OUT, e.b[0] * OUT, e.b[1] * OUT, e.b[2] * OUT);
    }
    if (pts.length === 0) return null;
    const geo = new LineSegmentsGeometry();
    geo.setPositions(pts);
    const l = new LineSegments2(geo, mat);
    l.computeLineDistances();
    l.frustumCulled = false;
    l.renderOrder = 4;
    return l;
  }, [beliefOf, owner, world, mesh, mat]);

  useEffect(() => () => { line?.geometry.dispose(); }, [line]);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(() => mat.resolution.set(size.width, size.height));

  return line ? <primitive object={line} /> : null;
}

export function BeliefBorders() {
  const mesh = useProvinceMesh();
  const beliefOf = useWorld((s) => s.beliefOf);
  if (!mesh || beliefOf == null) return null;
  return <Inner mesh={mesh} />;
}
