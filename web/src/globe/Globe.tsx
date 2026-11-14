// The 3D globe: one province mesh, live colours, click-to-select, fly-to. Lane b.
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { World } from '@terra/shared';
import { useWorld } from '../state/world';
import { useBelief } from '../state/belief';
import { useCamera } from '../state/camera';
import { CAM_MAX, CAM_MIN } from './constants';
import { buildProvinceMesh } from './mesh/buildProvinceMesh';
import type { ProvinceMesh } from './mesh/buildProvinceMesh';
import { writeColors } from './mesh/colors';
import { ProvinceMeshContext } from './mesh/context';

const SPACE = '#0b0f14';

/** Directional light that stays at the camera's upper left so the lit side faces the viewer. */
function CameraLight() {
  const ref = useRef<THREE.DirectionalLight>(null);
  const offset = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const l = ref.current;
    if (!l) return;
    offset.set(-1.2, 1.0, 0.8).applyQuaternion(camera.quaternion);
    l.position.copy(camera.position).add(offset);
  });
  return <directionalLight ref={ref} intensity={1.1} />;
}

function Planet({ world, mesh }: { world: World; mesh: ProvinceMesh }) {
  const lastPaint = useRef(0);

  useEffect(() => {
    const ownerFn = (): ((t: number) => number) => {
      const s = useWorld.getState();
      const belief = s.beliefOf != null ? useBelief.getState().owner : null;
      return belief ? (t) => belief[t] ?? -1 : (t) => world.owner[t] ?? -1;
    };
    let seenVersion = -1;
    let lastEventId: string | null = null;
    let lastMode = useWorld.getState().mapMode;
    let lastSel = useWorld.getState().selectedCountryId;

    const paintAll = () => {
      const s = useWorld.getState();
      writeColors(mesh, world, ownerFn(), s.mapMode, s.selectedCountryId);
      lastPaint.current = performance.now();
    };

    // Work out which tiles changed since the last paint; null means repaint everything.
    const diff = (events: ReadonlyArray<{ id: string; type: string; tile?: number }>): Set<number> | null => {
      let start = 0;
      if (lastEventId != null) {
        const idx = events.findIndex((e) => e.id === lastEventId);
        if (idx < 0) return events.length === 0 ? new Set() : null;
        start = idx + 1;
      }
      const tiles = new Set<number>();
      for (let i = start; i < events.length; i++) {
        const e = events[i]!;
        if (e.type === 'country_founded' || e.type === 'country_fell') return null;
        if (e.type === 'tile_claimed' && e.tile != null) tiles.add(e.tile);
      }
      return tiles;
    };

    const paint = () => {
      const s = useWorld.getState();
      if (s.world !== world) return;
      const events = s.recentEvents;
      const modeChanged = s.mapMode !== lastMode || s.selectedCountryId !== lastSel;
      lastMode = s.mapMode;
      lastSel = s.selectedCountryId;
      const changed = s.version !== seenVersion ? diff(events) : new Set<number>();
      seenVersion = s.version;
      lastEventId = events.length ? events[events.length - 1]!.id : lastEventId;
      if (modeChanged || changed === null || seenVersion < 0) paintAll();
      else if (changed.size > 0) {
        writeColors(mesh, world, ownerFn(), s.mapMode, s.selectedCountryId, changed);
        lastPaint.current = performance.now();
      }
    };

    // initial paint
    {
      const s = useWorld.getState();
      seenVersion = s.version;
      lastEventId = s.recentEvents.length ? s.recentEvents[s.recentEvents.length - 1]!.id : null;
      paintAll();
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useWorld.subscribe(() => {
      if (timer) return;
      const wait = Math.max(0, 250 - (performance.now() - lastPaint.current)); // ~4 Hz
      timer = setTimeout(() => { timer = null; paint(); }, wait);
    });
    const unsubBelief = useBelief.subscribe(() => paintAll());
    return () => { unsub(); unsubBelief(); if (timer) clearTimeout(timer); };
  }, [mesh, world]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.faceIndex == null) return;
    e.stopPropagation();
    const tile = mesh.triangleToTile[e.faceIndex];
    if (tile == null || tile < 0) return;
    const owner = world.owner[tile] ?? -1;
    useWorld.getState().select(owner >= 0 ? owner : null, tile);
  };

  return (
    <mesh geometry={mesh.geometry} onClick={onClick}>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} />
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
    if (c) camera.position.set(c[0], c[1], c[2]).multiplyScalar(1.6);
  }, [nonce, camera]);
  return null;
}

function Scene({ world }: { world: World }) {
  // Rebuild only when the world id or its tiles array changes; dispose the old geometry.
  const mesh = useMemo(() => buildProvinceMesh(world), [world.id, world.tiles]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => mesh.geometry.dispose(), [mesh]);
  return (
    <ProvinceMeshContext.Provider value={mesh}>
      <Planet world={world} mesh={mesh} />
      {/* lane b overlays: CameraRig, SelectionGlow, Political */}
    </ProvinceMeshContext.Provider>
  );
}

export function Globe() {
  const world = useWorld((s) => s.world);
  const space = typeof document !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--globe-space').trim() || SPACE
    : SPACE;
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0.8, 2.48], fov: 45 }} onPointerMissed={() => useWorld.getState().select(null)}>
      <color attach="background" args={[space]} />
      <hemisphereLight args={['#fff6e0', '#33414a', 0.6]} />
      <CameraLight />
      {world && <Scene world={world} />}
      <FlyTo />
      <OrbitControls makeDefault enablePan={false} minDistance={CAM_MIN} maxDistance={CAM_MAX} />
    </Canvas>
  );
}
