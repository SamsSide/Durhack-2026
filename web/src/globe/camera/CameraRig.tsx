// Camera: drei CameraControls (orbit + smooth zoom, no pan) and fly-to via the camera store. Lane b.
// Zoomed right in, the view tilts into a ground view along the surface (see groundView.ts).
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import type { CameraControls as CameraControlsImpl } from '@react-three/drei';
import { useCamera } from '../../state/camera';
import { useWorld } from '../../state/world';
import { CAM_MAX, CAM_MIN } from '../constants';
import { flyControlsTo, onFocusTile } from '../events/focus';
import { GroundSky } from './GroundSky';
import {
  GROUND_CLEARANCE, GROUND_MIN, GROUND_PITCH, GROUND_START, TerrainLookup, groundTilt, groundView,
} from './groundView';

const NONE = 0, ROTATE = 1, TOUCH_ROTATE = 64; // camera-controls ACTION values
const FLY_DISTANCE = 1.6;
const FLY_SMOOTH = 0.4; // about 1.2 s to settle
const SMOOTH = 0.25;
const DOLLY_SPEED = 0.6;
const TURN_KEYS = 1.4;          // Q and E: radians per second around the local normal
const TURN_DRAG = 0.5;          // right drag or ctrl-drag: turns per screen height
const NEAR_FAR = 0.1, NEAR_MIN = 0.0015;
const AXIS_X = new THREE.Vector3(1, 0, 0), AXIS_Z = new THREE.Vector3(0, 0, 1);

const isTyping = (t: EventTarget | null): boolean => {
  const el = t as HTMLElement | null;
  const tag = el?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el?.isContentEditable;
};
const wrapPi = (a: number): number => a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI;

// Pixels to shift the view sideways so the selected nation sits in the free space between the
// folded network tab (left) and the nation card (right). 0 with no selection or on narrow screens.
function readPx(name: string, fallback: number): number {
  try {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
}
function focalOffsetPx(selected: boolean): number {
  if (!selected || typeof window === 'undefined' || window.innerWidth < 1100) return 0;
  const card = readPx('--card-width', 380);
  const tab = readPx('--net-tab-width', 40);
  const margin = 16;
  return (card + margin - (tab + margin)) / 2; // card side minus tab side, halved
}

export function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null);
  const flyingUntil = useRef(0);
  const selected = useWorld((s) => s.selectedCountryId != null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const lastOff = useRef({ d: -1, h: -1, w: -1, sel: false, t: 0 });
  const slantRef = useRef(2.5); // distance from the camera to what it centres on
  const dom = useThree((s) => s.gl.domElement);
  const world = useWorld((s) => s.world);
  // Two lookups so the ground point and the camera each keep their own "last tile" hint.
  const terrain = useMemo(
    () => (world ? { ground: new TerrainLookup(world), eye: new TerrainLookup(world) } : null),
    [world?.id, world?.tiles], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Ground-view state: smoothed ground radius under the look point and under the camera, the
  // heading the user turned to, held turn keys and the drag in progress.
  const gv = useRef({ rg: 1, re: 1, heading: 0, keyL: false, keyR: false, drag: null as null | 'turn' | 'pan', x: 0, y: 0, left: -1 });
  const tmp = useMemo(() => ({
    n: new THREE.Vector3(), g: new THREE.Vector3(), p: new THREE.Vector3(),
    q: new THREE.Quaternion(), r: new THREE.Quaternion(),
  }), []);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.mouseButtons.right = NONE;
    c.mouseButtons.middle = NONE;
    c.touches.three = NONE;
    const A = (c.constructor as unknown as { ACTION: Record<string, number> }).ACTION;
    c.touches.two = (A.TOUCH_DOLLY ?? 0) as typeof c.touches.two;
    // Dev only: lets a browser review set the zoom exactly (window.__cam.dollyTo(3.5, false)).
    if (import.meta.env.DEV) {
      (window as unknown as { __cam?: unknown }).__cam = c;
      (window as unknown as { __ground?: unknown }).__ground = groundView;
    }
  }, []);

  // Ground view input: Q and E (or a right drag, or ctrl-drag) turn the view around the local
  // normal; once turned, a plain drag is handled here so it still pans along the screen axes.
  useEffect(() => {
    const s = gv.current;
    const onKey = (e: KeyboardEvent) => {
      const down = e.type === 'keydown';
      if (down && (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target))) return;
      const k = e.key.toLowerCase();
      if (k === 'q') s.keyL = down;
      else if (k === 'e') s.keyR = down;
    };
    const onBlur = () => { s.keyL = false; s.keyR = false; s.drag = null; };
    const onDown = (e: PointerEvent) => {
      const c = ref.current;
      if (!c || !e.isPrimary || groundView.tilt < 0.02) return;
      const turn = e.button === 2 || (e.button === 0 && e.ctrlKey);
      if (turn) {
        s.drag = 'turn';
        c.mouseButtons.left = NONE as typeof c.mouseButtons.left; // before the controls see this press
      } else if (e.button === 0 && s.left === NONE) s.drag = 'pan';
      else return;
      s.x = e.clientX;
      s.y = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      const c = ref.current;
      if (!c || !s.drag || !e.isPrimary) return;
      const dx = s.x - e.clientX, dy = s.y - e.clientY; // the controls' convention: last minus now
      s.x = e.clientX;
      s.y = e.clientY;
      const h = Math.max(1, dom.clientHeight);
      if (s.drag === 'turn') {
        s.heading = wrapPi(s.heading - (dx / h) * TURN_DRAG * 2 * Math.PI);
        return;
      }
      const a = groundView.heading, cos = Math.cos(a), sin = Math.sin(a);
      const k = (2 * Math.PI * c.azimuthRotateSpeed) / h;
      void c.rotate((dx * cos + dy * sin) * k, (-dx * sin + dy * cos) * k, true);
    };
    const onUp = (e: PointerEvent) => { if (e.isPrimary) s.drag = null; };
    const noMenu = (e: Event) => e.preventDefault();
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', onBlur);
    dom.addEventListener('pointerdown', onDown, true);
    dom.addEventListener('contextmenu', noMenu);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', onBlur);
      dom.removeEventListener('pointerdown', onDown, true);
      dom.removeEventListener('contextmenu', noMenu);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dom]);

  // Ground view: runs right after the controls wrote the orbit pose (priority -1) and before every
  // other layer reads the camera. It swings that pose around the ground point under the camera, so
  // with no tilt the result is exactly the orbit pose and the blend has no seam.
  useFrame((state, dt) => {
    const c = ref.current;
    if (!c) return;
    const cam = state.camera as THREE.PerspectiveCamera;
    const s = gv.current;
    const { n, g, p, q, r } = tmp;
    const d = c.distance;
    const ease = 1 - Math.exp(-Math.min(dt, 0.1) * 7);

    n.copy(AXIS_Z).applyQuaternion(cam.quaternion); // straight up from the ground point
    g.copy(cam.position).addScaledVector(n, -(d - 1));
    const rgGoal = terrain ? terrain.ground.radiusAt(g.x, g.y, g.z) : 1;
    s.rg = d - rgGoal > GROUND_START + 0.1 ? rgGoal : s.rg + (rgGoal - s.rg) * ease;
    const h = d - s.rg;
    const tilt = groundTilt(h);
    const slant = Math.max(h, GROUND_MIN);

    // The wheel stops a little above the ground point, whatever the terrain height there.
    const flying = flyingUntil.current !== 0;
    c.minDistance = s.rg + GROUND_MIN;
    if (!flying && d < c.minDistance - 1e-4) void c.dollyTo(c.minDistance, true);

    // Turning: only in ground view; it unwinds as the view lifts back to north-up.
    if (tilt <= 0) s.heading = 0;
    else if (s.keyL !== s.keyR) s.heading = wrapPi(s.heading + (s.keyL ? 1 : -1) * TURN_KEYS * Math.min(dt, 0.1));
    const heading = s.heading * Math.min(1, tilt * 3);
    // Once turned, the controls' own drag would pan along north and east: take the drag over.
    const left = heading !== 0 || s.drag === 'turn' ? NONE : ROTATE;
    if (left !== s.left) {
      s.left = left;
      c.mouseButtons.left = left as typeof c.mouseButtons.left;
      c.touches.one = (left === NONE ? NONE : TOUCH_ROTATE) as typeof c.touches.one;
    }

    let height = cam.position.length() - s.rg;
    if (tilt > 0) {
      g.copy(cam.position).addScaledVector(n, -h); // the ground point: the pivot and the look target
      q.copy(cam.quaternion)
        .multiply(r.setFromAxisAngle(AXIS_Z, heading))
        .multiply(r.setFromAxisAngle(AXIS_X, tilt * GROUND_PITCH));
      p.copy(AXIS_Z).applyQuaternion(q).multiplyScalar(slant).add(g);
      // Never under the terrain: lift the camera over the land (and its neighbours' cliffs) below it.
      const reGoal = terrain ? terrain.eye.ridgeAt(p.x, p.y, p.z) : 1;
      s.re += (reGoal - s.re) * ease;
      const floor = s.re + GROUND_CLEARANCE;
      if (p.length() < floor) p.setLength(floor);
      height = p.length() - s.re;
      cam.position.copy(p);
      cam.quaternion.copy(q);
      cam.updateMatrixWorld();
    } else s.re = s.rg;

    // Near plane follows the height so close walls stay crisp and nothing clips into the lens.
    const near = Math.min(NEAR_FAR, Math.max(NEAR_MIN, height * 0.25));
    if (Math.abs(near - cam.near) > cam.near * 0.02) {
      cam.near = near;
      cam.updateProjectionMatrix();
    }

    groundView.tilt = tilt;
    groundView.heading = heading;
    groundView.height = height;
    slantRef.current = d + (slant - d) * tilt;
    // Near the ground a wheel notch moves a fixed share of the height (about a seventh), not of the
    // distance to the planet's centre, so the tilt range takes several notches instead of two.
    const k = Math.min(1, Math.max(0, (GROUND_START + 0.25 - h) / 0.25));
    c.dollySpeed = DOLLY_SPEED * (1 + k * (Math.min(1, Math.max(0.12, h / d / 0.7)) - 1));
  }, -0.5);

  // Rotation speed scales with distance so close-up dragging is not twitchy.
  useFrame(() => {
    const c = ref.current;
    if (!c) return;
    const d = c.distance;
    const speed = 0.25 + 0.75 * Math.min(1, Math.max(0, (d - CAM_MIN) / (CAM_MAX - CAM_MIN)));
    // In ground view the pan follows the height above the ground, so a drag moves about a screenful.
    const pan = speed + (Math.max(0.02, 0.3 * (d - gv.current.rg)) - speed) * groundView.tilt;
    c.azimuthRotateSpeed = pan;
    c.polarRotateSpeed = pan;
    // Keep the sideways view shift right as zoom, window size and selection change (throttled).
    const now = performance.now();
    const last = lastOff.current;
    const sel = selectedRef.current;
    const h = window.innerHeight;
    const w = window.innerWidth;
    const changed =
      sel !== last.sel || h !== last.h || w !== last.w || Math.abs(d - last.d) > 0.02 * Math.max(d, 0.1);
    if (changed && now - last.t > 100) {
      const cam = c.camera as { fov?: number };
      const fov = ((cam.fov ?? 45) * Math.PI) / 180;
      const px = focalOffsetPx(sel);
      // In ground view the thing to centre is the ground point, much nearer than the planet's centre.
      const shift = (px / Math.max(h, 1)) * 2 * slantRef.current * Math.tan(fov / 2);
      void c.setFocalOffset(shift, 0, 0, true);
      lastOff.current = { d, h, w, sel, t: now };
    }
    if (flyingUntil.current && performance.now() > flyingUntil.current) {
      flyingUntil.current = 0;
      c.smoothTime = SMOOTH;
    }
  });

  const nonce = useCamera((s) => s.nonce);
  useEffect(() => {
    const c = ref.current;
    const { target } = useCamera.getState();
    const w = useWorld.getState().world;
    const country = target != null ? w?.countries[target] : undefined;
    const centre = country && w ? w.tiles[country.capitalTile]?.center : undefined;
    if (!c || !centre) return;
    const len = Math.hypot(centre[0], centre[1], centre[2]) || 1;
    const polar = Math.acos(Math.min(1, Math.max(-1, centre[1] / len)));
    let azimuth = Math.atan2(centre[0], centre[2]);
    const cur = c.azimuthAngle;
    azimuth += Math.round((cur - azimuth) / (2 * Math.PI)) * 2 * Math.PI; // shortest way round
    c.smoothTime = FLY_SMOOTH;
    flyingUntil.current = performance.now() + 1400;
    void c.rotateTo(azimuth, polar, true);
    void c.dollyTo(FLY_DISTANCE, true);
  }, [nonce]);

  // Fly to a single tile: beacon clicks, the spotlight tour, 'terra:focus-tile' from the feed.
  useEffect(() => onFocusTile((tile) => {
    const c = ref.current;
    const centre = useWorld.getState().world?.tiles[tile]?.center;
    if (!c || !centre) return;
    flyingUntil.current = performance.now() + 1400;
    flyControlsTo(c, centre);
  }), []);

  // minDistance and dollySpeed are set every frame by the ground view above.
  return (
    <>
      <CameraControls
        ref={ref}
        makeDefault
        maxDistance={CAM_MAX}
        smoothTime={SMOOTH}
        draggingSmoothTime={0.12}
        minPolarAngle={0.05}
        maxPolarAngle={Math.PI - 0.05}
      />
      <GroundSky />
    </>
  );
}
