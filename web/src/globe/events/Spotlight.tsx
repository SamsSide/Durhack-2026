// Spotlight tour, the demo director: while on (key S, or window event 'terra:spotlight' with
// { detail: { on } }), fly to each new big event in turn, hold ~4 s with a caption, and drift in
// a slow orbit after 20 s with nothing new. Dragging or zooming pauses it for 10 s. Lane b.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { CameraControls as CameraControlsImpl } from '@react-three/drei';
import { mountCaption } from './caption';
import type { CaptionUi } from './caption';
import { focusTile, onFocusTile } from './focus';
import { KIND_META } from './kinds';
import type { Story } from './kinds';
import { onStory, recentStories } from './store';

const HOLD_MS = 5200;        // ~1.2 s flight + ~4 s on the spot
const IDLE_MS = 20000;
const PAUSE_MS = 10000;
const STALE_MS = 45000;      // a story this old is no longer news
const ORBIT_SPEED = 0.05;    // radians per second
const MAX_QUEUE = 12;

function better(a: Story, b: Story): boolean {
  const pa = KIND_META[a.kind].priority, pb = KIND_META[b.kind].priority;
  return pa !== pb ? pa > pb : a.at > b.at;
}

export function Spotlight() {
  const controls = useThree((s) => s.controls) as unknown as CameraControlsImpl | null;
  const gl = useThree((s) => s.gl);
  const reduced = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const st = useRef({ on: false, queue: [] as Story[], current: null as Story | null, holdEnd: 0, pausedUntil: 0, lastActivity: 0 });
  const ui = useRef<CaptionUi | null>(null);

  // the caption element sits over the canvas
  useEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;
    ui.current = mountCaption(parent);
    ui.current.setOn(st.current.on);
    return () => { ui.current?.destroy(); ui.current = null; };
  }, [gl]);

  // toggles, user input and new stories
  useEffect(() => {
    const s = st.current;
    const setOn = (on: boolean) => {
      if (s.on === on) return;
      s.on = on;
      s.current = null;
      s.holdEnd = 0;
      s.pausedUntil = 0;
      s.lastActivity = performance.now();
      s.queue = on ? recentStories(20000) : [];
      ui.current?.setOn(on);
      window.dispatchEvent(new CustomEvent('terra:spotlight-state', { detail: { on } }));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 's' && e.key !== 'S') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      setOn(!s.on);
    };
    const onToggle = (e: Event) => {
      const on = (e as CustomEvent<{ on?: unknown }>).detail?.on;
      setOn(typeof on === 'boolean' ? on : !s.on);
    };
    const pause = () => {
      if (!s.on) return;
      s.pausedUntil = performance.now() + PAUSE_MS;
      s.lastActivity = s.pausedUntil;
      if (s.current) { s.current = null; ui.current?.hide(); }
    };
    const el = gl.domElement;
    window.addEventListener('keydown', onKey);
    window.addEventListener('terra:spotlight', onToggle);
    el.addEventListener('pointerdown', pause);
    el.addEventListener('wheel', pause, { passive: true });
    const offFocus = onFocusTile((_tile, source) => { if (source === 'user') pause(); });
    const offStory = onStory((story) => {
      if (!s.on) return;
      s.queue.push(story);
      if (s.queue.length > MAX_QUEUE) {
        let worst = 0;
        for (let i = 1; i < s.queue.length; i++) if (better(s.queue[worst]!, s.queue[i]!)) worst = i;
        s.queue.splice(worst, 1);
      }
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('terra:spotlight', onToggle);
      el.removeEventListener('pointerdown', pause);
      el.removeEventListener('wheel', pause);
      offFocus();
      offStory();
    };
  }, [gl]);

  useFrame((_, dt) => {
    const s = st.current;
    if (!s.on) return;
    const now = performance.now();
    if (now < s.pausedUntil) return;
    if (s.current && now < s.holdEnd) return;
    if (s.current) { s.current = null; ui.current?.hide(); }

    s.queue = s.queue.filter((q) => now - q.at < STALE_MS);
    if (s.queue.length) {
      let bi = 0;
      for (let i = 1; i < s.queue.length; i++) if (better(s.queue[i]!, s.queue[bi]!)) bi = i;
      const next = s.queue.splice(bi, 1)[0]!;
      s.current = next;
      s.holdEnd = now + HOLD_MS;
      s.lastActivity = now;
      ui.current?.show(next);
      if (!reduced) focusTile(next.tile, 'tour');
      return;
    }
    if (!reduced && controls && now - s.lastActivity > IDLE_MS) void controls.rotate(ORBIT_SPEED * Math.min(dt, 0.1), 0, false);
  });

  return null;
}
