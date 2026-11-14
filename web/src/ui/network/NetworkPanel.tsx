import { useState } from 'react';
import { useWorld } from '../../state/world';
import { useBelief } from '../../state/belief';
import { NationRow } from './NationRow';
import './network.css';

const FOLD_KEY = 'tn-network-folded';
function readFolded(): boolean {
  try { return localStorage.getItem(FOLD_KEY) === '1'; } catch { return false; }
}

export function NetworkPanel() {
  useWorld((s) => s.version);
  const world = useWorld((s) => s.world);
  const agents = useWorld((s) => s.agents);
  const selected = useWorld((s) => s.selectedCountryId);
  const beliefOf = useWorld((s) => s.beliefOf);
  const select = useWorld((s) => s.select);
  const flyTo = useWorld((s) => s.flyTo);
  const send = useWorld((s) => s.send);
  const showBelief = useWorld((s) => s.showBelief);
  const belief = useBelief();

  const [folded, setFolded] = useState(readFolded);

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

  const nationName = beliefCountry?.name ?? 'the nation';
  let beliefSub = "Draw the selected nation's map, not the truth";
  if (beliefOf != null) {
    beliefSub = beliefReady
      ? `What ${nationName} thinks is true · ${drift} ${drift === 1 ? 'province' : 'provinces'} out of date`
      : `What ${nationName} thinks is true · waiting for its view...`;
  }
  const beliefDisabled = beliefOf == null && selected == null;

  return (
    <aside className="tn-net panel">
      <header className="tn-net-head">
        <div>
          <h2 className="tn-net-title">The Network</h2>
          <p className="tn-net-sub">Each nation thinks for itself. Cut its link, silence its ruler, or delete it.</p>
        </div>
        <button className="btn xs tn-net-fold" onClick={() => setFold(true)} aria-label="Fold the network panel">Fold</button>
      </header>

      <button
        className={`tn-switch ${blackedOut ? 'on' : ''}`}
        role="switch"
        aria-checked={blackedOut}
        disabled={live.length === 0}
        onClick={() => send({ type: 'control', action: 'blackout', value: anyUp })}
      >
        <span>
          <span className="tn-sw-title">Blackout</span>
          <span className="tn-sw-sub">Cut every link at once</span>
        </span>
        <span className={`tn-toggle danger ${blackedOut ? 'on' : ''}`}><i /></span>
      </button>

      <button
        className={`tn-switch ${beliefOf != null ? 'on' : ''}`}
        role="switch"
        aria-checked={beliefOf != null}
        disabled={beliefDisabled}
        onClick={() => showBelief(beliefOf != null ? null : selected)}
      >
        <span>
          <span className="tn-sw-title">Show beliefs</span>
          <span className="tn-sw-sub">{beliefSub}</span>
        </span>
        <span className={`tn-toggle ${beliefOf != null ? 'on' : ''}`}><i /></span>
      </button>

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
    </aside>
  );
}
