import { useEffect, useState } from 'react';
import { useWorld } from '../state/world';

// GET /api/economy answers 503 with SOLANA_MODE=off: then the economy panels stay hidden.
// Checked once on load and again when the world changes.
export function useEconomyOn(): boolean {
  const worldId = useWorld((s) => s.world?.id);
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    fetch('/api/economy').then((r) => { if (live) setOn(r.ok); }).catch(() => { if (live) setOn(false); });
    return () => { live = false; };
  }, [worldId]);
  return on;
}
