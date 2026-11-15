// Nation and region names, Age of History style: each name faces the camera, is turned in the
// screen plane to its nation's long axis, spans about 70% of the land with widely spaced Cinzel
// capitals, and bends around the globe so terrain never clips it (#106). Lane b.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { usePipHidden } from '../pip/pipLod';
import { flagSvg, regionOwner } from '@terra/shared';
import type { FlagSpec } from '@terra/shared';
import { useWorld } from '../../state/world';
import { CLOSE, LAND_BASE, MOUNTAIN_BONUS, RELIEF } from '../constants';
import { groundView } from '../camera/groundView';
import { getPalette } from '../palette';
import { useProvinceMesh } from '../mesh/context';
import { statusOf } from '../status/statusTint';
import { boxesCross, labelAxis, labelFont, mainBody, nationBoxes, subscribeFont } from './labelLayout';
import { capitalPoint } from '../status/geo';
import type { LabelAxis } from './labelLayout';

const RENDER_ORDER = 1000; // after the globe, borders and units: never hidden by terrain
const TOP = LAND_BASE + RELIEF + MOUNTAIN_BONUS; // the highest terrain can reach
const FADE_FAR = 1.5; // nation names fully visible above this camera distance
const FADE_NEAR = 1.3; // and gone below this
const FLAG_NEAR = 2.3; // flags beside names only when zoomed in closer than this
const SPAN = 0.7; // the name spans this share of the nation's projected length
const LS_BASE = 0.35; // letter spacing (em) when the size is free
const LS_MIN = 0.08, LS_MAX = 1.4;
const MAX_ANGLE = (60 * Math.PI) / 180;
const SIZES = { nation: { min: 13, max: 56 }, region: { min: 11, max: 20 } }; // px, cap height-ish
const TINY = 9; // px: with little room (far zoom, near a panel) a name shrinks to this before it fades
const LIMB = 0.9; // names stay inside this share of the visible disc
const ENGRAVE_FILL = '#f1e3bd'; // warm parchment lettering
const ENGRAVE_EDGE = '#1a120a'; // thin dark engraved edge
const PANEL_GAP = 10; // px kept clear of the side panels
const CAP_R = 44; // px: the room a capital's marker and its counters take round their middle
const CAP_UP = 26; // px: that middle sits this far above the capital's dot

/** The free screen band between the network panel (left) and the nation card (also left), in px. */
const band = { left: 0, right: Infinity, t: 0 };
function freeBand(width: number): { left: number; right: number } {
  const now = performance.now();
  if (now - band.t > 400 && typeof document !== 'undefined') {
    band.t = now;
    let left = 0, right = width;
    const net = document.querySelector('.tn-net');
    if (net) { const r = net.getBoundingClientRect(); if (r.width > 0 && r.left < width / 2) left = Math.max(left, r.right); }
    const card = document.querySelector('.left-dock:not(.out)');
    if (card) { const r = card.getBoundingClientRect(); if (r.width > 0 && r.left < width / 2) left = Math.max(left, r.right); }
    band.left = left + PANEL_GAP; band.right = right - PANEL_GAP;
  }
  return { left: band.left, right: Math.min(band.right, width) };
}

interface LabelData extends LabelAxis {
  key: string;
  name: string;
  kind: 'nation' | 'region';
  owner: number;
  dir: [number, number, number];
  /** Unit centres of the labelled tiles (x, y, z per tile), to anchor on the part in view. */
  pts: Float32Array;
  flag: FlagSpec;
  /** A nation's capital (a point on the globe): its name steps aside from the marker there. */
  cap?: [number, number, number];
}

const ANCHOR_EVERY = 120; // ms between re-anchoring on the visible part of the land
const VIS_LO = 0.45, VIS_HI = 0.97; // tiles weigh in from this facing (cos to camera), fully at the top
const IN_VIEW = 0.3; // a tile facing more than this counts as in view

/**
 * The anchor of a name: the centre of the part of its land that faces the camera. A big nation's
 * whole-body centroid is often at the limb or round the back while half of it is in view; anchoring
 * there hid every big name at the default zoom. Returns the share of the land in view.
 */
function visibleAnchor(pts: Float32Array, cam: THREE.Vector3, out: THREE.Vector3): number {
  const d = cam.length() || 1;
  const cx = cam.x / d, cy = cam.y / d, cz = cam.z / d;
  let x = 0, y = 0, z = 0, w = 0, seen = 0;
  const n = pts.length / 3;
  for (let i = 0; i < n; i++) {
    const px = pts[3 * i]!, py = pts[3 * i + 1]!, pz = pts[3 * i + 2]!;
    const f = px * cx + py * cy + pz * cz;
    if (f > IN_VIEW) seen++;
    let k = Math.min(1, Math.max(0, (f - VIS_LO) / (VIS_HI - VIS_LO)));
    if (k <= 0) continue;
    k *= k; // the part nearest the middle of the view pulls hardest: room for the name
    x += px * k; y += py * k; z += pz * k; w += k;
  }
  if (w <= 0) return 0;
  out.set(x, y, z).normalize();
  return seen / Math.max(1, n);
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const clamp01 = (x: number): number => clamp(x, 0, 1);

function FlagLabel({ data, font }: { data: LabelData; font: string | undefined }) {
  const INK = getPalette().ink;
  const HALO = getPalette().ink;
  const groupRef = useRef<THREE.Group>(null);
  usePipHidden(groupRef); // laid out for the main camera: not in the news PiP
  const innerRef = useRef<THREE.Group>(null);
  const textRef = useRef<any>(null); // troika Text instance
  const flagRef = useRef<THREE.Mesh>(null);
  const flagMat = useRef<THREE.MeshBasicMaterial>(null);
  const strike = useRef<THREE.Mesh>(null);
  const strikeMat = useRef<THREE.MeshBasicMaterial>(null);
  const meas = useRef<{ w: number; ls: number } | null>(null);
  const applied = useRef({ ls: -1, t: 0 });
  const strikeKey = useRef('');
  const shift = useRef(0); // px the name has stepped across its land, clear of its capital
  const giveWay = useRef(1); // a region name fades to 0 under a nation name
  const cap = useMemo(() => (data.cap ? new THREE.Vector3(...data.cap) : null), [data.cap]);
  useEffect(() => () => { nationBoxes.delete(data.key); }, [data.key]);

  const n = Math.max(1, data.name.length);
  const dir = useMemo(() => new THREE.Vector3(...data.dir), [data.dir]);
  const anchor = useRef({ goal: new THREE.Vector3(...data.dir), cur: new THREE.Vector3(...data.dir), share: 1, t: -1e9 });
  const axis = useMemo(() => new THREE.Vector3(...data.axis), [data.axis]);
  const minor = useMemo(() => new THREE.Vector3(...data.minor), [data.minor]);
  const tmp = useMemo(() => ({ right: new THREE.Vector3(), up: new THREE.Vector3(), pos: new THREE.Vector3(), ndc: new THREE.Vector3() }), []);

  const flagKey = data.key + JSON.stringify(data.flag);
  const texture = useMemo(() => {
    const svg = flagSvg(data.flag, 90, 60);
    const t = new THREE.TextureLoader().load('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [flagKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => () => strike.current?.geometry.dispose(), []);

  useFrame(({ camera, size }) => {
    const g = groupRef.current;
    const inner = innerRef.current;
    if (!g || !inner) return;
    const d = camera.position.length();
    // Re-anchor on the land in view (throttled), and glide there so the name never jumps.
    const an = anchor.current;
    const nowA = performance.now();
    if (nowA - an.t > ANCHOR_EVERY) {
      an.t = nowA;
      an.share = visibleAnchor(data.pts, camera.position, an.goal);
      if (an.share <= 0) an.goal.copy(dir);
    }
    if (an.cur.dot(an.goal) < 0.2) an.cur.copy(an.goal); // a fresh view: snap
    else an.cur.lerp(an.goal, 0.15).normalize();
    let alpha = data.kind === 'nation'
      ? clamp01((d - FADE_NEAR) / (FADE_FAR - FADE_NEAR))
      : clamp01((CLOSE - d) / 0.2);
    // Far-side hiding: fade out well before the limb so a name never shows through the planet.
    const facing = camera.position.dot(an.cur) / d;
    alpha *= clamp01((facing - 0.25) / 0.15);
    // Only a sliver of the land in view: let the name go (it would sit on a few tiles at the limb).
    alpha *= clamp01((an.share - 0.08) / 0.1);
    // Ground view: names laid flat on the land would cut across the buildings; let them go.
    alpha *= 1 - groundView.tilt;
    const deleted = statusOf(data.owner) === 'deleted';
    if (deleted) alpha *= 0.5;
    g.visible = alpha > 0.01;
    if (!g.visible) { nationBoxes.delete(data.key); return; }

    // Lift above the tallest terrain plus a margin that grows as the camera pulls back.
    const R = TOP + 0.004 + 0.008 * Math.max(0, d - 1);
    tmp.pos.copy(an.cur).multiplyScalar(R);
    g.position.copy(tmp.pos);

    // The nation's axis in the screen plane.
    const e = camera.matrixWorld.elements;
    tmp.right.set(e[0]!, e[1]!, e[2]!);
    tmp.up.set(e[4]!, e[5]!, e[6]!);
    const dx = axis.dot(tmp.right) * data.major;
    const dy = axis.dot(tmp.up) * data.major;
    const L = Math.hypot(dx, dy);
    const across = Math.hypot(minor.dot(tmp.right), minor.dot(tmp.up)) * data.across;
    let angle = 0;
    if (data.elongated) {
      angle = Math.atan2(dy, dx);
      if (angle > Math.PI / 2) angle -= Math.PI; // keep it upright
      else if (angle < -Math.PI / 2) angle += Math.PI;
      angle = clamp(angle, -MAX_ANGLE, MAX_ANGLE);
    }

    // Room: never past the limb of the visible disc, never under the side panels.
    const dist = camera.position.distanceTo(tmp.pos);
    const ux = Math.cos(angle), uy = Math.sin(angle);
    const px = tmp.pos.dot(tmp.right), py = tmp.pos.dot(tmp.up);
    const disc = (LIMB * (dist / d)) / Math.sqrt(Math.max(1e-3, 1 - 1 / (d * d))); // disc radius at the label's depth
    const pu = px * ux + py * uy;
    const limbHalf = Math.max(0, -Math.abs(pu) + Math.sqrt(Math.max(0, pu * pu + disc * disc - (px * px + py * py))));
    const fov = ((camera as THREE.PerspectiveCamera).fov ?? 45) * (Math.PI / 180);
    const wpp = (2 * dist * Math.tan(fov / 2)) / Math.max(1, size.height); // world units per pixel
    tmp.ndc.copy(tmp.pos).project(camera);
    const sx = ((tmp.ndc.x + 1) / 2) * size.width, sy = ((tmp.ndc.y + 1) / 2) * size.height; // px, y up
    const fb = freeBand(size.width);
    const roomPx = Math.min(sx - fb.left, fb.right - sx);
    const panelHalf = Math.abs(ux) > 0.05 ? (Math.max(0, roomPx) * wpp) / Math.abs(ux) : Infinity;
    const halfMax = Math.min(limbHalf, panelHalf);

    // Size: span SPAN of the projected length, within the room, pixel limits and the nation's thickness.
    const lim = SIZES[data.kind];
    const m = meas.current;
    const w0 = m ? Math.max(0.3 * n, m.w - m.ls * n) : 0.72 * n; // width in em with no spacing
    const W = Math.min(SPAN * L, 2 * halfMax);
    let f = W / (w0 + LS_BASE * n);
    f = Math.min(f, Math.max(0.55 * across, lim.min * wpp), lim.max * wpp);
    f = Math.max(f, lim.min * wpp);
    const showFlag = d < FLAG_NEAR;
    // Too little room at the usual minimum (far zoom, at the limb, beside a panel): tighten the
    // spacing and shrink the name to fit, down to TINY px, before fading it.
    const fit = (2 * halfMax) / (w0 + LS_MIN * n + (showFlag ? 3.2 : 0));
    if (f > fit) f = Math.max(fit, TINY * wpp);
    const lsWanted = clamp((W / f - w0) / n, LS_MIN, LS_MAX);
    const ls = Math.round(lsWanted / 0.05) * 0.05;
    const need = (f * (w0 + ls * n)) / 2 + (showFlag ? 1.6 * f : 0);
    alpha *= clamp01((1.25 - need / Math.max(1e-6, halfMax)) / 0.25);
    alpha *= clamp01(0.8 + (f / wpp - TINY) / 8); // a tiny name dims a little, never vanishes for size alone
    if (roomPx < 0) alpha = 0;
    const halfPx = (f * (w0 + ls * n)) / 2 / wpp, thickPx = (0.6 * f) / wpp;
    if (data.kind === 'region') {
      // a region name gives way to a nation name: it fades where their boxes cross
      const me = { x: sx, y: sy, hw: halfPx, hh: thickPx, c: ux, s: uy };
      let under = false;
      for (const b of nationBoxes.values()) if (boxesCross(me, b)) { under = true; break; }
      giveWay.current += ((under ? 0 : 1) - giveWay.current) * 0.2;
      alpha *= giveWay.current;
    }
    g.visible = alpha > 0.01;
    if (!g.visible) { nationBoxes.delete(data.key); return; }
    if (data.kind === 'nation') {
      // Step across the land, clear of the nation's own capital marker, when the land is thick enough.
      let want = 0;
      if (cap && camera.position.dot(cap) / d > 0.3) {
        tmp.ndc.copy(cap).project(camera);
        const cx = ((tmp.ndc.x + 1) / 2) * size.width - sx, cy = ((tmp.ndc.y + 1) / 2) * size.height + CAP_UP - sy;
        const along = cx * ux + cy * uy, perp = -cx * uy + cy * ux;
        const reach = thickPx + CAP_R;
        if (Math.abs(along) < halfPx + CAP_R && Math.abs(perp) < reach) {
          const room = (0.5 * across - 0.6 * f) / wpp; // px the name can move and stay on its land
          const away = perp > 0 ? -1 : 1;
          if (reach - Math.abs(perp) <= room) want = away * (reach - Math.abs(perp));
          else if (reach + Math.abs(perp) <= room) want = -away * (reach + Math.abs(perp));
        }
      }
      shift.current = Math.abs(want - shift.current) < 0.5 ? want : shift.current + (want - shift.current) * 0.12;
      const sh = shift.current;
      if (sh !== 0) {
        tmp.pos.addScaledVector(tmp.right, -uy * sh * wpp).addScaledVector(tmp.up, ux * sh * wpp).setLength(R);
        g.position.copy(tmp.pos);
      }
      if (alpha > 0.15) nationBoxes.set(data.key, { x: sx - uy * sh, y: sy + ux * sh, hw: halfPx + (showFlag ? (1.6 * f) / wpp : 0), hh: thickPx, c: ux, s: uy });
      else nationBoxes.delete(data.key);
    }

    inner.rotation.z = angle;
    inner.scale.setScalar(f);

    const t = textRef.current;
    const now = performance.now();
    if (t && ls !== applied.current.ls && (applied.current.ls < 0 || now - applied.current.t > 300)) {
      applied.current = { ls, t: now };
      t.letterSpacing = ls;
      t.sync();
    }
    // Bend the name around the globe: a convex cylinder of the label's radius (in text units).
    const r = R / f;
    if (t) {
      t.curveRadius = -r;
      t.fillOpacity = alpha; // warm parchment fill with a dark engraved edge: reads on light and dark land
      t.outlineOpacity = alpha * 0.85; // soft ink halo
      t.strokeOpacity = alpha;
    }

    const textW = m ? m.w + (applied.current.ls - m.ls) * n : w0 + ls * n;
    const fl = flagRef.current;
    if (fl) {
      fl.visible = showFlag;
      if (showFlag) {
        const x = -textW / 2 - 0.35 - 0.6; // flag 1.2 x 0.8 em, a small gap before the name
        const a = x / r;
        fl.position.set(r * Math.sin(a), 0, -r * (1 - Math.cos(a)));
        fl.rotation.set(0, a, 0);
      }
    }
    if (flagMat.current) flagMat.current.opacity = alpha * clamp01((FLAG_NEAR - d) / 0.2);

    const s = strike.current;
    if (s) {
      s.visible = deleted;
      if (deleted) {
        const half = Math.min(Math.PI * 0.9, (textW / 2 + 0.15) / r);
        const key = `${r.toPrecision(2)}:${half.toPrecision(2)}`;
        if (key !== strikeKey.current) {
          strikeKey.current = key;
          s.geometry.dispose();
          s.geometry = new THREE.CylinderGeometry(r, r, 0.08, 24, 1, true, -half, 2 * half);
        }
        s.position.set(0, 0, -r);
        if (strikeMat.current) strikeMat.current.opacity = 0.75 * alpha;
      }
    }
  });

  return (
    <group ref={groupRef} renderOrder={RENDER_ORDER}>
      <Billboard follow>
        <group ref={innerRef}>
          <mesh ref={flagRef} renderOrder={RENDER_ORDER} visible={false}>
            <planeGeometry args={[1.2, 0.8]} />
            <meshBasicMaterial ref={flagMat} map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <Text
            ref={textRef}
            font={font}
            anchorX="center"
            anchorY="middle"
            fontSize={1}
            color={ENGRAVE_FILL}
            outlineWidth="9%"
            outlineBlur="14%"
            outlineColor={HALO}
            strokeWidth="2.5%"
            strokeColor={ENGRAVE_EDGE}
            renderOrder={RENDER_ORDER}
            onSync={(t: any) => {
              const b = t.textRenderInfo?.blockBounds;
              if (b) meas.current = { w: b[2] - b[0], ls: t.letterSpacing ?? 0 };
            }}
          >
            {data.name.toUpperCase()}
            <meshBasicMaterial transparent depthTest={false} depthWrite={false} toneMapped={false} />
          </Text>
          <mesh ref={strike} visible={false} renderOrder={RENDER_ORDER + 1}>
            <planeGeometry args={[0.01, 0.01]} />
            <meshBasicMaterial ref={strikeMat} color={INK} transparent opacity={0.75} depthTest={false} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </Billboard>
    </group>
  );
}

function unit(c: [number, number, number]): [number, number, number] {
  const len = Math.hypot(c[0], c[1], c[2]) || 1;
  return [c[0] / len, c[1] / len, c[2] / len];
}

function centres(world: { tiles: { center: [number, number, number] }[] }, tiles: number[]): Float32Array {
  const out = new Float32Array(tiles.length * 3);
  tiles.forEach((t, i) => {
    const c = unit(world.tiles[t]!.center);
    out[3 * i] = c[0]; out[3 * i + 1] = c[1]; out[3 * i + 2] = c[2];
  });
  return out;
}

export function NationLabels() {
  const mesh = useProvinceMesh();
  const font = useSyncExternalStore(subscribeFont, labelFont);
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
        const body = mainBody(world, tiles);
        const centre = mesh.centroidOf(body);
        const cap = c.capitalTile != null && world.tiles[c.capitalTile] && world.owner[c.capitalTile] === id ? capitalPoint(mesh, world, id) ?? undefined : undefined;
        out.push({ key: `n${id}`, name: c.name, kind: 'nation', owner: id, dir: unit(centre), pts: centres(world, body), flag: c.flag, cap, ...labelAxis(world, body, centre) });
      }
      for (const r of world.regions) {
        if (!r.name || r.tiles.length === 0) continue;
        const owner = regionOwner(world, r.id);
        const oc = owner >= 0 ? world.countries[owner] : undefined;
        if (!oc || oc.alive === false) continue;
        const centre = mesh.centroidOf(r.tiles);
        out.push({ key: `r${r.id}`, name: r.name, kind: 'region', owner, dir: unit(centre), pts: centres(world, r.tiles), flag: r.flag, ...labelAxis(world, r.tiles, centre) });
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
        <FlagLabel key={l.key} data={l} font={font} />
      ))}
    </>
  );
}
