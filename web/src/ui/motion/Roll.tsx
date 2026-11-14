// A number that rolls to its new value instead of jumping. React renders the span once per value (as
// before); the frames in between are written straight to the DOM, so nothing else re-renders. A new
// value that arrives mid-roll carries on from the number on screen.
import { useLayoutEffect, useRef } from 'react';
import { reducedMotion } from './usePresence';

const plain = (n: number) => Math.round(n).toLocaleString('en-GB');

export interface RollProps {
  value: number;
  /** Text for a value on the way (it is given whole numbers unless `fractional`). */
  format?: (n: number) => string;
  /** Milliseconds; the default is --motion-number. Keep it under the readout's update interval. */
  ms?: number;
  fractional?: boolean;
  className?: string;
}

let tokenMs: number | null = null;
function numberMs(): number {
  if (tokenMs == null) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--motion-number');
    const n = parseFloat(raw);
    tokenMs = Number.isFinite(n) ? n : 320;
  }
  return tokenMs;
}

export function Roll({ value, format = plain, ms, fractional = false, className }: RollProps) {
  const el = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  const fmt = useRef(format);
  fmt.current = format;

  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const write = (n: number) => {
      const text = fmt.current(fractional ? n : Math.round(n));
      const t = node.firstChild;
      // Change the text node in place: a characterData mutation, which the body-wide childList observers ignore.
      if (t && t.nodeType === Node.TEXT_NODE) { if ((t as Text).data !== text) (t as Text).data = text; }
      else node.textContent = text;
    };
    const from = shown.current;
    const dur = ms ?? numberMs();
    // First paint, no change, a hidden tab or reduced motion: just show it.
    if (from == null || from === value || !Number.isFinite(from) || !Number.isFinite(value) || dur <= 0 || document.hidden || reducedMotion()) {
      shown.current = value;
      write(value);
      return;
    }
    write(from);
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);   // ease-out: quick at first, settles on the value
      shown.current = from + (value - from) * e;
      write(k < 1 ? shown.current : value);
      if (k < 1) raf = requestAnimationFrame(step);
      else shown.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, fractional]);

  // No React children: the text is owned by the effect above, so a parent re-render never resets a roll.
  return <span ref={el} className={className ? `tn-roll ${className}` : 'tn-roll'} />;
}
