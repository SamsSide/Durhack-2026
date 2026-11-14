import { useEffect, useRef, useState } from 'react';
import { useWorld } from '../../state/world';
import { useBelief } from '../../state/belief';
import { NationRow } from './NationRow';
import './network.css';

const FOLD_KEY = 'tn-network-folded';
const PLACEHOLDERS = [
  'A plague sweeps the southern coast',
  'A meteor falls on the northern ice',
  'A prophet rises in the desert',
];
const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');

function readFolded(): boolean {
  try { return localStorage.getItem(FOLD_KEY) === '1'; } catch { return false; }
}

export function NetworkPanel() {
  useWorld((s) => s.version);
  const world = useWorld((s) => s.world);
  const agents = useWorld((s) => s.agents);
  const budget = useWorld((s) => s.budget);
  const connected = useWorld((s) => s.connected);
  const selected = useWorld((s) => s.selectedCountryId);
  const beliefOf = useWorld((s) => s.beliefOf);
  const select = useWorld((s) => s.select);
  const flyTo = useWorld((s) => s.flyTo);
  const send = useWorld((s) => s.send);
  const showBelief = useWorld((s) => s.showBelief);
  const belief = useBelief();

  const [folded, setFolded] = useState(readFolded);
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  const [ph, setPh] = useState(0);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setPh((p) => (p + 1) % PLACEHOLDERS.length), 5000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => () => { if (doneTimer.current) clearTimeout(doneTimer.current); }, []);

  if (!world) return null;

  const setFold = (v: boolean) => {
    setFolded(v);
    try { localStorage.setItem(FOLD_KEY, v ? '1' : '0'); } catch { /* storage unavailable */ }
  };

  const live = agents.filter((a) => !a.deleted);
  const anyCutOrDeleted = agents.some((a) => a.link === 'cut' || a.deleted);

  if (folded) {
    return (
      <button className="tn-net tn-net-folded" onClick={() => setFold(false)} aria-label="Open the network panel">
        {anyCutOrDeleted && <span className="tn-net-dot" />}
        <span className="tn-net-vert">Network</span>
      </button>
    );
  }

  const anyUp = live.some((a) => a.link === 'up');
  const blackedOut = live.length > 0 && !anyUp;
  const control = (action: string, countryId: number) => send({ type: 'control', action, countryId });

  const beliefCountry = beliefOf != null ? world.countries.find((c) => c.id === beliefOf) : null;
  const beliefReady = beliefOf != null && belief.countryId === beliefOf && belief.owner != null;
  const drift = beliefReady
    ? belief.owner!.reduce((n, o, i) => (o !== world.owner[i] ? n + 1 : n), 0)
    : 0;

  const decree = () => {
    const t = text.trim();
    if (!t || !connected) return;
    send({ type: 'control', action: 'decree', text: t });
    setText('');
    setDone(true);
    if (doneTimer.current) clearTimeout(doneTimer.current);
    doneTimer.current = setTimeout(() => setDone(false), 2000);
  };

  return (
    <aside className="tn-net">
      <header className="tn-net-head">
        <h3 className="tn-net-title">The Network</h3>
        <button className="tn-net-btn" onClick={() => setFold(true)} aria-label="Fold the network panel">Fold</button>
      </header>

      {budget && (
        <section className="tn-net-sec">
          <div className="tn-net-big">{fmt(budget.tokensIn + budget.tokensOut)}<span className="tn-net-unit">tokens</span></div>
          <div className="tn-net-meta">
            <span>{fmt(budget.calls)} calls</span>
            <span>{fmt(budget.callsPerMin)} per min</span>
            <span className="tn-net-tag">{budget.mode}</span>
          </div>
          {budget.capped && <div className="tn-net-banner">Budget reached: every ruler is on autopilot</div>}
        </section>
      )}

      <section className="tn-net-sec">
        <button
          className={`tn-net-wide ${blackedOut ? 'tn-danger tn-armed' : 'tn-danger'}`}
          disabled={live.length === 0}
          onClick={() => send({ type: 'control', action: 'blackout', value: anyUp })}
        >
          {anyUp ? 'Blackout' : 'Restore all'}
        </button>
        <button
          className={`tn-net-wide ${beliefOf != null ? 'tn-on' : ''}`}
          disabled={beliefOf == null && selected == null}
          onClick={() => showBelief(beliefOf != null ? null : selected)}
        >
          What it believes
        </button>
        {beliefOf == null && selected == null && <div className="tn-net-hint">Select a nation</div>}
        {beliefOf != null && (
          <div className="tn-net-hint">
            Seen by {beliefCountry?.name ?? 'the nation'}
            {' · '}
            {beliefReady ? `${drift} ${drift === 1 ? 'province' : 'provinces'} out of date` : 'Waiting for its view...'}
          </div>
        )}
      </section>

      <ul className="tn-net-list">
        {world.countries.map((c) => (
          <NationRow
            key={c.id}
            country={c}
            agent={agents.find((a) => a.countryId === c.id)}
            tick={world.tick}
            selected={c.id === selected}
            onSelect={(id) => { select(id); flyTo(id); }}
            onControl={control}
          />
        ))}
      </ul>

      <footer className="tn-net-sec tn-net-decree">
        <div className="tn-net-decree-row">
          <input
            value={text}
            maxLength={140}
            placeholder={PLACEHOLDERS[ph]}
            disabled={!connected}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') decree(); }}
          />
          <button className="tn-net-btn" disabled={!connected || !text.trim()} onClick={decree}>Decree</button>
        </div>
        <div className="tn-net-hint">{done ? 'Decreed.' : !connected ? 'Not connected' : ' '}</div>
      </footer>
    </aside>
  );
}
