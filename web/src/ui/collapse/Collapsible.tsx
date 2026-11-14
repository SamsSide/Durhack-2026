import type { CSSProperties, ReactNode } from 'react';
import { useCollapsed } from './useCollapsed';
import { usePresence } from '../motion/usePresence';
import './collapse.css';

export interface CollapsibleProps {
  id: string;                  // the sessionStorage key per panel, and the CSS hook (tn-collapsed-icon--<id>)
  label: string;               // "the chronicle": the tooltip reads "Show the chronicle"
  icon: ReactNode;             // inline SVG, 18px, currentColor
  /** Where the collapse chevron sits while open: at the content's top-right corner, or above the history strip. */
  chevron?: 'corner' | 'above-left';
  defaultCollapsed?: boolean;
  /** A wrapper div around the content. The chevron's corner is relative to it. */
  wrapClass?: string;
  wrapStyle?: CSSProperties;
  /** Keep the children mounted while collapsed (the wrapper then gets the class tn-collapsed-<id>, for CSS to hide parts). */
  keepMounted?: boolean;
  children: ReactNode;
}

function Chevron() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

/** One panel that starts as a single round lacquer icon and opens in place; the chevron folds it away again. */
export function Collapsible({ id, label, icon, chevron = 'corner', defaultCollapsed = true, wrapClass, wrapStyle, keepMounted, children }: CollapsibleProps) {
  const [collapsed, setCollapsed] = useCollapsed(id, defaultCollapsed);
  // The open panel stays up for one exit (class tn-m-leaving) before the icon takes its place.
  const { mounted, leaving } = usePresence(!collapsed);
  const button = (
    <button
      type="button"
      className={`tn-button tn-button--round tn-button--lacquer tn-collapsed-icon tn-collapsed-icon--${id}`}
      title={`Show ${label}`}
      aria-label={`Show ${label}`}
      aria-expanded={false}
      onClick={() => setCollapsed(false)}
    >
      {icon}
      <span className="tn-tooltip tn-collapsed-tip" role="tooltip">Show {label}</span>
    </button>
  );
  if (!mounted) {
    if (!keepMounted) return button;
    return <div className={`${wrapClass ?? ''} tn-collapsed-${id}`} style={wrapStyle}>{children}{button}</div>;
  }
  const fold = (
    <button
      type="button"
      className={`tn-button tn-button--round tn-button--lacquer tn-collapse-chev tn-collapse-chev--${chevron}`}
      title={`Hide ${label}`}
      aria-label={`Hide ${label}`}
      aria-expanded
      onClick={() => setCollapsed(true)}
    >
      <Chevron />
    </button>
  );
  const out = leaving ? ' tn-m-leaving' : '';
  // No wrapper asked for: a box-less one (display: contents) still carries the leaving class.
  return wrapClass != null || wrapStyle
    ? <div className={`${wrapClass ?? ''} tn-collapse-open${out}`} style={wrapStyle}>{children}{fold}</div>
    : <div className={`tn-collapse-bare${out}`}>{children}{fold}</div>;
}
