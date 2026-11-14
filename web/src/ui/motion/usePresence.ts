// Keep something mounted while its exit plays. `open` flips to false, the caller keeps rendering with
// `leaving` true (and the tn-m-out class) for one exit, then `mounted` goes false and it unmounts.
import { useEffect, useState } from 'react';

/** Matches --motion-exit in theme/tokens.css (180 ms), plus a frame so the fade always completes. */
export const EXIT_MS = 200;

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function usePresence(open: boolean, exitMs = EXIT_MS): { mounted: boolean; leaving: boolean } {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) { setMounted(true); return; }
    const t = window.setTimeout(() => setMounted(false), reducedMotion() ? 90 : exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);
  return { mounted: open || mounted, leaving: !open && mounted };
}
