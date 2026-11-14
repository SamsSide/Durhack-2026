import { useWorld } from '../../state/world';
import { EconomyCounter } from './EconomyCounter';
import { useEconomy } from './useEconomy';
import type { LedgerRow } from './useEconomy';
import './economy.css';

const shortSig = (s: string) => (s.length > 10 ? `${s.slice(0, 3)}…${s.slice(-3)}` : s);
const num = (n: number) => (Math.abs(n) >= 100 ? Math.round(n).toLocaleString('en-GB') : String(Math.round(n * 100) / 100));

export function LedgerPanel() {
  const { status, data } = useEconomy();
  const countries = useWorld((s) => s.world?.countries);
  if (status !== 'ok' || !data) return null;
  const who = (id: number) => countries?.find((c) => c.id === id);
  const sym = data.currency.symbol;

  const party = (id: number) => {
    const c = who(id);
    return (
      <span className="tn-led-who">
        <span className="tn-sw" style={{ ['--tn-nation' as string]: c?.color ?? 'var(--color-ink-muted)' }} />
        <span className="tn-led-name">{c?.name ?? 'The Commons'}</span>
      </span>
    );
  };

  const row = (r: LedgerRow) => (
    <li key={r.id} className="tn-led-row">
      <div className="tn-led-top">
        <span className="tn-led-year">Y{r.year}</span>
        {party(r.from)}<span className="tn-led-pays">pays</span>{party(r.to)}
      </div>
      <div className="tn-led-mid">
        <span className="tn-led-amt">{num(r.amount)} {sym}</span>
        <span className="tn-led-reason">{r.reason}</span>
        <span className={`tn-led-chip ${r.status}`}>{r.status}</span>
      </div>
      <div className="tn-led-bot">
        {r.note && <span className="tn-led-note">{r.note}</span>}
        {r.signature && (r.url
          ? <a className="tn-led-sig" href={r.url} target="_blank" rel="noopener noreferrer">{shortSig(r.signature)}</a>
          : <span className="tn-led-sig">{shortSig(r.signature)}</span>)}
      </div>
    </li>
  );

  return (
    <section className="tn-ledger">
      <header className="tn-led-head">
        {data.currency.url
          ? <a className="tn-led-cur" href={data.currency.url} target="_blank" rel="noopener noreferrer">{data.currency.name}</a>
          : <span className="tn-led-cur">{data.currency.name}</span>}
        <EconomyCounter />
      </header>
      {data.rows.length === 0
        ? <p className="tn-led-empty">No coin has changed hands yet.</p>
        : <ul className="tn-led-list">{data.rows.map(row)}</ul>}
    </section>
  );
}
