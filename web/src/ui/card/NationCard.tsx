import { useEffect, useMemo, useRef, useState } from 'react';
import { flagSvg, goodOf, landDevastation, movementOf, politicsOf, readinessBand, readinessOf } from '@terra/shared';
import type { Stance, World } from '@terra/shared';
import { onWorldReset, useWorld } from '../../state/world';
import { audio } from '../../audio';
import { useAudio } from '../../audio/useAudio';
import { useEconomy } from '../economy/useEconomy';
import '../economy/economy.css';
import { Council } from './Council';
import { Portrait } from './Portrait';
import { RegionView } from './RegionView';
import { useLore } from './useLore';
import { EconomyTab, PoliticsBlock, StatusChips, useMarketPlan } from './Economy';
import { CloseIcon, Lines, Meter, useCardClass, useShort } from './shared';
import './card.css';

const STANCE_ORDER: Stance[] = ['war', 'hostile', 'alliance', 'trade', 'neutral'];

// Painted flag results, once per country per page load. A string is an object URL, null is "none".
const paintedCache = new Map<number, string | null>();
onWorldReset(() => {
  for (const u of paintedCache.values()) if (u) URL.revokeObjectURL(u);
  paintedCache.clear();
});

function usePaintedFlag(countryId: number): string | null {
  const [url, setUrl] = useState<string | null>(paintedCache.get(countryId) ?? null);
  useEffect(() => {
    if (paintedCache.has(countryId)) { setUrl(paintedCache.get(countryId) ?? null); return; }
    setUrl(null);
    let live = true;
    fetch(`/api/country/${countryId}/flag`)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        const u = URL.createObjectURL(b);
        paintedCache.set(countryId, u);
        if (live) setUrl(u);
      })
      .catch(() => { paintedCache.set(countryId, null); });
    return () => { live = false; };
  }, [countryId]);
  return url;
}

function Flag({ countryId, spec }: { countryId: number; spec: Parameters<typeof flagSvg>[0] }) {
  const painted = usePaintedFlag(countryId);
  const [shown, setShown] = useState(false);
  useEffect(() => setShown(false), [painted]);
  return (
    <div className="tn-flag tn-flag-plate">
      <div className="tn-flag-drawn" dangerouslySetInnerHTML={{ __html: flagSvg(spec, 66, 44) }} />
      {painted && (
        <img className={`tn-flag-painted ${shown ? 'tn-on' : ''}`} src={painted} alt="" width={66} height={44} onLoad={() => setShown(true)} />
      )}
    </div>
  );
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}K` : fmt(n));

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The numbers of the stats grid (#245), walked once per world version. */
function useNationStats(world: World | null, countryId: number) {
  const version = useWorld((s) => s.version);
  return useMemo(() => {
    if (!world) return null;
    let provinces = 0;
    const goods = new Map<string, number>();
    for (let i = 0; i < world.owner.length; i++) {
      if (world.owner[i] !== countryId) continue;
      provinces++;
      const g = goodOf(world, i);
      if (g) goods.set(g, (goods.get(g) ?? 0) + 1);
    }
    let mainGood: string | null = null, best = 0;
    for (const [g, n] of goods) if (n > best) { best = n; mainGood = g; }
    let army = 0;
    for (const u of world.units) if (u.owner === countryId) army += u.strength;
    let regions = 0, unrest = 0;
    for (const r of world.regions) {
      if (world.owner[r.capitalTile] !== countryId) continue;
      regions++;
      unrest += Math.max(0, Math.min(1, r.unrest));
    }
    return { provinces, mainGood, army, unrest: regions ? (unrest / regions) * 100 : 0, devastation: landDevastation(world, countryId) };
  }, [world, countryId, version]);
}

/** The fill colour of the war-readiness trough: calm green at peace, through gilt and amber, to war red. */
const readinessFill = (r: number) => (r < 25 ? 'var(--color-ok)' : r < 50 ? 'var(--gilt)' : r < 75 ? 'var(--stance-hostile)' : 'var(--stance-war)');

const DIPLOMACY: { stance: Stance; label: string }[] = [
  { stance: 'war', label: 'At war' }, { stance: 'alliance', label: 'Allies' }, { stance: 'trade', label: 'Trade pacts' },
];

type Tab = 'culture' | 'economy' | 'politics' | 'history' | 'relations';
const TABS: { id: Tab; label: string }[] = [
  { id: 'culture', label: 'Culture' }, { id: 'economy', label: 'Economy' }, { id: 'politics', label: 'Politics' },
  { id: 'history', label: 'History' }, { id: 'relations', label: 'Relations' },
];

export function NationCard({ countryId, regionId }: { countryId: number; regionId?: number | null }) {
  if (typeof regionId === 'number') return <RegionView regionId={regionId} />;
  return <Nation countryId={countryId} />;
}

function Play() {
  return <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 0.5 L9 5 L1 9.5 Z" fill="currentColor" /></svg>;
}
function StopSq() {
  return <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true"><rect width="9" height="9" fill="currentColor" /></svg>;
}
function Eq() {
  return <span className="tn-eq" aria-hidden="true"><i /><i /><i /></span>;
}

function Nation({ countryId }: { countryId: number }) {
  useWorld((s) => s.version);
  const world = useWorld((s) => s.world);
  const select = useWorld((s) => s.select);
  const flyTo = useWorld((s) => s.flyTo);
  const { lore, loading, error, retry } = useLore(countryId);
  const { state, countryId: playing } = useAudio();
  const [tab, setTab] = useState<Tab>('culture');
  const [pressed, setPressed] = useState<'narration' | 'anthem' | null>(null);
  const [failed, setFailed] = useState<'narration' | 'anthem' | null>(null);
  const failTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => () => { if (failTimer.current) clearTimeout(failTimer.current); }, []);

  const mine = playing === countryId;
  const speaking = mine && (state === 'narration' || state === 'anthem');
  const isShort = useShort();
  const agent = useWorld((st) => st.agents.find((a) => a.countryId === countryId));
  const economy = useEconomy();

  const plan = useMarketPlan(world ?? null, true);
  const stats = useNationStats(world ?? null, countryId);
  const country = world?.countries[countryId];
  if (!world || !country) return null;
  const silenced = country.alive && agent?.link === 'cut';
  const cls = useCardClass(ref, speaking, silenced, isShort);
  const silentYears = agent ? Math.max(0, world.tick - agent.lastHeardTick) : 0;

  let fallYear: number | null = null;
  if (!country.alive) {
    for (let i = world.chronicle.length - 1; i >= 0; i--) {
      const e = world.chronicle[i]!;
      if (e.kind === 'fall' && e.countries.includes(countryId)) { fallYear = e.year; break; }
    }
  }
  const treasury = economy.status === 'ok' ? economy.data?.nations.find((n) => n.countryId === countryId) : undefined;
  const ruler = country.council?.ruler ?? null;
  const rulerAge = ruler?.born != null ? Math.max(0, world.year - ruler.born) : null;
  const movement = movementOf(politicsOf(country).axis);
  const readiness = readinessOf(country);
  const coin = (economy.status === 'ok' && economy.data?.currency.symbol) || 'TNC';

  const label = (k: 'narration' | 'anthem') => {
    if (failed === k) return 'Voice unavailable';
    if (mine && state === k) return k === 'anthem' ? 'Stop anthem' : 'Stop';
    if (mine && state === 'loading' && pressed === k) return 'Loading...';
    return k === 'narration' ? 'Narrate' : 'Anthem';
  };
  const press = (k: 'narration' | 'anthem') => {
    if (mine && (state === k || (state === 'loading' && pressed === k))) { audio.stop(); setPressed(null); return; }
    setPressed(k);
    const p = k === 'narration' ? audio.playNarration(countryId) : audio.playAnthem(countryId);
    p.catch(() => {
      setFailed(k);
      if (failTimer.current) clearTimeout(failTimer.current);
      failTimer.current = setTimeout(() => setFailed(null), 3000);
    });
  };
  const button = (k: 'narration' | 'anthem') => {
    const on = mine && state === k;
    const busy = mine && state === 'loading' && pressed === k;
    return (
      <button type="button" className={`tn-button${on ? ' is-active' : ''}`} onClick={() => press(k)}>
        {on ? <StopSq /> : busy ? null : <Play />}
        {label(k)}
        {on && <Eq />}
      </button>
    );
  };

  const relations = world.relations
    .filter((r) => (r.a === countryId || r.b === countryId) && world.countries[r.a === countryId ? r.b : r.a]?.alive)
    .map((r) => ({ other: r.a === countryId ? r.b : r.a, stance: r.stance }))
    .sort((x, y) => STANCE_ORDER.indexOf(x.stance) - STANCE_ORDER.indexOf(y.stance));

  const text = (t: string | undefined, small = false, clamp = false) =>
    error ? null : loading || !lore ? <Lines /> : <p className={`tn-p tn-fade${small ? ' tn-small' : ''}${clamp ? ' tn-clamp' : ''}`}>{t}</p>;

  return (
    <div className={cls} ref={ref}>
      <span className="tn-cartouche tn-gov">{country.government}</span>
      <div className="tn-card-body">
        <header className="tn-head">
          <Flag countryId={countryId} spec={country.flag} />
          <div className="tn-head-text">
            <h2 className="tn-name tn-engraved">{country.name}</h2>
            {!country.alive && <div className="tn-fallen">{fallYear != null ? `Fallen in Y${fallYear}` : 'Fallen'}</div>}
          </div>
          <button type="button" className="tn-close tn-button tn-button--lacquer tn-button--round" aria-label="Close" onClick={() => select(null)}><CloseIcon /></button>
        </header>
        <div className="tn-ruler">
          <Portrait seed={ruler ? ruler.portraitSeed : null} role="ruler" color={country.color} size={isShort ? 34 : 42} bezel />
          <div className="tn-ruler-text">
            <span className="tn-cap">{ruler ? 'Ruler' : 'Led by'}</span>
            <span className="tn-ruler-name">{ruler ? ruler.name : country.leader}</span>
          </div>
          {rulerAge != null && <span className="tn-ruler-age" title={`Born in Y${ruler!.born}`}>aged {rulerAge}</span>}
        </div>
        {silenced && (
          <div className="tn-silence">
            <div className="tn-silence-top"><span className="tn-silence-cap">Link cut</span><span className="tn-silence-yrs">silent {silentYears} {silentYears === 1 ? 'yr' : 'yrs'}</span></div>
            <div className="tn-silence-txt">It rules on from the world as it knew it in Y{world.year - silentYears}.{!isShort && ' Its map no longer matches the truth.'}</div>
          </div>
        )}
        <div className="tn-pair">
          <div title={movement.creed}><span className="tn-cap">Movement</span><span className="tn-pair-v">{movement.name}</span></div>
          <div><span className="tn-cap">Main good</span><span className="tn-pair-v">{stats?.mainGood ? cap(stats.mainGood) : 'None'}</span></div>
        </div>
        <div className="tn-grid">
          <div className="tn-stat"><span className="tn-stat__label">Provinces</span><span className="tn-stat__value">{fmt(stats?.provinces ?? 0)}</span></div>
          <div className="tn-stat"><span className="tn-stat__label">Population</span><span className="tn-stat__value">{short(country.population)}</span></div>
          <div className="tn-stat"><span className="tn-stat__label">Treasury</span><span className="tn-stat__value">{fmt(country.treasury)}<small>{coin}</small></span></div>
          <div className="tn-stat" title="The summed strength of its armies and fleets"><span className="tn-stat__label">Army</span><span className="tn-stat__value">{fmt(stats?.army ?? 0)}</span></div>
        </div>
        <div className="tn-meters">
          <Meter label="Readiness" value={String(Math.round(readiness))} pct={readiness} fill={readinessFill(readiness)} seg
            title={`War readiness ${Math.round(readiness)} of 100: ${readinessBand(readiness)}`} />
          <Meter label="Devastation" value={`${Math.round(stats?.devastation ?? 0)}%`} pct={stats?.devastation ?? 0}
            fill={(stats?.devastation ?? 0) > 5 ? 'var(--color-rubric)' : 'var(--color-ink-muted)'} bad={(stats?.devastation ?? 0) > 5} title="Mean devastation of its provinces" />
          <Meter label="Unrest" value={`${Math.round(stats?.unrest ?? 0)}%`} pct={stats?.unrest ?? 0}
            fill={(stats?.unrest ?? 0) > 50 ? 'var(--color-rubric)' : 'var(--stance-hostile)'} bad={(stats?.unrest ?? 0) > 50} title="Mean unrest of the regions it holds" />
        </div>
        <section className="tn-dip" aria-label="Diplomacy">
          <h3 className="tn-header-bar">Diplomacy</h3>
          {!relations.some((r) => r.stance === 'war' || r.stance === 'alliance' || r.stance === 'trade') && (
            <p className="tn-dip-none">No wars, allies or trade pacts yet.</p>
          )}
          {DIPLOMACY.map(({ stance, label }) => {
            const group = relations.filter((r) => r.stance === stance);
            if (group.length === 0) return null;
            return (
              <div key={stance} className={`tn-dip-row tn-dip-${stance}`}>
                <span className="tn-dip-label">{label}</span>
                <span className="tn-dip-flags">
                  {group.map(({ other }) => {
                    const oc = world.countries[other]!;
                    return (
                      <button key={other} type="button" className="tn-dip-flag tn-flag-plate" title={oc.name} aria-label={`${label}: ${oc.name}`} onClick={() => { select(other); flyTo(other); }}
                        dangerouslySetInnerHTML={{ __html: flagSvg(oc.flag, 30, 20) }} />
                    );
                  })}
                </span>
              </div>
            );
          })}
        </section>
        <StatusChips world={world} countryId={countryId} plan={plan} />
        {treasury && (
          <div className="tn-treasury">
            {treasury.url
              ? <a href={treasury.url} target="_blank" rel="noopener noreferrer">Treasury on Solana</a>
              : <span>Treasury on Solana</span>}
            <span className="tn-treasury-bal">{fmt(treasury.onChain)} {economy.data!.currency.symbol}</span>
            <span className={`tn-treasury-sync${treasury.inSync ? '' : ' no'}`}>{treasury.inSync ? '\u2713 in sync' : 'syncing'}</span>
          </div>
        )}

        {country.council && (
          <Council countryId={countryId} council={country.council} color={country.color} tick={world.tick} short={isShort} frozen={!country.alive || !!agent?.deleted} />
        )}

        {!isShort && (
          <section className="tn-sec">
            {text(lore?.summary, false, true)}
            {error && (
              <p className="tn-muted">No lore is available yet. <button type="button" className="tn-link" onClick={retry}>Try again</button></p>
            )}
            {!error && (loading || !lore) && <p className="tn-muted" style={{ marginTop: 6 }}>Consulting the archives...</p>}
          </section>
        )}
        {isShort && error && (
          <p className="tn-muted">No lore is available yet. <button type="button" className="tn-link" onClick={retry}>Try again</button></p>
        )}

        <div className="tn-booktabs tn-booktabs--fill tn-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`tn-booktab${tab === t.id ? ' tn-booktab--active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="tn-tab-body" role="tabpanel">
          {tab === 'culture' && (
            <>
              <div className="tn-chips">{country.culture.map((c) => <span key={c} className="tn-chip">{c}</span>)}</div>
              {text(lore?.culture, true)}
            </>
          )}
          {tab === 'economy' && <EconomyTab world={world} countryId={countryId} plan={plan} />}
          {tab === 'politics' && (
            <>
              <p className="tn-ideology">{country.ideology}</p>
              <PoliticsBlock world={world} countryId={countryId} />
              {text(lore?.politics, true)}
            </>
          )}
          {tab === 'history' && text(lore?.history)}
          {tab === 'relations' && (
            relations.length === 0 ? <p className="tn-muted">No other nations yet.</p> : (
              <ul className="tn-rels">
                {relations.map(({ other, stance }) => {
                  const oc = world.countries[other]!;
                  const story = lore?.relations.find((r) => r.with === other)?.story;
                  return (
                    <li key={other}>
                      <button type="button" className="tn-rel" onClick={() => { select(other); flyTo(other); }}>
                        <span className="tn-rel-top">
                          <span className="tn-swatch" style={{ background: oc.color }} />
                          <span className="tn-rel-name">{oc.name}</span>
                          <span className={`tn-stance tn-chip tn-chip--caps tn-chip--${stance}`}>{stance}</span>
                        </span>
                        {story && <span className="tn-rel-story tn-fade">{story}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          )}
        </div>

        <div className="tn-foot">
          {button('narration')}
          {button('anthem')}
        </div>
        {speaking && (
          <>
            <div className="tn-progress tn-trough" aria-hidden="true"><div /></div>
            <div className="tn-now">{state === 'anthem' ? `Anthem of ${country.name}` : `Narration of ${country.name}`}</div>
          </>
        )}
        {mine && state === 'anthem' && lore && lore.anthemLyrics.length > 0 && (
          <div className="tn-lyrics tn-fade">
            {lore.anthemLyrics.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}
