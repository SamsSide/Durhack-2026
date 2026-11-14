import { useState } from 'react';
import { useWorld } from '../../state/world';
import { useBelief } from '../../state/belief';
import { NationRow } from './NationRow';
import { LedgerPanel } from '../economy/LedgerPanel';
import { EconomyCounter } from '../economy/EconomyCounter';
import { useEconomy } from '../economy/useEconomy';
import { TerritoryChart } from '../stats/TerritoryChart';
import { useStats } from '../stats/useStats';
import './network.css';

const FOLD_KEY = 'tn-network-folded';
function readFolded(): boolean {
  try { const v = localStorage.getItem(FOLD_KEY); return v == null ? true : v === '1'; } catch { return true; }
}

const TAB_KEY = 'tn-network-tab';
type NetTab = 'network' | 'treasury' | 'stats';
function readTab(): NetTab {
  try { const v = localStorage.getItem(TAB_KEY); return v === 'treasury' || v === 'stats' ? v : 'network'; } catch { return 'network'; }
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
  const [tab, setTabState] = useState<NetTab>(readTab);
  const economy = useEconomy();
  const economyOn = economy.status === 'ok';
  const statsOn = useStats().status === 'ok';   // row A11: the tab exists only while Tiger Data answers
  const setTab = (t: NetTab) => {
    setTabState(t);
    try { localStorage.setItem(TAB_KEY, t); } catch { /* storage unavailable */ }
  };

  if (!world) return null;

  const setFold = (v: boolean) => {
    setFolded(v);
    try { localStorage.setItem(FOLD_KEY, v ? '1' : '0'); } catch { /* storage unavailable */ }
  };

  const live = agents.filter((a) => !a.deleted);
  const anyCutOrDeleted = agents.some((a) => a.link === 'cut' || a.deleted);

  const upCount = live.filter((a) => a.link === 'up').length;
  const cutCount = live.filter((a) => a.link === 'cut').length;

  if (folded) {
    return (
      <button className="tn-net-tab" onClick={() => setFold(false)} aria-label="Open the network panel">
        <span className="tn-nt-title">The Network</span>
        <span className="tn-state up"><i />{upCount} up</span>
        {cutCount > 0 && <span className="tn-state cut"><i />{cutCount} cut</span>}
        <EconomyCounter />
        <svg width="6" height="10" viewBox="0 0 6 10" aria-hidden="true"><path d="M1 1L5 5L1 9" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
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
  let beliefSub = "The selected nation's map, not the truth";
  if (beliefOf != null) {
    beliefSub = beliefReady
      ? `What ${nationName} thinks is true · ${drift} ${drift === 1 ? 'province' : 'provinces'} out of date`
      : `What ${nationName} thinks is true · waiting for its view...`;
  }
  const beliefDisabled = beliefOf == null && selected == null;

  const showTab: NetTab = (tab === 'treasury' && economyOn) || (tab === 'stats' && statsOn) ? tab : 'network';

  return (
    <aside className="tn-net panel">
      <header className="tn-net-head">
        <div>
          <h2 className="tn-net-title">The Network</h2>
          <p className="tn-net-sub">Each nation thinks for itself. Cut one off and watch.</p>
        </div>
        <button className="tn-net-fold" onClick={() => setFold(true)} aria-label="Fold the network panel"><svg width="6" height="10" viewBox="0 0 6 10" aria-hidden="true"><path d="M5 1L1 5L5 9" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg></button>
      </header>

      {(economyOn || statsOn) && (
        <div className="tn-net-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={showTab === 'network'} className={`tn-net-tabbtn${showTab === 'network' ? ' tn-on' : ''}`} onClick={() => setTab('network')}>Network</button>
          {economyOn && <button type="button" role="tab" aria-selected={showTab === 'treasury'} className={`tn-net-tabbtn${showTab === 'treasury' ? ' tn-on' : ''}`} onClick={() => setTab('treasury')}>Treasury</button>}
          {statsOn && <button type="button" role="tab" aria-selected={showTab === 'stats'} className={`tn-net-tabbtn${showTab === 'stats' ? ' tn-on' : ''}`} onClick={() => setTab('stats')}>Stats</button>}
        </div>
      )}

      {showTab === 'stats' ? <TerritoryChart /> : showTab === 'treasury' ? <LedgerPanel /> : (<>
      <button
        className={`tn-switch tn-blackout ${blackedOut ? 'on' : ''}`}
        role="switch"
        aria-checked={blackedOut}
        disabled={live.length === 0}
        onClick={() => send({ type: 'control', action: 'blackout', value: anyUp })}
      >
        <span>
          <span className="tn-sw-title">Blackout</span>
          <span className="tn-sw-sub">{blackedOut ? 'Every link is cut' : 'Cut every link at once'}</span>
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
            year={world.year}
            selected={c.id === selected}
            onSelect={(id) => { select(id); flyTo(id); }}
            onControl={control}
          />
        ))}
      </ul>
      </>)}
    </aside>
  );
}
