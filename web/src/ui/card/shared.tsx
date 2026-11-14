import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

/** One labelled meter: a caps label, a sunk trough (theme/materials.css) and the value. */
export function Meter({ label, value, pct, fill, bad, title, seg, meter }: { label: string; value: string; pct: number; fill: string; bad?: boolean; title?: string; seg?: boolean; meter?: number }) {
  return (
    <div className="tn-gaugerow" title={title}>
      <span className="tn-stat__label">{label}</span>
      <span className={`tn-trough${seg ? ' tn-trough--seg' : ''}`} aria-label={`${label} ${value}`}
        {...(meter != null ? { role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 1, 'aria-valuenow': meter } : { role: 'img' })}>
        <i className="tn-trough__fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, ['--fill' as string]: fill }} />
      </span>
      <span className={`tn-gaugerow-v${bad ? ' tn-bad' : ''}`}>{value}</span>
    </div>
  );
}

export function Lines() {
  return (
    <div className="tn-lines" aria-hidden="true">
      <span className="tn-shimmer" /><span className="tn-shimmer" /><span className="tn-shimmer tn-short" />
    </div>
  );
}

/** Class for the card root: a framed parchment sheet (theme/materials.css) with gilt corners; `.speaking` (card.css)
 *  is the gilt top rule while narration or the anthem plays. `.tn-silenced` and `.tn-short` are set by the caller. */
export function useCardClass(_ref: RefObject<HTMLElement | null>, speaking: boolean, silenced = false, short = false): string {
  return `tn-sheet tn-frame tn-frame--corners tn-card${speaking ? ' speaking' : ''}${silenced ? ' tn-silenced' : ''}${short ? ' tn-short' : ''}`;
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

/** Class for a card title: a word of 12 letters or more gets a smaller size so it stays in its column; 14 or more may break. */
export function nameClass(name: string): string {
  const longest = name.split(/[\s-]+/).reduce((m, w) => Math.max(m, w.length), 0);
  return `tn-name tn-engraved${longest >= 12 ? ' tn-name--long' : ''}${longest >= 14 ? ' tn-name--huge' : ''}`;
}
