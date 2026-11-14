// The sealed letters a cut nation is holding back (B14), drawn as a small pile of at most three envelopes
// beside its "signal lost" tag. Plain HTML at a fixed pixel size, so it never grows with the zoom.
// The exact count is in the tag text. Lane b.
import './show.css';

const MAX = 3;

function Envelope() {
  return (
    <svg className="lp-env" viewBox="0 0 32 24" aria-hidden="true">
      <rect x="1.5" y="2.5" width="29" height="19" rx="2" fill="#f1e4c2" stroke="#2a1f14" strokeWidth="1.6" />
      <path d="M2.5 3.5 L16 13.5 L29.5 3.5" fill="none" stroke="#2a1f14" strokeWidth="1.4" />
      <circle cx="16" cy="13.5" r="4.6" fill="#c9a24b" />
      <circle cx="16" cy="13.5" r="3.6" fill="#9e1d16" />
      <circle cx="15" cy="12.4" r="1.2" fill="#d24a3a" />
    </svg>
  );
}

export function LetterPile({ count }: { count: number }) {
  const n = Math.min(MAX, Math.max(0, count));
  if (n === 0) return null;
  return (
    <div className="lp-pile" data-n={n}>
      {Array.from({ length: n }, (_, i) => <Envelope key={i} />)}
    </div>
  );
}
