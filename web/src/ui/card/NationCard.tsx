import { useEffect, useRef, useState } from 'react';
import { flagSvg } from '@terra/shared';
import type { Stance } from '@terra/shared';
import { useWorld } from '../../state/world';
import { audio } from '../../audio';
import { useAudio } from '../../audio/useAudio';
import { useEconomy } from '../economy/useEconomy';
import '../economy/economy.css';
import { Council } from './Council';
import { RegionView } from './RegionView';
import { useLore } from './useLore';
import { EconomyTab, PoliticsBlock, StatusChips, useMarketPlan } from './Economy';
import { CloseIcon, Lines, useCardClass, useShort } from './shared';
import './card.css';

const STANCE_ORDER: Stance[] = ['war', 'hostile', 'alliance', 'trade', 'neutral'];

// Painted flag results, once per country per page load. A string is an object URL, null is "none".
const paintedCache = new Map<number, string | null>();

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
    <div className="tn-flag">
      <div className="tn-flag-drawn" dangerouslySetInnerHTML={{ __html: flagSvg(spec, 66, 44) }} />
      {painted && (
        <img className={`tn-flag-painted ${shown ? 'tn-on' : ''}`} src={painted} alt="" width={66} height={44} onLoad={() => setShown(true)} />
      )}
    </div>
  );
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}K` : fmt(n));

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
  let provinces = 0;
  for (const o of world.owner) if (o === countryId) provinces++;

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
      <button type="button" className={`btn${on ? ' active' : ''}`} onClick={() => press(k)}>
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
      <div className="tn-card-body">
        <header className="tn-head">
          <Flag countryId={countryId} spec={country.flag} />
          <div className="tn-head-text">
            <div className="tn-gov">{country.government}</div>
            <h2 className="tn-name">{country.name}</h2>
            <div className="tn-sub">Led by {country.leader}</div>
            {!country.alive && <div className="tn-fallen">{fallYear != null ? `Fallen in Y${fallYear}` : 'Fallen'}</div>}
          </div>
          <button type="button" className="tn-close" aria-label="Close" onClick={() => select(null)}><CloseIcon /></button>
        </header>
        {silenced ? (
          <div className="tn-silence">
            <div className="tn-silence-top"><span className="tn-silence-cap">Link cut</span><span className="tn-silence-yrs">silent {silentYears} {silentYears === 1 ? 'yr' : 'yrs'}</span></div>
            <div className="tn-silence-txt">It rules on from the world as it knew it in Y{world.year - silentYears}.{!isShort && ' Its map no longer matches the truth.'}</div>
          </div>
        ) : (
          <p className="tn-ideology">{country.ideology}</p>
        )}
        <div className="tn-facts">
          <div><span className="tn-cap">Provinces</span><span className="tn-v">{fmt(provinces)}</span></div>
          <div><span className="tn-cap">Population</span><span className="tn-v">{short(country.population)}</span></div>
          <div><span className="tn-cap">Treasury</span><span className="tn-v">{fmt(country.treasury)}</span></div>
        </div>
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

        <div className="tn-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`tn-tab${tab === t.id ? ' tn-on' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="tn-tab-body" role="tabpanel">
          {tab === 'culture' && (
            <>
              <div className="tn-chips">{country.culture.map((c) => <span key={c} className="chip">{c}</span>)}</div>
              {text(lore?.culture, true)}
            </>
          )}
          {tab === 'economy' && <EconomyTab world={world} countryId={countryId} plan={plan} />}
          {tab === 'politics' && (
            <>
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
                          <span className={`tn-stance tn-stance-${stance}`}>{stance}</span>
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
            <div className="tn-progress" aria-hidden="true"><div /></div>
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
