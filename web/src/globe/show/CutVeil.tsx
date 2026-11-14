// "Show, don't tell" (B14): a cut nation sits under a drifting grey mist; on restore its queued moves fly
// out as sealed letters to the other capitals and the mist lifts in a ripple; a deleted nation goes under a
// dark veil that fades as it falls, and its letters sink. While cut, the queued letters are a small HTML
// pile beside the "signal lost" tag (LetterPile.tsx, drawn by status/StatusMarkers.tsx), so they keep a
// fixed pixel size and one marker per nation.
//
// Cost: one overlay mesh built once per world (land fans only), a per-vertex nation id rewritten at most
// every 400 ms when owners change, a few uniform floats per frame, and a fixed pool of flying letter
// sprites (screen-constant size, sizeAttenuation off). No scene traversal. Lane b.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { World } from '@terra/shared';
import { useWorld } from '../../state/world';
import { getPalette } from '../palette';
import { useProvinceMesh } from '../mesh/context';
import { tileHeight } from '../mesh/buildProvinceMesh';
import type { ProvinceMesh } from '../mesh/buildProvinceMesh';
import { capitalPoint } from '../status/geo';
import './show.css';

const MAX_NATIONS = 64;       // uniform slots; ids past this get no veil
const VEIL_LIFT = 0.0035;     // the mist sits just above each tile top
const REBUILD_MS = 400;
const MIST_IN = 0.8;          // seconds for the mist to settle
const LIFT_S = 1.1;           // seconds for the restore ripple to clear the land
const FALL_S = 4.5;           // seconds for the dark veil of a deleted nation to fade
const FLY_MAX = 6;            // letters that fly out per nation on restore (or sink on delete)
const POOL = 36;              // flying letter sprites in the pool
const LETTER_PX = 24;         // letter height on screen in pixels, at any zoom (4:3 envelope)
const FLY_S = 1.1;            // one letter's flight
const FLY_STAGGER = 0.08;     // gap between letters leaving (6 letters: about 1.5 s in all)

// --- the mist shader -------------------------------------------------------------------------------

const VERT = /* glsl */ `
  attribute float aNation;
  flat varying int vN;
  varying vec3 vDir;
  void main() {
    vN = int(aNation + 0.5) - 1;
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec4 uState[${MAX_NATIONS}]; // x: mist amount, y: dark (deleted), z: restore progress or -1
  uniform vec3 uCap[${MAX_NATIONS}];
  uniform float uTime;
  uniform vec3 uMist;
  uniform vec3 uShade;
  uniform vec3 uHolo;
  flat varying int vN;
  varying vec3 vDir;

  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y);
    float b = mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y);
    return mix(a, b, f.z);
  }

  void main() {
    if (vN < 0) discard;
    vec4 st = uState[vN];
    float amt = st.x;
    float lift = st.z;
    if (amt < 0.005 && lift < 0.0) discard;
    float dark = st.y;
    // two layers of drifting fog
    vec3 p = vDir * 9.0;
    float n = noise(p + vec3(uTime * 0.35, uTime * 0.12, -uTime * 0.2)) * 0.6
            + noise(p * 2.3 - vec3(uTime * 0.25, 0.0, uTime * 0.3)) * 0.4;
    vec3 col = mix(uMist, uShade, dark);
    float a = amt * mix(0.58 + 0.3 * n, 0.72 + 0.18 * n, dark);
    if (lift >= 0.0) {
      // restore: the mist clears outwards from the capital behind a bright front
      float d = acos(clamp(dot(vDir, normalize(uCap[vN])), -1.0, 1.0));
      float front = lift * 0.75;
      a *= smoothstep(front - 0.03, front + 0.05, d);
      float ring = exp(-pow((d - front) / 0.025, 2.0)) * (1.0 - lift);
      col = mix(col, uHolo, ring);
      a = max(a, ring * 0.85);
    }
    if (a < 0.004) discard;
    gl_FragColor = vec4(col, a);
  }
`;

function buildVeilGeometry(world: World): { geo: THREE.BufferGeometry; tiles: Int32Array } {
  let verts = 0;
  for (const t of world.tiles) if (t.terrain !== 'ocean') verts += t.boundary.length * 3;
  const pos = new Float32Array(verts * 3);
  const tiles = new Int32Array(verts); // which tile each vertex belongs to
  let vi = 0;
  const put = (p: readonly number[], r: number, tile: number) => {
    const l = Math.hypot(p[0]!, p[1]!, p[2]!) || 1;
    pos[vi * 3] = (p[0]! / l) * r; pos[vi * 3 + 1] = (p[1]! / l) * r; pos[vi * 3 + 2] = (p[2]! / l) * r;
    tiles[vi++] = tile;
  };
  for (const t of world.tiles) {
    if (t.terrain === 'ocean') continue;
    const r = tileHeight(t) + VEIL_LIFT;
    const k = t.boundary.length;
    for (let i = 0; i < k; i++) {
      put(t.center, r, t.id); put(t.boundary[i]!, r, t.id); put(t.boundary[(i + 1) % k]!, r, t.id);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aNation', new THREE.BufferAttribute(new Float32Array(verts), 1));
  geo.computeBoundingSphere();
  return { geo, tiles };
}

// --- the sealed letter -----------------------------------------------------------------------------

let letterTex: THREE.CanvasTexture | null = null;
function letterTexture(): THREE.CanvasTexture {
  if (letterTex) return letterTex;
  const W = 128, H = 96;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  // envelope
  g.fillStyle = '#f1e4c2';
  g.strokeStyle = '#2a1f14';
  g.lineWidth = 5;
  g.beginPath(); g.roundRect(8, 12, W - 16, H - 24, 6); g.fill(); g.stroke();
  // flap
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(10, 15); g.lineTo(W / 2, H / 2 + 6); g.lineTo(W - 10, 15); g.stroke();
  // wax seal with a gilt rim
  g.fillStyle = '#c9a24b';
  g.beginPath(); g.arc(W / 2, H / 2 + 6, 19, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#9e1d16';
  g.beginPath(); g.arc(W / 2, H / 2 + 6, 15.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d24a3a';
  g.beginPath(); g.arc(W / 2 - 4, H / 2 + 2, 5, 0, Math.PI * 2); g.fill();
  letterTex = new THREE.CanvasTexture(c);
  letterTex.colorSpace = THREE.SRGBColorSpace;
  letterTex.anisotropy = 4;
  return letterTex;
}

interface Slot {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  mode: 'free' | 'fly';
  country: number;
  index: number;       // place in the volley
  from: THREE.Vector3; // capital (flight start)
  to: THREE.Vector3;   // flight target capital
  t0: number;          // flight start time (s)
  drop: boolean;       // a flight that falls into the ground (deleted nation)
}

interface Nation { amt: number; target: number; dark: number; lift: number; fallAt: number }

const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
const camUp = new THREE.Vector3();

function Inner({ mesh, world }: { mesh: ProvinceMesh; world: World }) {
  const pal = getPalette();
  const { geo, tiles } = useMemo(() => buildVeilGeometry(world), [world]);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uState: { value: Array.from({ length: MAX_NATIONS }, () => new THREE.Vector4(0, 0, -1, 0)) },
      uCap: { value: Array.from({ length: MAX_NATIONS }, () => new THREE.Vector3(0, 1, 0)) },
      uTime: { value: 0 },
      uMist: { value: new THREE.Color('#a9b3bf') },
      uShade: { value: new THREE.Color('#07090d') },
      uHolo: { value: new THREE.Color(pal.holo) },
    },
  }), [pal.holo]);

  const group = useMemo(() => new THREE.Group(), []);
  const slots = useMemo<Slot[]>(() => {
    const tex = letterTexture();
    const out: Slot[] = [];
    for (let i = 0; i < POOL; i++) {
      // sizeAttenuation off: the scale is a share of the view height, set each frame from LETTER_PX
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, sizeAttenuation: false });
      const s = new THREE.Sprite(m);
      s.frustumCulled = false;
      s.visible = false;
      s.renderOrder = 30;
      group.add(s);
      out.push({ sprite: s, mat: m, mode: 'free', country: -1, index: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), t0: 0, drop: false });
    }
    return out;
  }, [group]);

  const nations = useMemo(() => new Map<number, Nation>(), [world]);

  // Owners to the per-vertex nation id (stored as id + 1; 0 is nobody), at most every 400 ms.
  useEffect(() => {
    const attr = geo.getAttribute('aNation') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    let seen = -1;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = 0;
    const write = () => {
      timer = null;
      last = performance.now();
      const w = useWorld.getState().world;
      if (!w) return;
      for (let v = 0; v < arr.length; v++) {
        const o = w.owner[tiles[v]!] ?? -1;
        arr[v] = o >= 0 && o < MAX_NATIONS ? o + 1 : 0;
      }
      attr.needsUpdate = true;
    };
    write();
    const unsub = useWorld.subscribe((s) => {
      if (s.version === seen || timer) return;
      seen = s.version;
      timer = setTimeout(write, Math.max(0, REBUILD_MS - (performance.now() - last)));
    });
    return () => { unsub(); if (timer) clearTimeout(timer); };
  }, [geo, tiles]);

  // Agent status changes drive the mist targets and the restore and delete flights.
  useEffect(() => {
    const prev = new Map<number, { st: 'up' | 'cut' | 'deleted'; pending: number }>();
    let sig = '';
    const capDir = (id: number): THREE.Vector3 | null => {
      const w = useWorld.getState().world;
      const p = w ? capitalPoint(mesh, w, id, 0.004) : null;
      return p ? new THREE.Vector3(...p) : null;
    };
    const launch = (from: THREE.Vector3, to: THREE.Vector3, country: number, k: number, drop: boolean, now: number) => {
      const s = slots.find((x) => x.mode === 'free');
      if (!s) return;
      s.mode = 'fly'; s.country = country; s.index = k; s.drop = drop;
      s.from.copy(from); s.to.copy(to); s.t0 = now + k * FLY_STAGGER;
      s.sprite.visible = false;
    };

    const onAgents = () => {
      const s = useWorld.getState();
      let next = '';
      // the pending count only matters up to the letters that fly
      for (const a of s.agents) next += `${a.countryId}:${a.deleted ? 'd' : a.link}:${Math.min(a.pendingEvents, FLY_MAX)}|`;
      if (next === sig) return;
      sig = next;
      const now = performance.now() / 1000;

      for (const a of s.agents) {
        const id = a.countryId;
        if (id >= MAX_NATIONS) continue;
        const st = a.deleted ? 'deleted' : a.link;
        const was = prev.get(id);
        let n = nations.get(id);
        if (!n) { n = { amt: 0, target: 0, dark: 0, lift: -1, fallAt: -1 }; nations.set(id, n); }
        const cap = capDir(id);
        if (cap) (mat.uniforms.uCap!.value as THREE.Vector3[])[id]!.copy(cap);

        if (st === 'cut') {
          n.target = 1; n.dark = 0; n.lift = -1;
        } else if (st === 'up' && was?.st === 'cut') {
          // restore: lift the mist from the capital outwards and send the queued letters to the other
          // capitals. Every other living capital is a target, cut or not: in a blackout restored one
          // nation at a time, none of the others is up yet.
          n.target = 0; n.lift = 0;
          const targets = s.agents
            .filter((x) => !x.deleted && x.countryId !== id)
            .map((x) => capDir(x.countryId))
            .filter((v): v is THREE.Vector3 => v != null);
          const count = Math.min(was.pending, FLY_MAX);
          if (cap && targets.length) for (let k = 0; k < count; k++) launch(cap, targets[k % targets.length]!, id, k, false, now);
        } else if (st === 'deleted' && was && was.st !== 'deleted') {
          // deleted: a dark veil drops at once and fades as the land falls away; any queued letters sink
          n.amt = 1; n.target = 0; n.dark = 1; n.lift = -1; n.fallAt = now;
          const count = was.st === 'cut' ? Math.min(was.pending, 3) : 0;
          if (cap) for (let k = 0; k < count; k++) launch(cap, cap, id, k, true, now);
        } else if (st === 'up') {
          if (n.lift < 0) n.target = 0;
        }
        prev.set(id, { st, pending: a.pendingEvents });
      }
    };
    onAgents();
    const unsub = useWorld.subscribe(onAgents);
    return () => { unsub(); for (const s of slots) { s.mode = 'free'; s.sprite.visible = false; } };
  }, [mesh, slots, mat, nations]);

  useEffect(() => () => { geo.dispose(); }, [geo]);
  useEffect(() => () => { mat.dispose(); }, [mat]);
  useEffect(() => () => { for (const s of slots) s.mat.dispose(); }, [slots]);

  useFrame(({ clock, camera, size }, dt) => {
    const t = clock.elapsedTime;
    const now = performance.now() / 1000;
    const u = mat.uniforms;
    u.uTime!.value = t;
    const state = u.uState!.value as THREE.Vector4[];
    const step = Math.min(dt, 0.1);
    for (const [id, n] of nations) {
      if (n.fallAt >= 0) {
        const k = (now - n.fallAt) / FALL_S;
        n.amt = k >= 1 ? 0 : 1 - k * k;
        if (k >= 1) { n.fallAt = -1; n.dark = 0; }
      } else if (n.lift >= 0) {
        n.lift += step / LIFT_S;
        if (n.lift >= 1) { n.lift = -1; n.amt = 0; }
      } else if (n.amt !== n.target) {
        const d = step / MIST_IN;
        n.amt = n.target > n.amt ? Math.min(n.target, n.amt + d) : Math.max(n.target, n.amt - d);
      }
      state[id]!.set(n.lift >= 0 ? 1 : n.amt, n.dark, n.lift, 0);
    }

    // fliers arc between capitals (or sink into a deleted capital) at a fixed pixel size
    const p11 = camera.projectionMatrix.elements[5]!;
    const sy = (2 * LETTER_PX) / (p11 * Math.max(1, size.height));
    camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const dist = camera.position.length();
    for (const s of slots) {
      if (s.mode === 'free') continue;
      const sp = s.sprite;
      const k = (now - s.t0) / FLY_S;
      if (k < 0) { sp.visible = false; continue; }
      if (k >= 1) { s.mode = 'free'; sp.visible = false; continue; }
      const e = k * k * (3 - 2 * k);
      sp.scale.set(sy * 4 / 3, sy, 1);
      if (s.drop) {
        // sink a little way down the screen into the falling land
        sp.position.copy(s.from).addScaledVector(camUp, dist * 0.02 * (1 - e) - dist * 0.01 * s.index);
        sp.material.opacity = 1 - e;
      } else {
        tmpA.copy(s.from).normalize();
        tmpB.copy(s.to).normalize();
        const ang = tmpA.angleTo(tmpB);
        tmpC.copy(tmpA).lerp(tmpB, e).normalize();
        const r0 = s.from.length() * (1 - e) + s.to.length() * e;
        const h = Math.sin(Math.PI * e) * (0.08 + 0.22 * ang);
        sp.position.copy(tmpC).multiplyScalar(r0 + h);
        sp.material.opacity = k < 0.08 ? k / 0.08 : k > 0.85 ? (1 - k) / 0.15 : 1;
      }
      sp.material.rotation = Math.sin(t * 6 + s.index) * 0.15;
      sp.visible = true;
    }
  });

  return (
    <>
      <mesh geometry={geo} material={mat} renderOrder={6} frustumCulled={false} />
      <primitive object={group} />
    </>
  );
}

export function CutVeil() {
  const mesh = useProvinceMesh();
  const world = useWorld((s) => s.world);
  if (!mesh || !world) return null;
  return <Inner mesh={mesh} world={world} />;
}
