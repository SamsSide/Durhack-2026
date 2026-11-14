import { useCallback, useState } from 'react';

const PREFIX = 'tn-collapsed:';

function read(id: string, fallback: boolean): boolean {
  try {
    const v = window.sessionStorage.getItem(PREFIX + id);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch { /* storage blocked: use the default */ }
  return fallback;
}

/** Collapsed state for one panel, remembered per browser tab (sessionStorage). */
export function useCollapsed(id: string, defaultCollapsed = true): [boolean, (next: boolean) => void] {
  const [collapsed, setState] = useState(() => read(id, defaultCollapsed));
  const set = useCallback((next: boolean) => {
    setState(next);
    try { window.sessionStorage.setItem(PREFIX + id, next ? '1' : '0'); } catch { /* ignore */ }
  }, [id]);
  return [collapsed, set];
}
