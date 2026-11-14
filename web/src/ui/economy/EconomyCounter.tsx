import { useEconomy } from './useEconomy';
import './economy.css';
import { Roll } from '../motion/Roll';

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n)));

export function EconomyCounter() {
  const { status, data } = useEconomy();
  if (status !== 'ok' || !data) return null;
  return (
    <span className="tn-eco-counter" title={`${data.currency.name}: ${data.totals.payments} payments`}>
      <span className="tn-eco-sym">{data.currency.symbol}</span>
      <Roll className="tn-eco-num" value={data.totals.payments} />
      <span className="tn-eco-dim">paid</span>
      <Roll className="tn-eco-num" value={data.totals.volume} format={compact} fractional />
      <span className={`tn-eco-mode ${data.mode === 'mock' ? 'mock' : 'live'}`}>{data.mode}</span>
      <i className={`tn-roundel tn-roundel--dot tn-roundel--dot-sm tn-eco-dot ${data.online ? 'on' : 'off'}`} aria-label={data.online ? 'online' : 'offline'} />
      {data.pending > 0 && <span className="tn-eco-dim">{data.pending} pending</span>}
    </span>
  );
}
