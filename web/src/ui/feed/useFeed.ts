import { useEffect, useRef, useState } from 'react';
import type { ChronicleEntry, Country, Stance, World, WorldEvent } from '@terra/shared';
import { useWorld } from '../../state/world';
import { captureGlobe } from '../../globe/capture';

/** The coloured label on a card (caps in the UI). */
export type FeedTag = 'WAR' | 'PEACE' | 'FALL' | 'SECESSION' | 'CAPITAL' | 'SILENCE' | 'RETURN' | 'DECREE' | 'WONDER' | 'COUP' | 'TRADE' | 'DECADE';

export interface FeedCard {
  id: string;
  tag: FeedTag;
  title: string;          // one full sentence; the CSS wraps it to two lines and the hover shows all of it
  year: number;
  countries: Country[];   // flags to show, main nation first
  tileId?: number;
  thumb: string | null;
  born: number;           // Date.now() when carded
  gone: boolean;          // fading out; dropped shortly after
  goneAt: number;
}

export const SHOW_MAX = 5;
const KEEP_MAX = 20;
const LIFE_MS = 40_000;
export const FADE_MS = 400;
const PACE_MS = 2000;          // at most one card every 2 s
const STALE_MS = 20_000;       // a waiting candidate older than this is dropped (it stays in the chronicle)
const QUIET_MS = 6000;         // low news is grouped into a decade card only after this much quiet
const WAR_WINDOW_MS = 60_000;  // one war card per pair per minute
const KEY_TTL_MS = 10 * 60_000;
const BIG_PAYMENT = 100;
const THUMB_EVERY_MS = 3000;
const THUMB_SIZE = { width: 288, height: 162 };

let lastShot = 0;
let lastThumb: Promise<string | null> = Promise.resolve(null);

/** One small globe capture at most every 3 s; null when the globe is not mounted. */
function thumbnail(): Promise<string | null> {
  const now = Date.now();
  if (now - lastShot < THUMB_EVERY_MS) return lastThumb;
  lastShot = now;
  lastThumb = captureGlobe(THUMB_SIZE)
    .then((shot) => `data:${shot.mimeType};base64,${shot.imageBase64}`)
    .catch(() => null);
  return lastThumb;
}

type Prio = 3 | 2;   // high, medium
interface Cand {
  key: string;
  prio: Prio;
  at: number;
  fromChronicle: boolean;
  tag: FeedTag;
  title: string;
  year: number;
  countries: Country[];
  tileId?: number;
}
type LowCat = 'rulers' | 'generals' | 'cities' | 'towns';
interface Bucket { decade: number; cat: LowCat; count: number; year: number }

const pairKey = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;
const mid = (n: string) => n.replace(/^The /, 'the ');   // "The Elvet Union" mid-sentence
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

interface DecreeInfo { result?: string; target?: { tiles?: number[] } }
const decreeOf = (e: ChronicleEntry): DecreeInfo | undefined => (e as ChronicleEntry & { decree?: DecreeInfo }).decree;

function lowText(b: Bucket): string {
  const n = b.count;
  switch (b.cat) {
    case 'rulers': return `${n} new ruler${n === 1 ? '' : 's'} this decade`;
    case 'generals': return `${n} general${n === 1 ? '' : 's'} fell this decade`;
    case 'cities': return `${n} ${n === 1 ? 'city' : 'cities'} founded this decade`;
    default: return `${n} ${n === 1 ? 'town' : 'towns'} grew this decade`;
  }
}

/** Turns the store's recent events into a few important cards (newest on top). */
export function useFeed(): { cards: FeedCard[]; world: World | null } {
  const world = useWorld((s) => s.world);
  const events = useWorld((s) => s.recentEvents);
  const [cards, setCards] = useState<FeedCard[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const worldId = useRef<string | null>(null);
  const primed = useRef(false);
  const stances = useRef<Map<string, Stance>>(new Map());
  const queue = useRef<Cand[]>([]);
  const buckets = useRef<Map<string, Bucket>>(new Map());
  const keys = useRef<Map<string, number>>(new Map());   // card key -> expiry, so one event is one card
  const lastCardAt = useRef(0);
  const worldRef = useRef<World | null>(null);
  const alive = useRef(true);
  worldRef.current = world;

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    if (!world) {
      worldId.current = null;
      queue.current = [];
      buckets.current = new Map();
      setCards((c) => (c.length ? [] : c));
      return;
    }
    if (worldId.current !== world.id) {
      worldId.current = world.id;
      seen.current = new Set();
      stances.current = new Map();
      queue.current = [];
      buckets.current = new Map();
      keys.current = new Map();
      lastCardAt.current = 0;
      primed.current = false;
      setCards([]);
    }
    const fresh: WorldEvent[] = [];
    for (const e of events) {
      if (seen.current.has(e.id)) continue;
      seen.current.add(e.id);
      if (e.type === 'relation_changed') {
        // Remember the stance either way, so a later treaty knows it ended a war.
        if (primed.current) fresh.push(e); else stances.current.set(pairKey(e.a, e.b), e.stance);
      } else if (primed.current) fresh.push(e);
    }
    primed.current = true;
    if (fresh.length === 0) return;

    const country = (id: number) => world.countries[id];
    const now = Date.now();
    const decade = Math.floor(world.year / 10);
    const low = (cat: LowCat) => {
      const k = `${decade}:${cat}`;
      const b = buckets.current.get(k) ?? { decade, cat, count: 0, year: world.year };
      b.count++;
      buckets.current.set(k, b);
    };
    const add = (c: Omit<Cand, 'at'>) => {
      if ((keys.current.get(c.key) ?? 0) > now) return;
      const waiting = queue.current.findIndex((q) => q.key === c.key);
      if (waiting >= 0) {
        // The chronicle line is already a full sentence: it replaces a text we built ourselves.
        if (c.fromChronicle && !queue.current[waiting]!.fromChronicle) queue.current[waiting] = { ...c, at: queue.current[waiting]!.at };
        return;
      }
      queue.current.push({ ...c, at: now });
    };
    const flagsOf = (ids: number[]) => ids.map(country).filter((c): c is Country => !!c);

    // Chronicle lines first: their text beats the one we would build from the matching event.
    for (const e of fresh) {
      if (e.type !== 'chronicle') continue;
      const en = e.entry;
      const kind = String(en.kind);
      const cs = flagsOf(en.countries);
      const text = clean(en.text);
      const base = { fromChronicle: true, year: en.year, countries: cs.slice(0, 2), tileId: cs[0]?.capitalTile };
      if (kind === 'fall' && cs[0]) add({ ...base, key: `fall:${cs[0].id}`, prio: 3, tag: 'FALL', title: text });
      else if (kind === 'secession') {
        const c = cs.find((x) => x.parent != null) ?? cs[0];
        if (c) add({ ...base, key: `sec:${c.id}`, prio: 3, tag: 'SECESSION', title: text });
      } else if (kind === 'silence' && cs[0]) add({ ...base, key: `silence:${en.id}`, prio: 3, tag: 'SILENCE', title: text });
      else if (kind === 'return' && cs[0]) add({ ...base, key: `return:${en.id}`, prio: 3, tag: 'RETURN', title: text });
      else if (kind === 'wonder') add({ ...base, key: `wonder:${en.id}`, prio: 3, tag: 'WONDER', title: text });
      else if (kind === 'decree') {
        // One card per decree: the entry carrying a result, or the "-b" consequence entry; never the bare decree text.
        const info = decreeOf(en);
        const line = info?.result || (/-b$/.test(en.id) ? text : '');
        if (!line) continue;
        add({ ...base, key: `decree:${en.id.replace(/-b$/, '')}`, prio: 3, tag: 'DECREE', title: clean(line), tileId: info?.target?.tiles?.[0] ?? base.tileId });
      } else if (kind === 'succession') low('rulers');
      else if (kind === 'death') low('generals');
      else if (kind === 'growth') low('towns');
    }

    for (const e of fresh) {
      if (e.type === 'relation_changed') {
        const a = country(e.a), b = country(e.b);
        const k = pairKey(e.a, e.b);
        const prev = stances.current.get(k);
        stances.current.set(k, e.stance);
        if (!a || !b) continue;
        if (e.stance === 'war' && prev !== 'war') {
          const first = e.actor === e.b ? b : a;
          const second = first === a ? b : a;
          const key = `war:${k}`;
          add({ key, prio: 3, fromChronicle: false, tag: 'WAR', title: `${first.name} declares war on ${mid(second.name)}.`, year: world.year, countries: [first, second], tileId: first.capitalTile });
          if (queue.current.some((q) => q.key === key)) keys.current.set(key, now + WAR_WINDOW_MS);
        } else if (prev === 'war' && (e.stance === 'neutral' || e.stance === 'alliance')) {
          const text = e.stance === 'alliance'
            ? `${a.name} and ${mid(b.name)} seal an alliance after their war.`
            : `${a.name} and ${mid(b.name)} make peace after their war.`;
          add({ key: `peace:${e.id}`, prio: 3, fromChronicle: false, tag: 'PEACE', title: text, year: world.year, countries: [a, b] });
        }
      } else if (e.type === 'country_fell') {
        const c = country(e.countryId);
        if (c) add({ key: `fall:${c.id}`, prio: 3, fromChronicle: false, tag: 'FALL', title: `${c.name} has fallen, its lands lost to its neighbours.`, year: world.year, countries: [c], tileId: c.capitalTile });
      } else if (e.type === 'country_founded') {
        const c = country(e.country.id) ?? e.country;
        const parent = c.parent != null ? country(c.parent) : undefined;
        if (parent) add({ key: `sec:${c.id}`, prio: 3, fromChronicle: false, tag: 'SECESSION', title: `${c.name} breaks away from ${mid(parent.name)} and declares its own rule.`, year: world.year, countries: [c, parent], tileId: c.capitalTile });
      } else if (e.type === 'tile_claimed' && e.cause === 'conquest') {
        const loser = country(e.from), winner = country(e.owner);
        if (loser && winner && loser.capitalTile === e.tile) {
          const place = world.regions.find((r) => r.tiles.includes(e.tile))?.name;
          const title = place
            ? `${place}, capital of ${mid(loser.name)}, falls to ${mid(winner.name)}.`
            : `The capital of ${mid(loser.name)} falls to ${mid(winner.name)}.`;
          add({ key: `cap:${e.tile}:${loser.id}`, prio: 3, fromChronicle: false, tag: 'CAPITAL', title, year: world.year, countries: [winner, loser], tileId: e.tile });
        }
      } else if (e.type === 'council_changed' && e.cause === 'coup') {
        const c = country(e.countryId);
        if (c) {
          const who = e.member?.name;
          const title = who
            ? `A coup in ${mid(c.name)}: ${who} seizes ${e.role === 'ruler' ? 'the throne' : 'command of the army'}.`
            : `A coup shakes ${mid(c.name)}; the ${e.role === 'ruler' ? 'throne' : 'army command'} is vacant.`;
          add({ key: `coup:${e.id}`, prio: 3, fromChronicle: false, tag: 'COUP', title, year: world.year, countries: [c], tileId: c.capitalTile });
        }
      } else if (e.type === 'payment' && (e.reason === 'reparations' || e.reason === 'plunder') && e.amount >= BIG_PAYMENT) {
        const payer = country(e.from), payee = country(e.to);
        if (payer && payee) {
          const amt = `${Math.round(e.amount)} TNC`;
          const title = e.reason === 'plunder'
            ? `${payee.name} plunders ${amt} from ${mid(payer.name)}.`
            : `${payer.name} pays ${amt} in reparations to ${mid(payee.name)}.`;
          add({ key: `pay:${e.id}`, prio: 2, fromChronicle: false, tag: 'TRADE', title, year: world.year, countries: [payer, payee] });
        }
      } else if (e.type === 'structure_built' || e.type === 'structure_upgraded') {
        const kind = e.type === 'structure_built' ? e.structure.kind : e.kind;
        if (kind === 'city' || kind === 'capital') low('cities');
      }
    }
  }, [events, world]);

  // One clock: release at most one card per 2 s, then fade cards after 40 s or when more than five are live.
  useEffect(() => {
    const release = (now: number): FeedCard | null => {
      if (now - lastCardAt.current < PACE_MS) return null;
      const q = queue.current.filter((c) => now - c.at <= STALE_MS);
      queue.current = q;
      if (q.length) {
        let best = q[0]!;
        for (const c of q) if (c.prio > best.prio || (c.prio === best.prio && c.at >= best.at)) best = c;
        queue.current = q.filter((c) => c !== best);
        keys.current.set(best.key, Math.max(keys.current.get(best.key) ?? 0, now + KEY_TTL_MS));
        return { id: `${best.key}@${now}`, tag: best.tag, title: best.title, year: best.year, countries: best.countries, tileId: best.tileId, thumb: null, born: now, gone: false, goneAt: 0 };
      }
      if (now - lastCardAt.current >= QUIET_MS && buckets.current.size > 0) {
        let top: [string, Bucket] | null = null;
        for (const kv of buckets.current) if (!top || kv[1].count > top[1].count) top = kv;
        if (top) {
          buckets.current.delete(top[0]);
          return { id: `low:${top[0]}@${now}`, tag: 'DECADE', title: lowText(top[1]), year: top[1].year, countries: [], thumb: null, born: now, gone: false, goneAt: 0 };
        }
      }
      return null;
    };
    const timer = window.setInterval(() => {
      const now = Date.now();
      for (const [k, t] of keys.current) if (t <= now) keys.current.delete(k);
      const card = worldRef.current ? release(now) : null;
      if (card) {
        lastCardAt.current = now;
        setCards((prev) => [card, ...prev].slice(0, KEEP_MAX));
        void thumbnail().then((t) => {
          if (!t || !alive.current) return;
          setCards((prev) => prev.map((c) => (c.id === card.id && !c.thumb ? { ...c, thumb: t } : c)));
        });
      }
      setCards((prev) => {
        let live = 0;
        let changed = false;
        const next: FeedCard[] = [];
        for (const c of prev) {
          if (c.gone && now - c.goneAt >= FADE_MS) { changed = true; continue; }
          let kept = c;
          if (!c.gone) {
            live++;
            if (live > SHOW_MAX || now - c.born >= LIFE_MS) { kept = { ...c, gone: true, goneAt: now }; changed = true; }
          }
          next.push(kept);
        }
        return changed ? next : prev;
      });
    }, 400);
    return () => window.clearInterval(timer);
  }, []);

  return { cards, world };
}
