// The 3D globe: one province mesh, live colours, click-to-select, fly-to. Lane b.
import { Readiness } from './economy/Readiness';
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { World } from '@terra/shared';
import { useWorld } from '../state/world';
import { useBelief } from '../state/belief';
import { buildProvinceMesh } from './mesh/buildProvinceMesh';
import type { ProvinceMesh } from './mesh/buildProvinceMesh';
import { devastationKey, politicsKey, wealthKey, writeColors } from './mesh/colors';
import { ProvinceMeshContext } from './mesh/context';
import { ColorFx } from './colorFx';
import { CameraRig } from './camera/CameraRig';
import { Picking } from './camera/usePicking';
import { HoverHighlight } from './camera/HoverHighlight';
import { SelectionGlow } from './camera/SelectionGlow';
import { Political } from './political/Political';
import { Atmosphere } from './atmosphere/Atmosphere';
import { Space } from './space/Space';
import { Celestial } from './celestial';
import { Orbit } from './orbit';
import { Trade } from './trade/Trade';
import { Routes } from './trade/Routes';
import { CoinBurst } from './trade/CoinBurst';
import { ChainSeal } from './trade/ChainSeal';
import { Structures } from './structures/Structures';
import { Units } from './units';
import { Clouds } from './clouds';
import { Towns } from './towns';
import { Living } from './living';
import { EventBeacons, Spotlight, WarFlash } from './events';
import { Council } from './council';
import { Wonders } from './wonders';
import { registerCapture } from './capture';
import { setStatuses } from './status/statusTint';

const SPACE = '#0b0f14';

/** Hands the renderer, scene and camera to captureGlobe(). */
function CaptureBridge() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    registerCapture({ gl, scene, camera });
    // Dev only: lets a browser review read draw calls and time a frame (window.__rig.gl.info).
    if (import.meta.env.DEV) (window as unknown as { __rig?: unknown }).__rig = { gl, scene, camera };
    return () => registerCapture(null);
  }, [gl, scene, camera]);
  return null;
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
    let lastWealth = '';
    let lastScorch = '';

    const fx = new ColorFx(mesh, world.tiles.length);

    const paintAll = (animate = false) => {
      const s = useWorld.getState();
      fx.repaint(() => writeColors(mesh, world, ownerFn(), s.mapMode, s.selectedCountryId), null, animate);
      lastPaint.current = performance.now();
    };

    // Work out which tiles changed since the last paint; null means repaint everything.
    const diff = (events: ReadonlyArray<{ id: string; type: string; tile?: number; cause?: string }>): Map<number, string> | null => {
      let start = 0;
      if (lastEventId != null) {
        const idx = events.findIndex((e) => e.id === lastEventId);
        if (idx < 0) return events.length === 0 ? new Map() : null;
        start = idx + 1;
      }
      const tiles = new Map<number, string>();
      for (let i = start; i < events.length; i++) {
        const e = events[i]!;
        if (e.type === 'country_founded') return null;
        if (e.type === 'tile_claimed' && e.tile != null) tiles.set(e.tile, e.cause ?? 'expand');
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
      const statusChanged = setStatuses(s.agents); // a cut or deleted nation dims or greys its land
      // wealth mode: a payment or a year's income can move a nation along the gold scale
      let wealthChanged = false;
      if (s.mapMode === 'wealth') {
        const k = wealthKey(world);
        wealthChanged = k !== lastWealth;
        lastWealth = k;
      } else lastWealth = '';
      // B11: scorch shows in every mode but terrain; politics colours follow each nation's axis
      const scorchKey = s.mapMode === 'terrain' ? '' : `${devastationKey(world)}`;
      const polKey = s.mapMode === 'politics' ? politicsKey(world) : '';
      if (scorchKey + polKey !== lastScorch) { wealthChanged = true; lastScorch = scorchKey + polKey; }
      const changed = s.version !== seenVersion ? diff(events) : new Map<number, string>();
      seenVersion = s.version;
      lastEventId = events.length ? events[events.length - 1]!.id : lastEventId;
      if (modeChanged || statusChanged || wealthChanged || changed === null || seenVersion < 0) paintAll(modeChanged || statusChanged || wealthChanged);
      else if (changed.size > 0) {
        fx.repaint(() => writeColors(mesh, world, ownerFn(), s.mapMode, s.selectedCountryId, changed.keys()), changed.keys(), false);
        if (s.beliefOf == null) {
          let nCollapse = 0;
          for (const [tile, cause] of changed) fx.pulse(tile, cause, cause === 'collapse' ? Math.min(nCollapse++ * 70, 2800) : 0);
        }
        lastPaint.current = performance.now();
      }
    };

    // initial paint
    {
      const s = useWorld.getState();
      setStatuses(s.agents);
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
    return () => { unsub(); unsubBelief(); fx.dispose(); if (timer) clearTimeout(timer); };
  }, [mesh, world]);

  return (
    <mesh name="provinces" geometry={mesh.geometry}>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} />
    </mesh>
  );
}

function Scene({ world }: { world: World }) {
  // Rebuild only when the world id or its tiles array changes; dispose the old geometry.
  const mesh = useMemo(() => buildProvinceMesh(world), [world.id, world.tiles]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => mesh.geometry.dispose(), [mesh]);
  return (
    <ProvinceMeshContext.Provider value={mesh}>
      <Planet world={world} mesh={mesh} />
      <Picking />
      <HoverHighlight />
      <SelectionGlow />
      <Political />
      <Readiness />
      <Structures />
      <Wonders />
      <Units />
      <Routes />
      <Trade />
      <CoinBurst />
      <ChainSeal />
      <Towns />
      <Living />
      <EventBeacons />
      <WarFlash />
      <Council />
      <Spotlight />
    </ProvinceMeshContext.Provider>
  );
}

export function Globe() {
  const world = useWorld((s) => s.world);
  const space = typeof document !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--globe-space').trim() || SPACE
    : SPACE;
  // B8: at most 1.5 device pixels per CSS pixel (a 2x screen would draw 78% more pixels for little gain).
  // Shader error checks stay on in dev only: reading the link log blocks the frame a new material first draws in.
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.8, 2.48], fov: 45 }} onCreated={({ gl }) => { gl.debug.checkShaderErrors = import.meta.env.DEV; }}>
      <color attach="background" args={[space]} />
      <Celestial />
      <Space />
      <Orbit />
      <Atmosphere />
      <Clouds />
      {world && <Scene world={world} />}
      <CameraRig />
      <CaptureBridge />
    </Canvas>
  );
}
