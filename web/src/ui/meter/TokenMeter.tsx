import { useWorld } from '../../state/world';
import './meter.css';

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
  const label = state === 'capped' ? 'Capped' : state === 'live' ? 'Live' : 'Mock';
  return (
    <div className={`tn-meter tn-meter-${state}`}>
      <span className="num">{calls(budget.calls)}</span> calls<span className="dot">·</span>
      <span className="num">{short(budget.tokensIn + budget.tokensOut)}</span> tokens<span className="dot">·</span>
      <span className="mode">{label}</span>
    </div>
  );
}
