import { useCallback, useState } from 'react';

// Owner (#275, 21:20): judging is a live demo repeated for every judge, so a reload must always bring
// back the calm, collapsed screen. The state lives in memory only: it survives remounts (a new world,
// presentation mode on and off) but never a reload.
const memory = new Map<string, boolean>();

/** Collapsed state for one panel, kept until the page reloads. */
export function useCollapsed(id: string, defaultCollapsed = true): [boolean, (next: boolean) => void] {
  const [collapsed, setState] = useState(() => memory.get(id) ?? defaultCollapsed);
  const set = useCallback((next: boolean) => {
    memory.set(id, next);
    setState(next);
  }, [id]);
  return [collapsed, set];
}
