import { useWorld } from '../../state/world';
import './meter.css';
import { Roll } from '../motion/Roll';

const calls = (n: number) => Math.round(n).toLocaleString('en-GB');
function short(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function TokenMeter() {
  const budget = useWorld((s) => s.budget);
  if (!budget) return null;
  const state = budget.capped ? 'capped' : budget.mode === 'live' ? 'live' : 'mock';
  const local = budget.localCalls ?? 0;
  const label = state === 'capped' ? 'Capped' : state === 'live' ? 'Live' : 'Mock';
  return (
    <div className={`tn-meter tn-meter-${state}`}>
      <span className="calls"><Roll className="num" value={budget.calls} format={calls} /> calls<span className="dot">·</span></span>
      {local > 0 && <span className="calls" title="Answered by Gemma on this laptop"><Roll className="num" value={local} format={calls} /> local<span className="dot">·</span></span>}
      <Roll className="num" value={budget.tokensIn + budget.tokensOut} format={short} fractional /> tokens<span className="dot">·</span>
      <span className="mode">{label}</span>
    </div>
  );
}
