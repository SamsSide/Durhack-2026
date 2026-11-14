import { useEffect, useState } from 'react';
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

/** Class for the card root: the docked parchment `.panel`; `.speaking` (tokens.css) is the gilt top rule while
 *  narration or the anthem plays. `.tn-silenced` and `.tn-short` are set by the caller. */
export function useCardClass(_ref: RefObject<HTMLElement | null>, speaking: boolean, silenced = false, short = false): string {
  return `panel tn-card${speaking ? ' speaking' : ''}${silenced ? ' tn-silenced' : ''}${short ? ' tn-short' : ''}`;
}

/** True while the viewport is under 800 px tall (the card drops its summary). */
export function useShort(): boolean {
  const [short, setShort] = useState(() => window.innerHeight < 800);
  useEffect(() => {
    const on = () => setShort(window.innerHeight < 800);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return short;
}
