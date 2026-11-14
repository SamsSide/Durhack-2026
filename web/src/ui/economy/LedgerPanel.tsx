import { useWorld } from '../../state/world';
import { useEconomy } from './useEconomy';
import type { LedgerRow } from './useEconomy';
import './economy.css';

const shortSig = (s: string) => (s.length > 10 ? `${s.slice(0, 3)}…${s.slice(-3)}` : s);
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n)));
// Statuses that settle on chain get a solid plate; the rest stay outline paper.
const SOLID: Record<LedgerRow['status'], boolean> = { queued: false, simulated: false, sent: true, confirmed: true, failed: true };
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
        <span className="tn-led-amt">{num(r.amount)}<small>{sym}</small></span>
        <span className="tn-led-reason">{r.reason}</span>
        <span className={`tn-chip tn-chip--caps tn-chip--sm${SOLID[r.status] ? ' tn-chip--ink' : ''} tn-led-chip ${r.status}`}>{r.status}</span>
      </div>
      {(r.note || r.signature) && (
        <div className="tn-led-bot">
          {r.note && <span className="tn-led-note">{r.note}</span>}
          {r.signature && (r.url
            ? <a className="tn-led-sig" href={r.url} target="_blank" rel="noopener noreferrer">{shortSig(r.signature)}</a>
            : <span className="tn-led-sig">{shortSig(r.signature)}</span>)}
        </div>
      )}
    </li>
  );

  return (
    <section className="tn-ledger">
      <h3 className="tn-header-bar tn-led-head">
        {data.currency.url
          ? <a className="tn-led-cur" href={data.currency.url} target="_blank" rel="noopener noreferrer">{data.currency.name}</a>
          : <span className="tn-led-cur">{data.currency.name}</span>}
      </h3>
      <div className="tn-led-totals">
        <span className="tn-stat"><span className="tn-stat__label">Payments</span><span className="tn-stat__value">{data.totals.payments.toLocaleString('en-GB')}</span></span>
        <span className="tn-stat"><span className="tn-stat__label">Volume</span><span className="tn-stat__value">{compact(data.totals.volume)}<small>{sym}</small></span></span>
        <span className="tn-stat"><span className="tn-stat__label">Pending</span><span className="tn-stat__value">{data.pending}</span></span>
      </div>
      <div className="tn-led-state">
        <span className={`tn-chip tn-chip--caps tn-chip--sm${data.mode === 'mock' ? '' : ' tn-chip--gilt'}`}>{data.mode}</span>
        <i className="tn-roundel tn-roundel--dot tn-roundel--dot-sm tn-led-dot" style={{ ['--dot' as string]: data.online ? 'var(--color-ok-bright)' : 'var(--color-danger)' }} aria-hidden="true" />
        <span className="tn-led-online">{data.online ? 'Chain online' : 'Chain offline'}</span>
      </div>
      {data.rows.length === 0
        ? <p className="tn-led-empty tn-well--paper">No coin has changed hands yet.</p>
        : <ul className="tn-led-list">{data.rows.map(row)}</ul>}
    </section>
  );
}
