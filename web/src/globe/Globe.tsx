// Placeholder globe (lane b replaces it): one merged BufferGeometry, a triangle fan per province.
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { relationOf } from '@terra/shared';
import type { Stance, Terrain, World } from '@terra/shared';
import { useWorld } from '../state/world';
import type { WorldStore } from '../state/world';
import { useBelief } from '../state/belief';
import { useCamera } from '../state/camera';

const TERRAIN: Record<Terrain, string> = {
  ocean: '#1c3a52', coast: '#2c5b73', plains: '#9aa465', forest: '#4f7a45', desert: '#cfb277',
  hills: '#8a8a5a', mountain: '#7d756b', ice: '#e3eef2',
};
const STANCE: Record<Stance, string> = {
  war: '#c0392b', hostile: '#d98a3a', neutral: '#8a8a8a', trade: '#4f9bb5', alliance: '#4f9f5a',
};
const UNCLAIMED = new THREE.Color('#3a3328');

function tileColor(world: World, t: number, owner: number, mode: WorldStore['mapMode'], sel: number | null, out: THREE.Color): void {
  const tile = world.tiles[t]!;
  if (tile.terrain === 'ocean') { out.set(TERRAIN.ocean); return; }
  if (mode === 'terrain' || owner < 0) {
    out.set(owner < 0 && mode !== 'terrain' ? '#5a5240' : TERRAIN[tile.terrain]);
    if (owner < 0 && mode !== 'terrain') out.lerp(UNCLAIMED, 0.3);
    return;
  }
  const country = world.countries[owner];
  if (!country) { out.copy(UNCLAIMED); return; }
  if (mode === 'diplomacy' && sel != null) {
    if (owner === sel) out.set('#f0e6c8');
    else out.set(STANCE[relationOf(world, sel, owner).stance]);
  } else if (mode === 'strength') {
    const maxPop = Math.max(1, ...world.countries.map((c) => c.population));
    out.set(country.color).multiplyScalar(0.35 + 0.65 * (country.population / maxPop));
  } else {
    out.set(country.color);
  }
  out.multiplyScalar(0.8 + 0.2 * tile.elevation);
}

function buildGeometry(world: World): { geometry: THREE.BufferGeometry; faceTile: Uint32Array } {
  let tris = 0;
  for (const t of world.tiles) tris += t.boundary.length;
  const pos = new Float32Array(tris * 9);
  const faceTile = new Uint32Array(tris);
  let p = 0, f = 0;
  for (const tile of world.tiles) {
    const r = tile.terrain === 'ocean' ? 1 : 1 + 0.03 * tile.elevation;
    const c = tile.center;
    const n = tile.boundary.length;
    for (let i = 0; i < n; i++) {
      const a = tile.boundary[i]!, b = tile.boundary[(i + 1) % n]!;
      for (const v of [c, a, b]) { pos[p++] = v[0] * r; pos[p++] = v[1] * r; pos[p++] = v[2] * r; }
      faceTile[f++] = tile.id;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(tris * 9), 3));
  return { geometry, faceTile };
}

function Planet({ world }: { world: World }) {
  const { geometry, faceTile } = useMemo(() => buildGeometry(world), [world]);
  const lastPaint = useRef(0);

  useEffect(() => {
    const color = new THREE.Color();
    const paint = () => {
      const s = useWorld.getState();
      const w = s.world;
      if (!w || w !== world) return;
      const belief = s.beliefOf != null ? useBelief.getState().owner : null;
      const attr = geometry.getAttribute('color') as THREE.BufferAttribute;
      let f = 0;
      for (const tile of w.tiles) {
        tileColor(w, tile.id, belief ? (belief[tile.id] ?? -1) : (w.owner[tile.id] ?? -1), s.mapMode, s.selectedCountryId, color);
        for (let i = 0; i < tile.boundary.length * 3; i++) attr.setXYZ(f * 3 + i, color.r, color.g, color.b);
        f += tile.boundary.length;
      }
      attr.needsUpdate = true;
      lastPaint.current = performance.now();
    };
    paint();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useWorld.subscribe(() => {
      if (timer) return;
      const wait = Math.max(0, 250 - (performance.now() - lastPaint.current));
      timer = setTimeout(() => { timer = null; paint(); }, wait);   // ~4 Hz
    });
    const unsubBelief = useBelief.subscribe(() => paint());
    return () => { unsub(); unsubBelief(); if (timer) clearTimeout(timer); };
  }, [geometry, world]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.faceIndex == null) return;
    e.stopPropagation();
    const tile = faceTile[e.faceIndex]!;
    const owner = world.owner[tile] ?? -1;
    useWorld.getState().select(owner >= 0 ? owner : null, tile);
  };

  return (
    <mesh geometry={geometry} onClick={onClick}>
      <meshBasicMaterial vertexColors side={THREE.FrontSide} />
    </mesh>
  );
}

function FlyTo() {
  const camera = useThree((s) => s.camera);
  const nonce = useCamera((s) => s.nonce);
  useEffect(() => {
    const { target } = useCamera.getState();
    const w = useWorld.getState().world;
    const country = target != null ? w?.countries[target] : undefined;
    if (!w || !country) return;
    const c = w.tiles[country.capitalTile]?.center;
    if (c) camera.position.set(c[0], c[1], c[2]).multiplyScalar(2.2);
  }, [nonce, camera]);
  return null;
}

export function Globe() {
  const world = useWorld((s) => s.world);
  return (
    <Canvas camera={{ position: [0, 0.8, 2.8], fov: 45 }} onPointerMissed={() => useWorld.getState().select(null)}>
      <color attach="background" args={['#0b0a08']} />
      {world && <Planet world={world} />}
      <FlyTo />
      <OrbitControls makeDefault enablePan={false} minDistance={1.3} maxDistance={5} />
    </Canvas>
  );
}
