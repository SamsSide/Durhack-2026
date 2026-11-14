import { useEffect, useRef, useState } from 'react';
import type { Country, Stance, World, WorldEvent } from '@terra/shared';
import { useWorld } from '../../state/world';
import { captureGlobe } from '../../globe/capture';

export type FeedKind = 'city' | 'war' | 'treaty' | 'alliance' | 'fall' | 'born' | 'decree' | 'wonder' | 'death' | 'succession';

export interface FeedCard {
  id: string;
  kind: FeedKind;
  title: string;
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
const CITY_WINDOW_MS = 45_000;
const THUMB_EVERY_MS = 3000;
const TW = 144, TH = 81;
const TITLE_MAX = 70;

let lastShot = 0;
let lastThumb: Promise<string | null> = Promise.resolve(null);

/** One globe capture at most every 3 s, downscaled to a small JPEG; null when the globe is not mounted. */
function thumbnail(): Promise<string | null> {
  const now = Date.now();
  if (now - lastShot < THUMB_EVERY_MS) return lastThumb;
  lastShot = now;
  lastThumb = (async () => {
    try {
      const shot = await captureGlobe();
      const img = new Image();
      img.src = `data:${shot.mimeType};base64,${shot.imageBase64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = TW; c.height = TH;
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, TW, TH);
      return c.toDataURL('image/jpeg', 0.7);
    } catch {
      return null;
    }
  })();
  return lastThumb;
}

function short(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= TITLE_MAX ? t : `${t.slice(0, TITLE_MAX - 1).trimEnd()}…`;
}

const pairKey = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;

type Draft = Omit<FeedCard, 'thumb' | 'born' | 'gone' | 'goneAt'>;

/** Turns the store's recent events into picture cards (newest first). */
export function useFeed(): { cards: FeedCard[]; world: World | null } {
  const world = useWorld((s) => s.world);
  const events = useWorld((s) => s.recentEvents);
  const [cards, setCards] = useState<FeedCard[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const worldId = useRef<string | null>(null);
  const primed = useRef(false);
  const stances = useRef<Map<string, Stance>>(new Map());
  const cityAt = useRef<Map<number, number>>(new Map());
  const alive = useRef(true);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    if (!world) {
      worldId.current = null;
      setCards((c) => (c.length ? [] : c));
      return;
    }
    if (worldId.current !== world.id) {
      worldId.current = world.id;
      seen.current = new Set();
      stances.current = new Map();
      cityAt.current = new Map();
      primed.current = false;
      setCards([]);
    }
    const fresh: WorldEvent[] = [];
    for (const e of events) {
      if (seen.current.has(e.id)) continue;
      seen.current.add(e.id);
      if (e.type === 'relation_changed') {
        // Remember the stance either way, so a later treaty knows it ended a war.
        const k = pairKey(e.a, e.b);
        if (primed.current) fresh.push(e); else stances.current.set(k, e.stance);
      } else if (primed.current) fresh.push(e);
    }
    primed.current = true;
    if (fresh.length === 0) return;

    const country = (id: number) => world.countries[id];
    const now = Date.now();
    const drafts: Draft[] = [];
    for (const e of fresh) {
      const id = `${e.id}`;
      if (e.type === 'structure_built' || e.type === 'structure_upgraded') {
        const st = e.type === 'structure_built' ? e.structure : world.structures.find((s) => s.id === e.structureId);
        const kind = e.type === 'structure_built' ? e.structure.kind : e.kind;
        if (!st || (kind !== 'city' && kind !== 'capital')) continue;
        const c = country(st.owner);
        if (!c) continue;
        const last = cityAt.current.get(c.id);
        if (last != null && now - last < CITY_WINDOW_MS) continue;
        cityAt.current.set(c.id, now);
        const region = world.regions.find((r) => r.tiles.includes(st.tile));
        const place = region?.name ? `the city of ${region.name}` : 'a new city';
        drafts.push({ id, kind: 'city', title: short(`${c.name} raises ${place}`), year: world.year, countries: [c], tileId: st.tile });
      } else if (e.type === 'relation_changed') {
        const a = country(e.a), b = country(e.b);
        const k = pairKey(e.a, e.b);
        const prev = stances.current.get(k);
        stances.current.set(k, e.stance);
        if (!a || !b) continue;
        if (e.stance === 'war' && prev !== 'war') {
          drafts.push({ id, kind: 'war', title: short(`War: ${a.name} against ${b.name}`), year: world.year, countries: [a, b], tileId: a.capitalTile });
        } else if (prev === 'war' && (e.stance === 'neutral' || e.stance === 'alliance')) {
          const ally = e.stance === 'alliance';
          drafts.push({ id, kind: ally ? 'alliance' : 'treaty', title: short(`${ally ? 'Alliance' : 'Treaty'}: ${a.name} and ${b.name}`), year: world.year, countries: [a, b] });
        }
      } else if (e.type === 'country_fell') {
        const c = country(e.countryId);
        if (!c) continue;
        drafts.push({ id, kind: 'fall', title: short(`${c.name} falls`), year: world.year, countries: [c], tileId: c.capitalTile });
      } else if (e.type === 'country_founded') {
        const c = country(e.country.id) ?? e.country;
        const parent = c.parent != null ? country(c.parent) : undefined;
        drafts.push({
          id, kind: 'born', year: world.year, tileId: c.capitalTile,
          title: short(parent ? `${c.name} breaks away from ${parent.name}` : `${c.name} is born`),
          countries: parent ? [c, parent] : [c],
        });
      } else if (e.type === 'chronicle') {
        const kind = String(e.entry.kind);
        if (kind !== 'decree' && kind !== 'wonder' && kind !== 'death' && kind !== 'succession') continue;
        const cs = e.entry.countries.map(country).filter((c): c is Country => !!c);
        if (cs.length === 0) continue;
        drafts.push({ id, kind: kind as FeedKind, title: short(e.entry.text), year: e.entry.year, countries: cs.slice(0, 2), tileId: cs[0]!.capitalTile });
      }
    }
    if (drafts.length === 0) return;

    const added: FeedCard[] = drafts.map((d) => ({ ...d, thumb: null, born: now, gone: false, goneAt: 0 }));
    // Oldest first in, so the newest ends on top.
    setCards((prev) => [...added.reverse(), ...prev].slice(0, KEEP_MAX));
    void thumbnail().then((t) => {
      if (!t || !alive.current) return;
      const ids = new Set(added.map((a) => a.id));
      setCards((prev) => prev.map((c) => (ids.has(c.id) && !c.thumb ? { ...c, thumb: t } : c)));
    });
  }, [events, world]);

  // Housekeeping: fade cards after 40 s or when more than five are live, drop the faded.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setCards((prev) => {
        let live = 0;
        let changed = false;
        const next: FeedCard[] = [];
        for (const c of prev) {
          if (c.gone && now - c.goneAt >= FADE_MS) { changed = true; continue; }
          let card = c;
          if (!c.gone) {
            live++;
            if (live > SHOW_MAX || now - c.born >= LIFE_MS) { card = { ...c, gone: true, goneAt: now }; changed = true; }
          }
          next.push(card);
        }
        return changed ? next : prev;
      });
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  return { cards, world };
}
