import { useCallback, useEffect, useState } from 'react';
import { useWorld } from '../../state/world';

export interface CountryLore {
  countryId: number;
  asOfTick: number;
  summary: string;
  culture: string;
  politics: string;
  history: string;
  anthemLyrics: string[];
  relations: { with: number; stance: string; story: string }[];
}

export interface RegionLore { regionId: number; name: string; owner: number; summary: string; history: string }

export interface LoreState<T> { lore: T | null; loading: boolean; error: boolean; retry: () => void }

const countryCache = new Map<number, CountryLore>();
const regionCache = new Map<number, RegionLore>();

/** Generic cached fetch: shows the cached value at once, refetches when stale, aborts on change. */
function useCachedLore<T extends { asOfTick?: number }>(
  id: number | null,
  url: (id: number) => string,
  cache: Map<number, T>,
  refetchAfter: number,
): LoreState<T> {
  const tick = useWorld((s) => s.world?.tick ?? 0);
  const [lore, setLore] = useState<T | null>(id != null ? cache.get(id) ?? null : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (id == null) return;
    const cached = cache.get(id) ?? null;
    setLore(cached);
    setError(false);
    const stale = cached != null && cached.asOfTick != null && tick - cached.asOfTick > refetchAfter;
    if (cached && !stale && nonce === 0) { setLoading(false); return; }
    const ctl = new AbortController();
    setLoading(true);
    fetch(url(id), { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((l: T) => { cache.set(id, l); setLore(l); setLoading(false); })
      .catch((err) => {
        if (ctl.signal.aborted || (err && err.name === 'AbortError')) return;
        setLoading(false);
        if (!cached) setError(true);
      });
    return () => ctl.abort();
    // tick is read on purpose only when the id changes or on retry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { lore, loading: loading && !lore, error: error && !lore, retry };
}

export function useLore(countryId: number): LoreState<CountryLore> {
  return useCachedLore<CountryLore>(countryId, (id) => `/api/country/${id}/lore`, countryCache, 60);
}

export function useRegionLore(regionId: number): LoreState<RegionLore> {
  return useCachedLore<RegionLore & { asOfTick?: number }>(regionId, (id) => `/api/region/${id}/lore`, regionCache as Map<number, RegionLore & { asOfTick?: number }>, Infinity);
}
