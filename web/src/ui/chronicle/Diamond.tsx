import type { DisplayKind } from './kinds';

/** The kind marker: a small diamond filled with var(--kind-<kind>) through the .tn-k-* classes. */
export function Diamond({ kind, size = 9 }: { kind: DisplayKind; size?: number }) {
  return (
    <svg className="tn-ico" width={size} height={size} viewBox="0 0 9 9" aria-hidden="true">
      <polygon className={`tn-k-${kind}`} points="4.5,0 9,4.5 4.5,9 0,4.5" />
    </svg>
  );
}

/** The small chevron on the Timeline and Collapse buttons; `up` points it up. */
export function Chevron({ up = false }: { up?: boolean }) {
  return (
    <svg className="tn-ico" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"
      style={up ? { transform: 'rotate(180deg)' } : undefined}>
      <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
