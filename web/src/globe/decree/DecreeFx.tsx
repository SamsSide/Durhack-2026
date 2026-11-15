// The caption is the effect's name only: the result sentence is already on the feed card and beside the
// decree box, and four copies of it at once was noise. A plague or a famine then leaves a lasting mark
// on the provinces struck (see LINGER in effects.ts).
// Decrees you can see (#288, "show, don't tell"). When a decree's own chronicle line arrives with its
// outcome (`entry.decree`: effect, severity, target tiles, result), the camera flies to the target
// (unless the user is dragging), the effect plays over the provinces hit for about 5 to 6 s, and a
// parchment caption with the result hangs by the target for 5 s. Two slots: a third decree takes the
// oldest slot. Pooled: three Points draw calls and a few meshes per slot, all hidden when idle.
// Dev only: window.__decreeDemo(effect?) plays one on the nation nearest the middle of the view. Lane b.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { DecreeEffect, DecreeOutcome, World } from '@terra/shared';
import { useWorld } from '../../state/world';
import { useProvinceMesh } from '../mesh/context';
import { useEventStream } from '../status/useEventStream';
import { Anchor } from '../status/Anchor';
import { STACK } from '../status/cityStack';
import type { P3 } from '../status/geo';
import { flyControlsTo, focusTile } from '../events/focus';
import type { CameraControls as CameraControlsImpl } from '@react-three/drei';
import { ParticlePool } from '../war/particles';
import { GlyphPool } from './glyphs';
import { DecreeSlot, VISIBLE } from './effects';
import type { Pools, Visible } from './effects';
import './decree.css';

const SLOTS = 2;
const CAPTION_MS = 5000;
const FLY_MS = 1100;           // the camera settles in about 1.2 s; the show starts as it arrives

const LABEL: Record<DecreeEffect, string> = {
  meteor: 'Meteor', plague: 'Plague', famine: 'Famine', storm: 'Storm', flood: 'Flood',
  prophet: 'Prophet', goldrush: 'Gold rush', rebellion: 'Rebellion', none: 'Decree',
};

interface Caption { key: string; slot: number; tile: number; pos: P3; label: string; effect: DecreeEffect; text: string }
interface Controls { currentAction?: number }
const _size = new THREE.Vector2();
const _c = new THREE.Vector3();

/** The tile the show centres on: the capital for the nation-wide effects when it is hit, else the first tile. */
function centreFirst(world: World, d: DecreeOutcome): number[] {
  const tiles = d.target.tiles.filter((t) => world.tiles[t]);
  const cap = d.target.countryId != null ? world.countries[d.target.countryId]?.capitalTile : undefined;
  const capitalLed = d.effect === 'prophet' || d.effect === 'plague' || d.effect === 'famine' || d.effect === 'goldrush' || d.effect === 'rebellion';
  if (cap != null && world.tiles[cap] && capitalLed) {
    if (d.effect === 'prophet') return [cap, ...tiles.filter((t) => t !== cap)];
    const i = tiles.indexOf(cap);
    if (i > 0) return [cap, ...tiles.filter((t) => t !== cap)];
  }
  if (!tiles.length && cap != null && world.tiles[cap]) return [cap];
  return tiles;
}

/** The demo's stand-in for a server result line. */
function demoResult(effect: Visible, name: string, n: number): string {
  switch (effect) {
    case 'meteor': return `Meteor strikes the capital of ${name}: ${n} provinces scorched`;
    case 'plague': return `Plague in ${name}: 41,200 dead`;
    case 'famine': return `Famine in ${name}: 12,800 starve, the treasury loses 340`;
    case 'storm': return `Storm over ${name}: 2 settlements wrecked, 1,150 dead`;
    case 'flood': return `Flood in ${name}: ${n} provinces under water, 3,400 drowned`;
    case 'prophet': return `A prophet rises in ${name}: the faithful gather`;
    case 'goldrush': return `Gold rush in ${name}: the treasury gains 900`;
    case 'rebellion': return `Rebellion in ${name}: ${n} provinces rise against the crown`;
  }
}

export function DecreeFx() {
  const mesh = useProvinceMesh();
  const controls = useThree((s) => s.controls) as Controls | null;
  const camera = useThree((s) => s.camera);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const seq = useRef(0);
  const nextSlot = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const fx = useMemo(() => {
    const pools: Pools = {
      fire: new ParticlePool(512, true, 1.6, 27),
      smoke: new ParticlePool(640, false, 0.9, 25),
      glyphs: new GlyphPool(160, 30),
    };
    const slots = Array.from({ length: SLOTS }, (_, i) => new DecreeSlot(100 + i));
    const group = new THREE.Group();
    group.add(pools.smoke.points, pools.fire.points, pools.glyphs.points);
    for (const s of slots) group.add(s.group);
    return { pools, slots, group };
  }, []);
  useEffect(() => () => {
    fx.pools.fire.dispose(); fx.pools.smoke.dispose(); fx.pools.glyphs.dispose();
    for (const s of fx.slots) s.dispose();
  }, [fx]);
  useEffect(() => () => { for (const t of timers.current) clearTimeout(t); }, []);
  useEffect(() => { for (const s of fx.slots) s.stop(fx.pools); setCaptions([]); }, [mesh, fx]);

  const play = (d: DecreeOutcome): void => {
    const world = useWorld.getState().world;
    if (!world || !mesh) return;
    const tiles = centreFirst(world, d);
    const now = performance.now();
    const first = tiles[0];
    // fly there, unless the user has the globe in hand
    const dragging = (controls?.currentAction ?? 0) !== 0;
    if (first != null && !dragging) {
      focusTile(first, 'user'); // pauses the spotlight tour and arms the rig's smoothing reset
      // then pull back far enough to see the provinces hit, not just the first one
      const c0 = world.tiles[first]!.center;
      const l0 = Math.hypot(...c0) || 1;
      let spread = 0;
      for (const t of tiles) {
        const c = world.tiles[t]!.center, l = Math.hypot(...c) || 1;
        spread = Math.max(spread, Math.hypot(c[0] / l - c0[0] / l0, c[1] / l - c0[1] / l0, c[2] / l - c0[2] / l0));
      }
      if (controls) flyControlsTo(controls as unknown as CameraControlsImpl, c0, Math.min(2.4, 1.75 + spread * 1.6));
    }
    const delay = first != null && !dragging ? FLY_MS : 120;
    let slot = -1;
    if (d.effect !== 'none' && tiles.length) {
      slot = fx.slots.findIndex((s) => !s.active);
      if (slot < 0) slot = fx.slots.findIndex((s) => s.lingering);   // a lasting mark gives way to a new decree
      if (slot < 0) { slot = nextSlot.current; nextSlot.current = (slot + 1) % SLOTS; }
      if (!fx.slots[slot]!.play(fx.pools, mesh, world, { effect: d.effect, severity: d.severity, tiles }, now, delay)) slot = -1;
    }
    if (first == null || !d.result) return;
    const t = world.tiles[first]!;
    const len = Math.hypot(...t.center) || 1;
    const k = (slot >= 0 ? fx.slots[slot]!.centre.length() : 1.02) / len + 0.01;
    const cap: Caption = {
      key: `d${++seq.current}`, slot, tile: first, pos: [t.center[0] * k, t.center[1] * k, t.center[2] * k],
      label: LABEL[d.effect], effect: d.effect, text: d.result,
    };
    const show = setTimeout(() => {
      timers.current.delete(show);
      // one caption per slot, and never more than two
      setCaptions((cur) => [...cur.filter((c) => c.slot < 0 || c.slot !== cap.slot)].slice(-(SLOTS - 1)).concat(cap));
      const hide = setTimeout(() => {
        timers.current.delete(hide);
        setCaptions((cur) => cur.filter((c) => c.key !== cap.key));
      }, CAPTION_MS);
      timers.current.add(hide);
    }, Math.max(0, delay - 200));
    timers.current.add(show);
  };
  const playRef = useRef(play);
  playRef.current = play;

  useEventStream((events) => {
    for (const e of events) {
      if (e.type !== 'chronicle' || e.entry.kind !== 'decree' || !e.entry.decree) continue;
      playRef.current(e.entry.decree);
    }
  });

  // Dev only: __decreeDemo(effect?) plays one on the nation whose capital is nearest the middle of the view.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const win = window as unknown as { __decreeDemo?: (effect?: DecreeEffect, severity?: number) => string };
    win.__decreeDemo = (effect, severity = 0.5) => {
      const w = useWorld.getState().world;
      if (!w) return 'no world';
      const eff: Visible = effect && effect !== 'none' ? effect : VISIBLE[Math.floor(Math.random() * VISIBLE.length)]!;
      _c.copy(camera.position).normalize();
      let best = -1, bestDot = -2;
      for (const c of w.countries) {
        const t = c.alive ? w.tiles[c.capitalTile] : undefined;
        if (!t) continue;
        const dot = (t.center[0] * _c.x + t.center[1] * _c.y + t.center[2] * _c.z) / (Math.hypot(...t.center) || 1);
        if (dot > bestDot) { bestDot = dot; best = c.id; }
      }
      const country = w.countries[best];
      if (!country) return 'no nation';
      // the capital and its nearest provinces, breadth first, more with the severity
      const size = 3 + Math.round(severity * 14);
      const tiles = [country.capitalTile];
      const seen = new Set(tiles);
      for (let i = 0; i < tiles.length && tiles.length < size; i++) {
        for (const x of w.tiles[tiles[i]!]!.neighbors) {
          if (tiles.length >= size) break;
          if (seen.has(x) || w.owner[x] !== country.id) continue;
          seen.add(x); tiles.push(x);
        }
      }
      playRef.current({ effect: eff, severity, target: { countryId: country.id, tiles }, result: demoResult(eff, country.name, tiles.length) });
      return `${eff} on ${country.name}`;
    };
    return () => { delete win.__decreeDemo; };
  }, [camera]);

  useFrame(({ gl, camera: cam }) => {
    const now = performance.now();
    const year = useWorld.getState().world?.year ?? 0;
    for (const s of fx.slots) s.tick(fx.pools, now, year);
    gl.getDrawingBufferSize(_size);
    const px = _size.y * 0.5 * cam.projectionMatrix.elements[5]!;
    fx.pools.fire.update(now, px);
    fx.pools.smoke.update(now, px);
    fx.pools.glyphs.update(now, px);
  });

  return (
    <>
      <primitive object={fx.group} />
      {captions.map((c) => (
        <Anchor key={c.key} pos={c.pos} stack={{ tile: c.tile, priority: STACK.decree }}>
          <div className={`dc-plate dc-${c.effect}`} style={{ animationDuration: `${CAPTION_MS}ms` }}>
            <div className="tn-sheet dc-paper">
              <span className="dc-label">{c.label}</span>
            </div>
          </div>
        </Anchor>
      ))}
    </>
  );
}
