import { useEffect } from 'react';
import { create } from 'zustand';

interface HelpState { open: boolean; set: (open: boolean) => void }

/** The help screen. In memory only: every reload starts closed (owner ruling). */
export const useHelp = create<HelpState>((set) => ({
  open: false,
  set: (open) => set({ open }),
}));

/** Mount once: `?` and F1 open and close the help screen, Esc closes it. Same typing guard as the P key. */
export function useHelpKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      const { open, set } = useHelp.getState();
      if (e.key === '?' || e.key === 'F1') {
        e.preventDefault();
        set(!open);
      } else if (e.key === 'Escape' && open) {
        e.stopImmediatePropagation();   // closing help must not also leave presentation mode or close another panel
        set(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
}
