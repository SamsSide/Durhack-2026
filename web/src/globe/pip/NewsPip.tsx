// The news picture-in-picture: a second camera that films one tile from close by, live, for the
// broadcast window (web/src/ui/news). Lane a in lane b's globe. Mount last inside the Canvas.
//
// One WebGL context, no render target and no read-back: just before the main view is drawn, the scene
// is drawn once more into a small corner of the same drawing buffer (viewport and scissor), that corner
// is copied to a 2D canvas (GPU to GPU), and the main render then clears and redraws the whole buffer.
// Nothing of it ever reaches the screen outside the broadcast window, and the main camera is untouched.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { World } from '@terra/shared';
import { useWorld } from '../../state/world';
import { tileHeight } from '../mesh/buildProvinceMesh';
import { GROUND_CLEARANCE, PROP_CLEARANCE, propTops, TerrainLookup } from '../camera/groundView';
import { scanPropTops } from '../camera/propScan';
import { sunDir } from '../celestial/sun';
import { hideDetailFromMain, pipLod, PIP_MAIN_FAR, runPipPass } from './pipLod';
import { PIP_H, PIP_MAX_SCALE, PIP_W, pipFeed } from './shot';

/** The move, in tile widths (centre to centre): from a little high and back, down and in. */
const MOVE = {
  backFrom: 2.1, backTo: 1.35,
  upFrom: 1.2, upTo: 0.65,
  /** Radians turned round the tile over the shot. */
  orbit: 0.55,
  /** The camera looks at a point this far short of the tile, so the place sits above the caption strap and the horizon in the upper third. */
  lookShort: 0.3,
  fov: 38,
};
/** The camera is in place this long before the shot goes on air, so the close-up layers have faded in. */
const PRE_ROLL_MS = 900;
const STILL_EVERY_MS = 500;
/** The live picture is filmed at about 30 frames a second (every other main frame): half the cost, and it reads as television. */
const FRAME_EVERY_MS = 30;
const SPRITES_EVERY_MS = 400;
/**
 * The shot's sun never sits lower over the filmed tile than this (sine of its elevation, about 24
 * degrees): a beat on the night side is filmed in late-afternoon light, its bearing kept, for the PiP
 * pass only. The main view's sun, key light and sky are restored before it is drawn.
 */
const PIP_MIN_SUN = Math.sin((24 * Math.PI) / 180);

const smooth = (u: number): number => { const k = Math.min(1, Math.max(0, u)); return k * k * (3 - 2 * k); };
const hash = (n: number): number => { const s = Math.sin(n * 127.1 + 31.7) * 43758.5453; return s - Math.floor(s); };

interface Frame { n: THREE.Vector3; east: THREE.Vector3; north: THREE.Vector3; r: number; size: number; az: number }

/** The sun the shot is lit by: the real one, raised to PIP_MIN_SUN over the tile when it is lower. Null when it is high enough. */
function shotSun(f: Frame, out: THREE.Vector3): THREE.Vector3 | null {
  const e = sunDir.dot(f.n);
  if (e >= PIP_MIN_SUN) return null;
  // its bearing over the tile: the camera starts 0.6 rad round from it (frameOf), so it stays behind the camera's shoulder
  const b = f.az - 0.6;
  out.copy(f.east).multiplyScalar(Math.cos(b)).addScaledVector(f.north, Math.sin(b));
  return out.multiplyScalar(Math.sqrt(1 - PIP_MIN_SUN * PIP_MIN_SUN)).addScaledVector(f.n, PIP_MIN_SUN).normalize();
}

/** The tile's local frame and the side the camera starts on: sun behind its shoulder when there is one. */
function frameOf(world: World, tile: number): Frame | null {
  const t = world.tiles[tile];
  if (!t) return null;
  const n = new THREE.Vector3(t.center[0], t.center[1], t.center[2]).normalize();
  const east = new THREE.Vector3(0, 1, 0).cross(n);
  if (east.lengthSq() < 1e-6) east.set(1, 0, 0);
  east.normalize();
  const north = new THREE.Vector3().crossVectors(n, east).normalize();
  let size = 0.07;
  const nb = world.tiles[t.neighbors[0] ?? -1];
  if (nb) size = new THREE.Vector3(nb.center[0], nb.center[1], nb.center[2]).normalize().distanceTo(n);
  const s = sunDir.clone().addScaledVector(n, -sunDir.dot(n));
  const az = s.length() > 0.08 ? Math.atan2(s.dot(north), s.dot(east)) + 0.6 : hash(tile) * Math.PI * 2;
  return { n, east, north, r: tileHeight(t), size, az };
}

export function NewsPip() {
  const world = useWorld((s) => s.world);
  const worldKey = world ? `${world.id}:${world.tiles.length}` : null;
  const lookup = useMemo(() => (world ? new TerrainLookup(world) : null), [worldKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const cam = useMemo(() => {
    const c = new THREE.PerspectiveCamera(MOVE.fov, PIP_W / PIP_H, 0.004, 80);
    c.matrixAutoUpdate = true;
    return c;
  }, []);
  const live = useRef({ propTop: 0, propAt: -1e9, tile: -1, t0: 0, frame: null as Frame | null, lastStill: 0, spritesAt: 0, sprites: [] as THREE.Object3D[], pools: [] as THREE.InstancedMesh[], keys: [] as THREE.DirectionalLight[], moved: [] as THREE.DirectionalLight[], hidden: [] as THREE.Object3D[] });
  const v = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), off: new THREE.Vector3(), size: new THREE.Vector2(), sun: new THREE.Vector3(), realSun: new THREE.Vector3(), keyPos: [] as THREE.Vector3[] }), []);

  useEffect(() => () => { pipLod.camera = null; }, []);

  useFrame(({ gl, scene, camera }) => {
    const shot = pipFeed.shot;
    const w = useWorld.getState().world;
    const now = performance.now();
    const st = live.current;
    if (!shot || !w || !lookup || now < shot.t0 - PRE_ROLL_MS) {
      if (pipLod.camera) { pipLod.camera = null; pipLod.hideUntil = now + 1200; }
      if (now < pipLod.hideUntil && camera.position.length() > PIP_MAIN_FAR) hideDetailFromMain();
      return;
    }
    if (st.tile !== shot.tile || st.t0 !== shot.t0) {
      st.tile = shot.tile;
      st.t0 = shot.t0;
      st.frame = frameOf(w, shot.tile);
      st.lastStill = 0;
      st.propAt = -1e9;
      st.propTop = 0;
    }
    const f = st.frame;
    if (!f) return;

    // The tallest model on the tile and its ring (a temple, a tower), found a few times a second with the ground camera's
    // prop scan. The scan writes the shared propTops, so it is saved and put back: the main camera never sees it.
    if (now - st.propAt > 700) {
      st.propAt = now;
      const keep = new Map(propTops);
      v.pos.copy(f.n).multiplyScalar(f.r);
      scanPropTops(scene, v.pos, lookup, f.size * 3);
      let top = 0;
      const t = w.tiles[shot.tile];
      for (const i of [shot.tile, ...(t?.neighbors ?? [])]) top = Math.max(top, propTops.get(i) ?? 0);
      st.propTop = top;
      propTops.clear();
      for (const [k, val] of keep) propTops.set(k, val);
    }

    // --- the move: push in and turn slowly round the tile ---
    const u = shot.still ? 0.6 : smooth((now - shot.t0) / (shot.duration * 1000));
    const lin = shot.still ? 0.6 : Math.min(1, Math.max(0, (now - shot.t0) / (shot.duration * 1000)));
    const az = f.az + MOVE.orbit * (lin - 0.5);
    const back = (MOVE.backFrom + (MOVE.backTo - MOVE.backFrom) * u) * f.size;
    const up = (MOVE.upFrom + (MOVE.upTo - MOVE.upFrom) * u) * f.size;
    v.off.copy(f.east).multiplyScalar(Math.cos(az)).addScaledVector(f.north, Math.sin(az));
    v.pos.copy(f.n).multiplyScalar(f.r + up).addScaledVector(v.off, back);
    // never inside a hill: stay clear of the ground under the camera
    const floor = lookup.ridgeAt(v.pos.x, v.pos.y, v.pos.z) + GROUND_CLEARANCE * 0.6;
    // and above the tallest model around the tile, so no column or tower fills the lens
    const clear = Math.max(floor, st.propTop > 0 ? st.propTop + PROP_CLEARANCE * 2 : 0);
    if (v.pos.length() < clear) v.pos.setLength(clear);
    v.look.copy(f.n).multiplyScalar(f.r + 0.12 * f.size).addScaledVector(v.off, MOVE.lookShort * f.size);
    cam.position.copy(v.pos);
    cam.up.copy(f.n);
    cam.lookAt(v.look);
    cam.updateMatrixWorld();
    pipLod.camera = cam;

    const borrowed = pipLod.borrowed;
    pipLod.borrowed = false;
    const hideAfter = borrowed || (now < pipLod.hideUntil && camera.position.length() > PIP_MAIN_FAR);

    // Pre-roll frames only warm the close-up layers; a still camera needs a new picture twice a second.
    const onAirSoon = now >= shot.t0 - 250;
    const due = onAirSoon && (now - st.lastStill >= (shot.still ? STILL_EVERY_MS : FRAME_EVERY_MS) || pipFeed.frames === 0);
    if (due) {
      st.lastStill = now;
      const t0 = import.meta.env.DEV ? performance.now() : 0;
      const pr = gl.getPixelRatio();
      const scale = Math.min(PIP_MAX_SCALE, Math.max(1, window.devicePixelRatio || 1));
      gl.getDrawingBufferSize(v.size);
      const pw = Math.min(Math.round(PIP_W * scale), v.size.x);
      const ph = Math.min(Math.round(PIP_H * scale), v.size.y);
      let out = pipFeed.canvas;
      if (!out) out = pipFeed.canvas = document.createElement('canvas');
      if (out.width !== pw || out.height !== ph) { out.width = pw; out.height = ph; }
      const ctx = out.getContext('2d', { alpha: false });
      if (ctx) {
        // Counters and beacons are sprites sized for the main camera: out of the close shot.
        if (now - st.spritesAt > SPRITES_EVERY_MS) {
          st.spritesAt = now;
          st.sprites.length = 0;
          st.pools.length = 0;
          st.keys.length = 0;
          scene.traverse((o) => {
            if ((o as THREE.Sprite).isSprite) st.sprites.push(o);
            else if ((o as THREE.InstancedMesh).isInstancedMesh) st.pools.push(o as THREE.InstancedMesh);
            else if ((o as THREE.DirectionalLight).isDirectionalLight) st.keys.push(o as THREE.DirectionalLight);
          });
        }
        // Daylight for the shot: swing the shared sun (sky, city lights) and the key light that follows it.
        const sun = shotSun(f, v.sun);
        st.moved.length = 0;
        if (sun) {
          v.realSun.copy(sunDir);
          for (const k of st.keys) {
            const d = k.position.length();
            if (d < 1e-6 || k.position.dot(sunDir) < 0.99 * d) continue; // only the light that follows the sun
            (v.keyPos[st.moved.length] ??= new THREE.Vector3()).copy(k.position);
            k.position.copy(sun).multiplyScalar(d);
            st.moved.push(k);
          }
          sunDir.copy(sun);
        }
        // The layers' own hooks first (the armies fill their model pools here), then hidden for this
        // pass only: the sprites, and instanced pools with nothing in them (each one still costs a draw
        // call; the building pools are mostly empty, so this halves the pass).
        runPipPass(true, cam);
        st.hidden.length = 0;
        for (const s of st.sprites) if (s.visible) { s.visible = false; st.hidden.push(s); }
        for (const m of st.pools) if (m.visible && m.count === 0) { m.visible = false; st.hidden.push(m); }

        gl.setViewport(0, 0, pw / pr, ph / pr);
        gl.setScissor(0, 0, pw / pr, ph / pr);
        gl.setScissorTest(true);
        gl.render(scene, cam);
        const t1 = import.meta.env.DEV ? performance.now() : 0;
        ctx.drawImage(gl.domElement, 0, v.size.y - ph, pw, ph, 0, 0, pw, ph);
        if (import.meta.env.DEV) pipFeed.blitMs += (performance.now() - t1 - pipFeed.blitMs) * 0.05;
        gl.setScissorTest(false);
        gl.getSize(v.size);
        gl.setViewport(0, 0, v.size.x, v.size.y);
        gl.setScissor(0, 0, v.size.x, v.size.y);

        for (const o of st.hidden) o.visible = true;
        runPipPass(false, cam);
        if (sun) {
          sunDir.copy(v.realSun);
          for (let i = 0; i < st.moved.length; i++) st.moved[i]!.position.copy(v.keyPos[i]!);
        }
        pipFeed.frames++;
      }
      if (import.meta.env.DEV) pipFeed.ms += (performance.now() - t0 - pipFeed.ms) * 0.05;
    }
    if (hideAfter) hideDetailFromMain();
  });

  return null;
}

if (import.meta.env.DEV) Object.assign(window, { __tnPip: pipFeed, __tnPipLod: pipLod, __tnSun: sunDir }); // dev only: frames, cost, the camera and the sun from the console
