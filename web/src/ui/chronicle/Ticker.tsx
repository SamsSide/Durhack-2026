import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { flushSync } from 'react-dom';
import type { ChronicleEntry, World } from '@terra/shared';
import { Chevron, Diamond } from './Diamond';
import { displayKind } from './kinds';
import type { DisplayKind } from './kinds';

const SHOWN = 12;        // entries the belt starts with, and the ones it repeats when nothing is new
const SPEED = 40;        // px a second at rest
const MAX_BOOST = 2.8;   // top speed, as a multiple of SPEED, when news is queueing
const BOOST_FROM = 1;    // waiting news items at which the belt starts to speed up
const BOOST_FULL = 6;    // waiting news items at which it reaches MAX_BOOST
const MAX_QUEUE = 8;     // news items allowed to wait off screen; older ones are dropped
const HARD_CAP = 80;     // belt length that is never exceeded, even in a background tab
const REFILL_AHEAD = 60; // px of content left beyond the right edge when the belt repeats an entry
const EASE_SPEED = 0.9;  // seconds, time constant for speeding up and slowing down
const MAX_CATCH_UP = 1.5; // a late frame moves the belt at most this many usual frames
const EASE_PAUSE = 0.3;  // seconds, time constant for stopping on hover and starting again

/** One cell on the belt. `seen` is set by the frame loop once the cell has entered the track. */
interface BeltItem {
  key: string;
  entry: ChronicleEntry;
  news: boolean; // arrived while the ticker was running: jumps the queue and speeds the belt up
  wash: boolean; // gets the gilt wash when it comes into view
  seen: boolean;
}

let serial = 0;
const make = (entry: ChronicleEntry, news: boolean, wash: boolean): BeltItem => (
  { key: `${entry.id}#${serial++}`, entry, news, wash, seen: false }
);

const lastOf = (chron: ChronicleEntry[], n: number): ChronicleEntry[] => chron.slice(Math.max(0, chron.length - n));

/** Never let the belt grow without bound (the frame loop does not run in a background tab). */
const capped = (items: BeltItem[]): BeltItem[] => (
  items.length > HARD_CAP ? [...items.slice(0, HARD_CAP / 2), ...items.slice(-MAX_QUEUE)] : items
);

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

const Cell = memo(function Cell({ entry, kind, pick }: {
  entry: ChronicleEntry;
  kind: DisplayKind;
  pick: MutableRefObject<(ids: number[]) => void>;
}) {
  return (
    <span className="tn-t-cell">
      <button
        type="button"
        className="tn-t-item"
        disabled={entry.countries.length === 0}
        onClick={() => pick.current(entry.countries)}
        title={entry.text}
      >
        <Diamond kind={kind} />
        <span className="tn-yr">Y{entry.year}</span>
        <span className="tn-t-txt">{entry.text}</span>
      </button>
      <span className="tn-t-sep" />
    </span>
  );
});

/**
 * The collapsed chronicle: a news ticker. Entries sit on a belt in the order they happened and
 * scroll left at a steady speed; new ones join at the right-hand end. The offset only ever moves
 * with time: a cell that has left the track is removed and its width taken off the offset in the
 * same frame, so nothing on screen shifts.
 */
export function Ticker({ world, open, onToggle, onPick }: {
  world: World;
  open: boolean;
  onToggle: () => void;
  onPick: (ids: number[]) => void;
}) {
  const chron = world.chronicle;
  const len = chron.length;
  const newestId = chron[len - 1]?.id ?? null;
  const reduced = useReducedMotion();

  const [items, setItems] = useState<BeltItem[]>(() => lastOf(chron, SHOWN).map((e) => make(e, false, false)));
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const chronRef = useRef(chron);
  chronRef.current = chron;
  const pick = useRef(onPick);
  pick.current = onPick;

  const trackRef = useRef<HTMLDivElement>(null);
  const beltRef = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const speed = useRef(0);
  const hovered = useRef(false);
  const focused = useRef(false);
  const lastId = useRef<string | null>(newestId);
  const repeatAt = useRef(0); // which of the last SHOWN entries is repeated next
  const dirty = useRef(true); // the belt changed: the waiting queue needs a look

  // New chronicle entries join at the end of the belt. The offset is never touched here.
  useEffect(() => {
    if (newestId === lastId.current) return;
    const prev = lastId.current;
    lastId.current = newestId;
    if (newestId == null) { setItems([]); return; }
    let i = len - 1;
    while (i >= 0 && chron[i]!.id !== prev) i--;
    // Not found: the first entries, or another stretch of history (a time scrub, a new world).
    const added = i >= 0 || prev == null
      ? chron.slice(Math.max(i + 1, len - SHOWN)).map((e) => make(e, true, true))
      : lastOf(chron, MAX_QUEUE).map((e) => make(e, true, false));
    repeatAt.current = 0;
    setItems((cur) => capped([...cur, ...added]));
  }, [newestId, len]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => { dirty.current = true; }, [items]);

  // The scroll: one frame loop that owns the offset, the speed and what is on the belt.
  useEffect(() => {
    if (reduced) return;
    offset.current = 0;
    speed.current = 0;
    for (const it of itemsRef.current) it.seen = false;
    let raf = 0;
    let last = performance.now();
    let frame = 1 / 60; // the usual frame time, smoothed
    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      // A long frame (the globe is busy) moves the belt a little further, never a visible lurch.
      const raw = Math.min(0.1, Math.max(0, (t - last) / 1000));
      last = t;
      const dt = Math.min(raw, frame * MAX_CATCH_UP);
      frame += (raw - frame) * 0.05;
      const track = trackRef.current;
      const belt = beltRef.current;
      if (!track || !belt || belt.children.length === 0) { offset.current = 0; return; }
      const trackRight = track.getBoundingClientRect().right;
      const trackW = track.clientWidth;

      // 1. Cells that have come into view: mark them, and give news its gilt wash.
      let list = itemsRef.current;
      let unseen = list.length;
      while (unseen > 0 && !list[unseen - 1]!.seen) unseen--;
      while (unseen < list.length) {
        const cell = belt.children[unseen] as HTMLElement | undefined;
        if (!cell || cell.getBoundingClientRect().left >= trackRight) break;
        const it = list[unseen]!;
        it.seen = true;
        // Set on the node, not through React: the class must not change the cell's width or key.
        if (it.wash) cell.firstElementChild?.classList.add('tn-t-new');
        unseen++;
      }

      // 2. The waiting queue (everything not yet in view). News goes ahead of repeats and of old
      //    entries, and only the newest MAX_QUEUE wait. All of it is off screen, so nothing shifts.
      let waiting = 0;
      for (let i = unseen; i < list.length; i++) if (list[i]!.news) waiting++;
      if (dirty.current) {
        dirty.current = false;
        if (waiting > 0 && (waiting < list.length - unseen || waiting > MAX_QUEUE)) {
          let skip = waiting - MAX_QUEUE;
          const drop = new Set<string>();
          for (let i = unseen; i < list.length; i++) {
            const it = list[i]!;
            if (!it.news || skip-- > 0) drop.add(it.key);
          }
          flushSync(() => setItems((cur) => cur.filter((it) => !drop.has(it.key))));
          list = itemsRef.current;
          waiting = Math.min(waiting, MAX_QUEUE);
        }
      }

      // 3. Speed: eased towards rest, a stop (hover, focus, a belt that fits) or a catch-up pace.
      const beltW = belt.offsetWidth;
      const flowing = offset.current > 0.5 || beltW > trackW;
      const boost = Math.min(1, Math.max(0, (waiting - BOOST_FROM) / (BOOST_FULL - BOOST_FROM)));
      const stopped = hovered.current || focused.current || !flowing;
      const target = stopped ? 0 : SPEED * (1 + boost * (MAX_BOOST - 1));
      const tau = stopped || speed.current < SPEED ? EASE_PAUSE : EASE_SPEED;
      speed.current += (target - speed.current) * (1 - Math.exp(-dt / tau));
      if (Math.abs(target - speed.current) < 0.01) speed.current = target;
      offset.current += speed.current * dt;

      // 4. Cells that have left the track on the left: remove them and take exactly the distance
      //    the rest moved off the offset, before this frame is painted.
      let gone = 0;
      let goneW = 0;
      while (gone < belt.children.length - 1) {
        const w = (belt.children[gone] as HTMLElement).getBoundingClientRect().width;
        if (goneW + w > offset.current) break;
        goneW += w;
        gone++;
      }
      if (gone > 0) {
        const anchor = belt.children[gone] as HTMLElement;
        const before = anchor.getBoundingClientRect().left;
        const n = gone;
        flushSync(() => setItems((cur) => cur.slice(n)));
        offset.current = Math.max(0, offset.current - (before - anchor.getBoundingClientRect().left));
      }

      // 5. Nothing new and the belt is about to run dry: repeat the most recent entries, in order.
      if (flowing && belt.offsetWidth - offset.current - trackW < REFILL_AHEAD) {
        const recent = lastOf(chronRef.current, SHOWN);
        const again = recent[repeatAt.current % recent.length];
        repeatAt.current = (repeatAt.current + 1) % recent.length;
        if (again) flushSync(() => setItems((cur) => capped([...cur, make(again, false, false)])));
      }

      belt.style.transform = `translateX(${-offset.current}px)`;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      if (beltRef.current) beltRef.current.style.transform = '';
    };
  }, [reduced]);

  const still = reduced ? lastOf(chron, SHOWN).reverse() : null; // reduced motion: a static list, newest first

  return (
    <div className="tn-ticker tn-lacquer tn-lacquer--bar-floating">
      <span className="tn-t-label tn-cartouche tn-cartouche--inline">Chronicle</span>
      <div
        className="tn-t-track"
        ref={trackRef}
        onMouseEnter={() => { hovered.current = true; }}
        onMouseLeave={() => { hovered.current = false; }}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; }}
      >
        {len === 0 || (!still && items.length === 0) ? (
          <span className="tn-t-empty">Nothing has been written yet.</span>
        ) : (
          <div className="tn-t-belt" ref={beltRef}>
            {still
              ? still.map((e) => <Cell key={e.id} entry={e} kind={displayKind(e, world)} pick={pick} />)
              : items.map((it) => <Cell key={it.key} entry={it.entry} kind={displayKind(it.entry, world)} pick={pick} />)}
          </div>
        )}
      </div>
      <button type="button" className="tn-button tn-button--lacquer tn-t-toggle" onClick={onToggle} aria-expanded={open}>
        Timeline <Chevron up={!open} />
      </button>
    </div>
  );
}
