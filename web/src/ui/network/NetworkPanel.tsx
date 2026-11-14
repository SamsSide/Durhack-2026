import { useState } from 'react';
import { useWorld } from '../../state/world';
import { useBelief } from '../../state/belief';
import { AutoIcon, NetworkGraph } from './NetworkGraph';
import { NodeTray } from './NodeTray';
import { useLeftPanel } from '../leftPanel';
import { useShort } from '../card/shared';
import { PrepareSwitch } from '../prepare/PreparePanel';
import { LedgerPanel } from '../economy/LedgerPanel';
import { EconomyCounter } from '../economy/EconomyCounter';
import { useEconomy } from '../economy/useEconomy';
import { TerritoryChart } from '../stats/TerritoryChart';
import { useStats } from '../stats/useStats';
import './network.css';

const TAB_KEY = 'tn-network-tab';
type NetTab = 'network' | 'treasury' | 'stats';
function readTab(): NetTab {
  try { const v = localStorage.getItem(TAB_KEY); return v === 'treasury' || v === 'stats' ? v : 'network'; } catch { return 'network'; }
}

export function NetworkPanel() {
  useWorld((s) => s.version);
  const world = useWorld((s) => s.world);
  const agents = useWorld((s) => s.agents);
  const beliefOf = useWorld((s) => s.beliefOf);
  const select = useWorld((s) => s.select);
  const flyTo = useWorld((s) => s.flyTo);
  const send = useWorld((s) => s.send);
  const showBelief = useWorld((s) => s.showBelief);
  const belief = useBelief();

  // The fold state lives in the left-panel store (#245): opening the Network closes the nation card.
  const folded = !useLeftPanel((st) => st.networkOpen);
  const setNetworkOpen = useLeftPanel((st) => st.setNetworkOpen);
  const [pickedId, setPicked] = useState<number | null>(null);
  const isShort = useShort();
  const [tab, setTabState] = useState<NetTab>(readTab);
  const economy = useEconomy();
  const economyOn = economy.status === 'ok';
  const statsOn = useStats().status === 'ok';   // row A11: the tab exists only while Tiger Data answers
  const setTab = (t: NetTab) => {
    setTabState(t);
    try { localStorage.setItem(TAB_KEY, t); } catch { /* storage unavailable */ }
  };

  if (!world) return null;

  const setFold = (v: boolean) => setNetworkOpen(!v);
  // The node picked on the graph. It is not the map selection: selecting a nation opens its card instead.
  const picked = pickedId != null && world.countries[pickedId] ? pickedId : null;

  const live = agents.filter((a) => !a.deleted);
  const anyCutOrDeleted = agents.some((a) => a.link === 'cut' || a.deleted);

  const upCount = live.filter((a) => a.link === 'up').length;
  const cutCount = live.filter((a) => a.link === 'cut').length;

  if (folded) {
    return (
      <button className="tn-net-tab tn-lacquer tn-frame tn-frame--slim" onClick={() => setFold(false)} aria-label="Open the network panel">
        <span className="tn-nt-title">The Network</span>
        <span className="tn-state up tn-chip tn-chip--caps tn-chip--lacquer"><i />{upCount} up</span>
        {cutCount > 0 && <span className="tn-state cut tn-chip tn-chip--caps tn-chip--war"><i />{cutCount} cut</span>}
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
  let beliefSub = "The picked nation's map, not the truth";
  if (beliefOf != null) {
    beliefSub = beliefReady
      ? `What ${nationName} thinks is true · ${drift} ${drift === 1 ? 'province' : 'provinces'} out of date`
      : `What ${nationName} thinks is true · waiting for its view...`;
  }
  const beliefDisabled = beliefOf == null && picked == null;

  const pickedCountry = picked != null ? world.countries[picked] : undefined;

  const showTab: NetTab = (tab === 'treasury' && economyOn) || (tab === 'stats' && statsOn) ? tab : 'network';

  return (
    // The frame sits on the aside and must not scroll (it would clip the cartouche and corners), so the body scrolls inside it.
    <aside className={`tn-net tn-sheet tn-frame tn-frame--corners${isShort ? ' tn-net-short' : ''}`}>
      <h2 className="tn-net-title tn-cartouche" title="Cut a nation off, silence its AI or delete it, and watch the rest carry on.">The Network</h2>
      <div className="tn-net-body">
      <header className="tn-net-head">
        <p className="tn-net-sub">Cut a nation off, silence its AI or delete it, and watch the rest carry on.</p>
        <button className="tn-net-fold tn-button tn-button--round" onClick={() => setFold(true)} aria-label="Fold the network panel"><svg width="7" height="12" viewBox="0 0 6 10" aria-hidden="true"><path d="M5 1L1 5L5 9" stroke="currentColor" strokeWidth="1.6" fill="none" /></svg></button>
      </header>

      {(economyOn || statsOn) && (
        <div className="tn-net-tabs tn-booktabs" role="tablist">
          <button type="button" role="tab" aria-selected={showTab === 'network'} className={`tn-booktab${showTab === 'network' ? ' tn-booktab--active' : ''}`} onClick={() => setTab('network')}>Network</button>
          {economyOn && <button type="button" role="tab" aria-selected={showTab === 'treasury'} className={`tn-booktab${showTab === 'treasury' ? ' tn-booktab--active' : ''}`} onClick={() => setTab('treasury')}>Treasury</button>}
          {statsOn && <button type="button" role="tab" aria-selected={showTab === 'stats'} className={`tn-booktab${showTab === 'stats' ? ' tn-booktab--active' : ''}`} onClick={() => setTab('stats')}>Stats</button>}
        </div>
      )}

      {showTab === 'stats' ? <TerritoryChart /> : showTab === 'treasury' ? <LedgerPanel /> : (<>
      <NetworkGraph countries={world.countries} agents={agents} picked={picked} compact={isShort} onPick={(id) => { setPicked(id); flyTo(id); }} />
      <div className="tn-graph-key" aria-hidden="true">
        <span><i className="tn-key up" />link up</span>
        <span><i className="tn-key cut" />cut</span>
        <span><i className="tn-key count">3</i>queued</span>
        <span className="tn-key-auto"><AutoIcon size={11} />autopilot</span>
      </div>

      {pickedCountry ? (
        <NodeTray
          country={pickedCountry}
          agent={agents.find((a) => a.countryId === pickedCountry.id)}
          tick={world.tick}
          year={world.year}
          onControl={control}
          onOpenCard={(id) => { select(id); flyTo(id); }}
        />
      ) : (
        <p className="tn-tray-empty tn-well--paper">Pick a nation on the graph to cut it off, silence it, delete it or reach its council.</p>
      )}

      <div className="tn-net-world">
        <button
          className={`tn-net-switch tn-blackout ${blackedOut ? 'on' : ''}`}
          role="switch"
          aria-checked={blackedOut}
          title="Cut every link at once"
          aria-label="Blackout: cut every link at once"
          disabled={live.length === 0}
          onClick={() => send({ type: 'control', action: 'blackout', value: anyUp })}
        >
          <span>
            <span className="tn-sw-title">Blackout</span>
            <span className="tn-sw-sub">{blackedOut ? 'Every link is cut' : 'Cut every link at once'}</span>
          </span>
          <span className={`tn-switch tn-switch--danger${blackedOut ? ' on' : ''}`} aria-hidden="true"><i /></span>
        </button>

        <button
          className={`tn-net-switch ${beliefOf != null ? 'on' : ''}`}
          role="switch"
          aria-checked={beliefOf != null}
          title={beliefDisabled ? 'Pick a nation on the graph first' : "Show the picked nation's own map instead of the truth"}
          aria-label="Show beliefs: show the picked nation's own map instead of the truth"
          disabled={beliefDisabled}
          onClick={() => showBelief(beliefOf != null ? null : picked)}
        >
          <span>
            <span className="tn-sw-title">Show beliefs</span>
            <span className="tn-sw-sub">{beliefSub}</span>
          </span>
          <span className={`tn-switch${beliefOf != null ? ' on' : ''}`} aria-hidden="true"><i /></span>
        </button>
      </div>

      <PrepareSwitch />
      </>)}
      </div>
    </aside>
  );
}
