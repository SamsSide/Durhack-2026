// "Show, don't tell" (B14): when a ruler decides, a parchment scroll with its proclamation rises over its
// capital for a few seconds, marked AI (a Gemini ruler) or AUTOPILOT. Lane b.
//
// Throttle: at most 3 on screen, one per nation (a newer word replaces the older), none for a capital on
// the far side when it is spoken. A flood (a restore, the top gear) keeps only the newest per nation.
import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import type { ChronicleEntry } from '@terra/shared';
import { useWorld } from '../../state/world';
import { useProvinceMesh } from '../mesh/context';
import { Anchor } from '../status/Anchor';
import { capitalPoint } from '../status/geo';
import { STACK, cityKey } from '../status/cityStack';
import type { P3 } from '../status/geo';
import { useEventStream } from '../status/useEventStream';
import './show.css';

const LIFE_MS = 4600;
const MAX_ON = 3;
const MIN_SHOWN_MS = 1400; // a scroll is not replaced by another nation's before this
const MAX_CHARS = 90;
const FACING = 0.2;        // cosine: skip a capital this close to the limb or past it

interface Scroll { key: string; id: number; tile: number; pos: P3; nation: string; text: string; ai: boolean; born: number }

/** The ruler's own words: the quoted part of `X of Y proclaims: "..."`, else the whole line. */
export function scrollText(entry: ChronicleEntry): string {
  const m = /proclaims:\s*"(.+)"\s*$/.exec(entry.text);
  let t = (m ? m[1]! : entry.text).replace(/\s+/g, ' ').trim();
  if (t.length <= MAX_CHARS) return t;
  // too long: end at the last sentence or clause break that fits, else the last whole word; no ellipsis
  const head = t.slice(0, MAX_CHARS + 1);
  const stop = Math.max(head.lastIndexOf('. '), head.lastIndexOf('; '), head.lastIndexOf(', '));
  t = stop >= 40 ? head.slice(0, stop + 1) : head.slice(0, head.lastIndexOf(' '));
  return t.replace(/[,;:\s]+$/, '');
}

export function RulerScrolls() {
  const mesh = useProvinceMesh();
  const camera = useThree((s) => s.camera);
  const [scrolls, setScrolls] = useState<Scroll[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => { setScrolls([]); }, [mesh]);
  useEffect(() => () => { for (const t of timers.current) clearTimeout(t); }, []);

  useEventStream((events) => {
    const s = useWorld.getState();
    const world = s.world;
    if (!mesh || !world || s.beliefOf != null) return;
    // newest proclamation per speaker in this batch
    const newest = new Map<number, ChronicleEntry>();
    for (const e of events) {
      if (e.type !== 'chronicle' || e.entry.kind !== 'proclamation') continue;
      const id = e.entry.countries[0];
      if (id != null) newest.set(id, e.entry);
    }
    if (newest.size === 0) return;
    const camLen = camera.position.length() || 1;
    const now = performance.now();
    const add: Scroll[] = [];
    for (const [id, entry] of newest) {
      const agent = s.agents.find((a) => a.countryId === id);
      const c = world.countries[id];
      if (!c || agent?.deleted || agent?.link === 'cut') continue; // a cut ruler is not heard
      const pos = capitalPoint(mesh, world, id, 0.006);
      if (!pos) continue;
      const len = Math.hypot(...pos) || 1;
      const facing = (camera.position.x * pos[0] + camera.position.y * pos[1] + camera.position.z * pos[2]) / (camLen * len);
      if (facing < FACING) continue;
      const text = scrollText(entry);
      if (!text) continue;
      add.push({ key: `p${++seq.current}`, id, tile: cityKey(world, id), pos, nation: c.name, text, ai: agent?.ruler === 'llm', born: now });
    }
    if (add.length === 0) return;
    setScrolls((cur) => {
      let out = cur.filter((x) => now - x.born < LIFE_MS);
      for (const sc of add.slice(-MAX_ON)) {
        const same = out.findIndex((x) => x.id === sc.id);
        if (same >= 0) { out.splice(same, 1, sc); continue; }
        if (out.length >= MAX_ON) {
          const oldest = out.reduce((a, b) => (a.born <= b.born ? a : b));
          if (now - oldest.born < MIN_SHOWN_MS) continue; // let the current ones be read
          out = out.filter((x) => x !== oldest);
        }
        out.push(sc);
      }
      return out;
    });
    for (const sc of add) {
      const t = setTimeout(() => {
        timers.current.delete(t);
        setScrolls((cur) => cur.filter((x) => x.key !== sc.key));
      }, LIFE_MS + 100);
      timers.current.add(t);
    }
  });

  return (
    <>
      {scrolls.map((sc) => (
        <Anchor key={sc.key} pos={sc.pos} noClip stack={{ tile: sc.tile, priority: STACK.scroll }}>
          <div className="rs-scroll" style={{ animationDuration: `${LIFE_MS}ms` }}>
            <div className="rs-rod" />
            <div className="tn-sheet rs-paper">
              <div className="rs-head">
                <span className="rs-nation">{sc.nation}</span>
                <span className={sc.ai ? 'rs-tag ai' : 'rs-tag auto'}>{sc.ai ? 'AI' : 'AUTOPILOT'}</span>
              </div>
              <p className="rs-text">{sc.text}</p>
            </div>
            <div className="rs-rod" />
          </div>
        </Anchor>
      ))}
    </>
  );
}
