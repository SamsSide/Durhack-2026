// Political-map borders: nation borders, coasts, region borders and province lines. Lane b (B3).
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { World } from '@terra/shared';
import { useWorld } from '../../state/world';
import { CLOSE } from '../constants';
import { useProvinceMesh } from '../mesh/context';
import type { ProvinceMesh } from '../mesh/buildProvinceMesh';

const INK = '#2a2118';
const REGION_OPACITY = 0.35;
const PROVINCE_OPACITY = 0.1;
const PROVINCE_NEAR = 1.4;
const REBUILD_MS = 500;

interface Layer {
  line: LineSegments2;
  mat: LineMaterial;
  geo: LineSegmentsGeometry | null;
}

function makeLayer(group: THREE.Group, width: number, opacity: number, vertexColors: boolean, dashed = false): Layer {
  const mat = new LineMaterial({
    color: vertexColors ? 0xffffff : new THREE.Color(INK).getHex(),
    linewidth: width,
    vertexColors,
    transparent: true,
    opacity,
    dashed,
    dashSize: 0.012,
    gapSize: 0.008,
    depthWrite: false,
  });
  const line = new LineSegments2(new LineSegmentsGeometry(), mat);
  line.frustumCulled = false;
  line.visible = false;
  line.renderOrder = 2;
  group.add(line);
  return { line, mat, geo: null };
}

function setLayer(layer: Layer, positions: number[], colors?: number[]): void {
  layer.geo?.dispose();
  layer.geo = null;
  if (positions.length === 0) {
    layer.line.visible = false;
    layer.line.geometry = new LineSegmentsGeometry();
    return;
  }
  const geo = new LineSegmentsGeometry();
  geo.setPositions(positions);
  if (colors) geo.setColors(colors);
  layer.geo = geo;
  layer.line.geometry = geo;
  if (layer.mat.dashed) layer.line.computeLineDistances();
  layer.line.visible = true;
}

const tmp = new THREE.Color();
function darkened(hex: string): [number, number, number] {
  tmp.set(hex).multiplyScalar(0.55);
  return [tmp.r, tmp.g, tmp.b];
}

interface Layers { nation: Layer; coastOwned: Layer; coastFree: Layer; region: Layer; province: Layer }

function rebuild(layers: Layers, world: World, mesh: ProvinceMesh): void {
  const nationP: number[] = [], nationC: number[] = [];
  const coastOwnedP: number[] = [], coastFreeP: number[] = [];
  const regionP: number[] = [], provinceP: number[] = [];
  const cols = world.countries.map((c) => (c ? darkened(c.color) : ([0.16, 0.13, 0.09] as [number, number, number])));

  for (const e of mesh.edges) {
    const ta = world.tiles[e.tileA], tb = world.tiles[e.tileB];
    if (!ta || !tb) continue;
    const oa = world.owner[e.tileA] ?? -1, ob = world.owner[e.tileB] ?? -1;
    const seaA = ta.terrain === 'ocean', seaB = tb.terrain === 'ocean';
    const pts = [...e.a, ...e.b];
    if (seaA && seaB) continue;
    if (seaA || seaB) {
      const landOwner = seaA ? ob : oa;
      (landOwner >= 0 ? coastOwnedP : coastFreeP).push(...pts);
      continue;
    }
    if (oa !== ob) {
      const mid = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2, (e.a[2] + e.b[2]) / 2];
      const ca = oa >= 0 ? cols[oa] : undefined, cb = ob >= 0 ? cols[ob] : undefined;
      if (oa >= 0 || ob >= 0) {
        const fa = ca ?? cb!, fb = cb ?? ca!;
        nationP.push(...e.a, ...mid, ...mid, ...e.b);
        nationC.push(...fa, ...fa, ...fb, ...fb);
      }
      continue;
    }
    if (oa >= 0 && ta.region !== tb.region) regionP.push(...pts);
    else provinceP.push(...pts);
  }

  setLayer(layers.nation, nationP, nationC);
  setLayer(layers.coastOwned, coastOwnedP);
  setLayer(layers.coastFree, coastFreeP);
  setLayer(layers.region, regionP);
  setLayer(layers.province, provinceP);
}

function BordersInner({ mesh }: { mesh: ProvinceMesh }) {
  const size = useThree((s) => s.size);
  const group = useMemo(() => new THREE.Group(), []);
  const layers = useMemo<Layers>(() => ({
    nation: makeLayer(group, 3, 1, true),
    coastOwned: makeLayer(group, 3, 1, false),
    coastFree: makeLayer(group, 1.5, 0.5, false),
    region: makeLayer(group, 1, REGION_OPACITY, false, true),
    province: makeLayer(group, 1, PROVINCE_OPACITY, false),
  }), [group]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = 0;
    let lastVersion = -1;
    let lastWorld: World | null = null;
    const run = () => {
      timer = null;
      const s = useWorld.getState();
      if (!s.world) return;
      last = performance.now();
      lastVersion = s.version;
      lastWorld = s.world;
      rebuild(layers, s.world, mesh);
    };
    const onChange = () => {
      const s = useWorld.getState();
      if (!s.world || (s.version === lastVersion && s.world === lastWorld) || timer) return;
      const wait = Math.max(0, REBUILD_MS - (performance.now() - last));
      timer = setTimeout(run, wait);
    };
    run();
    const unsub = useWorld.subscribe(onChange);
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [layers, mesh]);

  useEffect(() => () => {
    for (const l of Object.values(layers)) {
      l.geo?.dispose();
      l.mat.dispose();
      l.line.geometry.dispose();
    }
  }, [layers]);

  useFrame(({ camera }) => {
    const d = camera.position.length();
    for (const l of Object.values(layers)) l.mat.resolution.set(size.width, size.height);
    const r = Math.min(1, Math.max(0, (CLOSE - d) / 0.2));
    layers.region.mat.opacity = REGION_OPACITY * r;
    layers.region.line.visible = r > 0 && layers.region.geo != null;
    const p = Math.min(1, Math.max(0, (PROVINCE_NEAR - d) / 0.1));
    layers.province.mat.opacity = PROVINCE_OPACITY * p;
    layers.province.line.visible = p > 0 && layers.province.geo != null;
  });

  return <primitive object={group} />;
}

export function Borders() {
  const mesh = useProvinceMesh();
  const world = useWorld((s) => s.world);
  if (!mesh || !world) return null;
  return <BordersInner mesh={mesh} />;
}
