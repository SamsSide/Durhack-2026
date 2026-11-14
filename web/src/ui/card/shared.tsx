import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

export function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

export function Lines() {
  return (
    <div className="tn-lines" aria-hidden="true">
      <span className="tn-shimmer" /><span className="tn-shimmer" /><span className="tn-shimmer tn-short" />
    </div>
  );
}

/** Class for the card root: `holo` inside a [data-hologram] ancestor, else `panel`; `speaking` adds the warm glow. */
export function useCardClass(ref: RefObject<HTMLElement | null>, speaking: boolean): string {
  const [holo, setHolo] = useState(false);
  useLayoutEffect(() => { setHolo(!!ref.current?.closest('[data-hologram]')); }, [ref]);
  return `${holo ? 'holo' : 'panel'} tn-card${speaking ? ' speaking' : ''}`;
}
