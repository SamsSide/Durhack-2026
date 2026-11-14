import { useId } from 'react';
import type { CouncilRole } from '@terra/shared';

/** A small seeded rng (mulberry32): the same portraitSeed always draws the same face. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HAIR = ['var(--color-ink)', 'var(--color-ink-muted)', 'var(--color-accent)', 'var(--color-rubric)', 'var(--color-parchment-dark)'];
const pick = <T,>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length)]!;
const f = (n: number) => n.toFixed(1);

/** A generated ink-framed bust in an oval cameo. `seed` null draws the empty dashed oval of a vacant role. */
export function Portrait({ seed, role, color, size = 36 }: { seed: number | null; role: CouncilRole; color: string; size?: number }) {
  const id = useId().replace(/:/g, '');
  const w = size, h = Math.round(size * 1.12);
  if (seed == null) {
    return (
      <svg className="tn-por tn-por-vacant" width={w} height={h} viewBox="0 0 36 40" aria-hidden="true">
        <ellipse cx="18" cy="20" rx="15" ry="17.5" fill="none" stroke="var(--color-ink-muted)" strokeWidth="1.2" strokeDasharray="3 2.5" />
      </svg>
    );
  }
  const r = rng(seed);
  const headRx = 5.6 + r() * 1.8, headRy = 6.6 + r() * 1.8;
  const headY = 17 + r() * 1.5;
  const shoulder = 11 + r() * 5;            // half-width of the shoulders
  const slope = 3 + r() * 3;
  const hair = pick(r, HAIR);
  const hairKind = Math.floor(r() * 3);     // 0 cap, 1 long, 2 bald
  const gear = Math.floor(r() * 2);         // variant of crown / helm
  const mantle2 = r() > 0.5;
  const topY = headY - headRy;
  const base = 40;
  const sh = `M${f(18 - shoulder)} ${base} C${f(18 - shoulder)} ${f(30 + slope)} ${f(18 - 5)} 27.5 18 27.5 C${f(18 + 5)} 27.5 ${f(18 + shoulder)} ${f(30 + slope)} ${f(18 + shoulder)} ${base} Z`;
  return (
    <svg className="tn-por" width={w} height={h} viewBox="0 0 36 40" aria-hidden="true">
      <defs><clipPath id={id}><ellipse cx="18" cy="20" rx="15" ry="17.5" /></clipPath></defs>
      <ellipse cx="18" cy="20" rx="15" ry="17.5" style={{ fill: 'var(--color-parchment-dark)' }} />
      <g clipPath={`url(#${id})`}>
        <path d={sh} style={{ fill: color }} stroke="var(--color-ink)" strokeWidth="0.9" />
        {mantle2 && <path d={`M18 27.5 L${f(18 - 3)} ${base} L${f(18 + 3)} ${base} Z`} style={{ fill: 'var(--color-parchment-light)' }} opacity="0.55" />}
        <rect x="16" y={f(headY + headRy - 1)} width="4" height="5" style={{ fill: 'var(--color-parchment-light)' }} stroke="var(--color-ink)" strokeWidth="0.7" />
        {hairKind === 1 && <ellipse cx="18" cy={f(headY + 2)} rx={f(headRx + 1.6)} ry={f(headRy + 2.2)} style={{ fill: hair }} stroke="var(--color-ink)" strokeWidth="0.7" />}
        <ellipse cx="18" cy={f(headY)} rx={f(headRx)} ry={f(headRy)} style={{ fill: 'var(--color-parchment-light)' }} stroke="var(--color-ink)" strokeWidth="0.9" />
        {hairKind === 0 && <path d={`M${f(18 - headRx)} ${f(headY - 1)} Q18 ${f(topY - 3)} ${f(18 + headRx)} ${f(headY - 1)} Q18 ${f(topY + 1.5)} ${f(18 - headRx)} ${f(headY - 1)} Z`} style={{ fill: hair }} stroke="var(--color-ink)" strokeWidth="0.6" />}
        <circle cx={f(18 - headRx / 2)} cy={f(headY)} r="0.7" style={{ fill: 'var(--color-ink)' }} />
        <circle cx={f(18 + headRx / 2)} cy={f(headY)} r="0.7" style={{ fill: 'var(--color-ink)' }} />
        {role === 'ruler' ? (
          <path d={gear ? `M${f(18 - headRx)} ${f(topY + 1.5)} L${f(18 - headRx)} ${f(topY - 3.5)} L${f(18 - headRx / 2)} ${f(topY - 0.5)} L18 ${f(topY - 5)} L${f(18 + headRx / 2)} ${f(topY - 0.5)} L${f(18 + headRx)} ${f(topY - 3.5)} L${f(18 + headRx)} ${f(topY + 1.5)} Z`
            : `M${f(18 - headRx)} ${f(topY + 1.5)} L${f(18 - headRx - 1)} ${f(topY - 3)} L${f(18 - headRx / 3)} ${f(topY - 0.5)} L18 ${f(topY - 4)} L${f(18 + headRx / 3)} ${f(topY - 0.5)} L${f(18 + headRx + 1)} ${f(topY - 3)} L${f(18 + headRx)} ${f(topY + 1.5)} Z`}
            style={{ fill: 'var(--color-accent)' }} stroke="var(--color-ink)" strokeWidth="0.8" />
        ) : (
          <>
            <path d={`M${f(18 - headRx - 0.8)} ${f(headY - 1)} Q${f(18 - headRx - 0.8)} ${f(topY - 2)} 18 ${f(topY - 2)} Q${f(18 + headRx + 0.8)} ${f(topY - 2)} ${f(18 + headRx + 0.8)} ${f(headY - 1)} Z`} style={{ fill: 'var(--color-ink-muted)' }} stroke="var(--color-ink)" strokeWidth="0.8" />
            {gear === 1 && <path d={`M18 ${f(topY - 2)} Q${f(22 + headRx / 2)} ${f(topY - 8)} ${f(24 + headRx / 2)} ${f(topY + 1)} Q${f(21 + headRx / 3)} ${f(topY - 3)} 18 ${f(topY - 2)} Z`} style={{ fill: 'var(--color-rubric)' }} stroke="var(--color-ink)" strokeWidth="0.5" />}
            <rect x="17.3" y={f(headY - 1)} width="1.4" height={f(headRy * 0.9)} style={{ fill: 'var(--color-ink-muted)' }} />
          </>
        )}
      </g>
      <ellipse cx="18" cy="20" rx="15" ry="17.5" fill="none" stroke="var(--color-ink)" strokeWidth="1.6" />
    </svg>
  );
}
