import { useEffect } from 'react';
import { create } from 'zustand';

interface PresentationState { on: boolean; set: (on: boolean) => void }

/** Presentation mode (P): every panel hides, the globe, the year and the newest war tab stay. */
export const usePresentation = create<PresentationState>((set) => ({
  on: false,
  set: (on) => set({ on }),
}));

function apply(on: boolean) {
  document.body.classList.toggle('tn-present', on);
}

/** Mount once (App): wires the P and Esc keys and the body class. Same typing guard as App's map-mode keys. */
export function usePresentationKeys() {
  useEffect(() => {
    const unsub = usePresentation.subscribe((s) => apply(s.on));
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      const { on, set } = usePresentation.getState();
      if (e.key === 'p' || e.key === 'P') set(!on);
      else if (e.key === 'Escape' && on) set(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      unsub();
      apply(false);
    };
  }, []);
}
