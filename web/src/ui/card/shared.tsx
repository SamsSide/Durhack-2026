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

/** Class for the card root. The hologram was dropped (owner, PR #75): the card is always the docked
 *  parchment `.panel`; `tn-speaking` marks narration or the anthem with a gilt rule, no glow. */
export function useCardClass(_ref: RefObject<HTMLElement | null>, speaking: boolean): string {
  return `panel tn-card${speaking ? ' tn-speaking' : ''}`;
}
