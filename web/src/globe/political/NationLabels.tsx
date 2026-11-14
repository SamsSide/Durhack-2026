// Nation and region names with flags painted flat on the planet, Age of History style. Lane b.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { flagSvg, regionOwner } from '@terra/shared';
import type { FlagSpec } from '@terra/shared';
import { useWorld } from '../../state/world';
import { CLOSE } from '../constants';
import { getPalette } from '../palette';
import { useProvinceMesh } from '../mesh/context';

const EXTRA_LIFT = 0.002;
const RENDER_ORDER = 20;
const FADE_FAR = 1.5; // nation names fully visible above this camera distance
const FADE_NEAR = 1.3; // and gone below this
const NORTH = new THREE.Vector3(0, 1, 0);

interface LabelData {
  key: string;
  name: string;
  kind: 'nation' | 'region';
  pos: [number, number, number];
  size: number;
  flag: FlagSpec;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Quaternion with +Z along the surface normal and +Y towards north on the tangent plane. */
function surfaceQuat(pos: THREE.Vector3): THREE.Quaternion {
  const n = pos.clone().normalize();
  let up = NORTH.clone().addScaledVector(n, -NORTH.dot(n));
  if (up.lengthSq() < 1e-4) up = new THREE.Vector3(1, 0, 0).addScaledVector(n, -n.x);
  up.normalize();
  const right = new THREE.Vector3().crossVectors(up, n).normalize();
  const m = new THREE.Matrix4().makeBasis(right, up, n);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

function FlagLabel({ data }: { data: LabelData }) {
  const INK = getPalette().ink;
  const HALO = getPalette().parchment;
  const groupRef = useRef<THREE.Group>(null);
  const textRef = useRef<any>(null); // troika Text instance
  const flagMat = useRef<THREE.MeshBasicMaterial>(null);
  const [textWidth, setTextWidth] = useState(data.name.length * data.size * 0.75);

  const posVec = useMemo(() => new THREE.Vector3(...data.pos), [data.pos]);
  const dir = useMemo(() => posVec.clone().normalize(), [posVec]);
  const quat = useMemo(() => surfaceQuat(posVec), [posVec]);

  const flagKey = data.key + JSON.stringify(data.flag);
  const texture = useMemo(() => {
    const svg = flagSvg(data.flag, 90, 60);
    const t = new THREE.TextureLoader().load('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [flagKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => texture.dispose(), [texture]);

  const flagH = data.size * 0.75;
  const flagW = flagH * 1.5;
  const gap = data.size * 0.25;
  const total = flagW + gap + textWidth;
  const flagX = -total / 2 + flagW / 2;
  const textX = -total / 2 + flagW + gap;

  useFrame(({ camera }) => {
    const g = groupRef.current;
    if (!g) return;
    const d = camera.position.length();
    let alpha = data.kind === 'nation'
      ? clamp01((d - FADE_NEAR) / (FADE_FAR - FADE_NEAR))
      : clamp01((CLOSE - d) / 0.2);
    const facing = camera.position.dot(dir) / d;
    if (facing < 0.1) alpha = 0;
    g.visible = alpha > 0.01;
    if (!g.visible) return;
    const t = textRef.current;
    if (t) {
      t.fillOpacity = alpha;
      t.outlineOpacity = alpha;
    }
    if (flagMat.current) flagMat.current.opacity = alpha;
  });

  return (
    <group ref={groupRef} position={data.pos} quaternion={quat} renderOrder={RENDER_ORDER}>
      <mesh position={[flagX, 0, 0]} renderOrder={RENDER_ORDER}>
        <planeGeometry args={[flagW, flagH]} />
        <meshBasicMaterial ref={flagMat} map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <Text
        ref={textRef}
        position={[textX, 0, 0]}
        anchorX="left"
        anchorY="middle"
        fontSize={data.size}
        letterSpacing={0.15}
        color={INK}
        outlineWidth={0.002}
        outlineColor={HALO}
        renderOrder={RENDER_ORDER}
        onSync={(t: any) => {
          const b = t.textRenderInfo?.blockBounds;
          if (b) {
            const w = b[2] - b[0];
            if (Math.abs(w - textWidth) > 1e-4) setTextWidth(w);
          }
        }}
      >
        {data.name}
        <meshBasicMaterial transparent depthWrite={false} toneMapped={false} />
      </Text>
    </group>
  );
}

function lift(c: [number, number, number]): [number, number, number] {
  const len = Math.hypot(c[0], c[1], c[2]) || 1;
  const k = (len + EXTRA_LIFT) / len;
  return [c[0] * k, c[1] * k, c[2] * k];
}

export function NationLabels() {
  const mesh = useProvinceMesh();
  const [labels, setLabels] = useState<LabelData[]>([]);

  useEffect(() => {
    if (!mesh) { setLabels([]); return; }
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = 0;
    let seen = -1;

    const compute = () => {
      timer = null;
      last = performance.now();
      const { world, version } = useWorld.getState();
      seen = version;
      if (!world) { setLabels([]); return; }
      const byOwner = new Map<number, number[]>();
      for (let t = 0; t < world.owner.length; t++) {
        const o = world.owner[t]!;
        if (o < 0) continue;
        let arr = byOwner.get(o);
        if (!arr) byOwner.set(o, (arr = []));
        arr.push(t);
      }
      const out: LabelData[] = [];
      for (const [id, tiles] of byOwner) {
        const c = world.countries[id];
        if (!c || c.alive === false || tiles.length === 0 || !c.name) continue;
        const size = Math.min(0.12, Math.max(0.03, 0.018 * Math.sqrt(tiles.length)));
        out.push({ key: `n${id}`, name: c.name, kind: 'nation', pos: lift(mesh.centroidOf(tiles)), size, flag: c.flag });
      }
      for (const r of world.regions) {
        if (!r.name || r.tiles.length === 0) continue;
        const owner = regionOwner(world, r.id);
        const oc = owner >= 0 ? world.countries[owner] : undefined;
        if (!oc || oc.alive === false) continue;
        const size = 0.5 * Math.min(0.12, Math.max(0.03, 0.018 * Math.sqrt(byOwner.get(owner)?.length ?? 1)));
        out.push({ key: `r${r.id}`, name: r.name, kind: 'region', pos: lift(mesh.centroidOf(r.tiles)), size: Math.max(size, 0.02), flag: r.flag });
      }
      setLabels(out);
    };

    const schedule = () => {
      if (timer || useWorld.getState().version === seen) return;
      timer = setTimeout(compute, Math.max(0, 1000 - (performance.now() - last)));
    };
    compute();
    const unsub = useWorld.subscribe(schedule);
    return () => { unsub(); if (timer) clearTimeout(timer); };
  }, [mesh]);

  return (
    <>
      {labels.map((l) => (
        <FlagLabel key={l.key} data={l} />
      ))}
    </>
  );
}
