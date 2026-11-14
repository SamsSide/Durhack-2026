import { useEffect, useRef, useState } from 'react';
import { flagSvg } from '@terra/shared';
import type { Stance } from '@terra/shared';
import { useWorld } from '../../state/world';
import { audio } from '../../audio';
import { useAudio } from '../../audio/useAudio';
import { RegionView } from './RegionView';
import { useLore } from './useLore';
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
      <div className="tn-flag-drawn" dangerouslySetInnerHTML={{ __html: flagSvg(spec, 90, 60) }} />
      {painted && (
        <img className={`tn-flag-painted ${shown ? 'tn-on' : ''}`} src={painted} alt="" width={90} height={60} onLoad={() => setShown(true)} />
      )}
    </div>
  );
}

function Lines() {
  return (
    <div className="tn-card-lines" aria-hidden="true">
      <span className="tn-shimmer" /><span className="tn-shimmer" /><span className="tn-shimmer tn-short" />
    </div>
  );
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');

export function NationCard({ countryId, regionId }: { countryId: number; regionId?: number | null }) {
  if (typeof regionId === 'number') return <RegionView regionId={regionId} />;
  return <Nation countryId={countryId} />;
}

function Nation({ countryId }: { countryId: number }) {
  useWorld((s) => s.version);
  const world = useWorld((s) => s.world);
  const agents = useWorld((s) => s.agents);
  const select = useWorld((s) => s.select);
  const flyTo = useWorld((s) => s.flyTo);
  const { lore, loading, error, retry } = useLore(countryId);
  const { state, countryId: playing } = useAudio();
  const [pressed, setPressed] = useState<'narration' | 'anthem' | null>(null);
  const [failed, setFailed] = useState<'narration' | 'anthem' | null>(null);
  const failTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (failTimer.current) clearTimeout(failTimer.current); }, []);

  const country = world?.countries[countryId];
  if (!world || !country) return null;

  const agent = agents.find((a) => a.countryId === countryId);
  const badges: string[] = [];
  if (agent?.link === 'cut') badges.push('Link cut');
  if (agent?.ruler === 'autopilot') badges.push('Ruler silent');
  if (agent?.deleted) badges.push('Deleted');
  if (!country.alive) badges.push('Fallen');

  const mine = playing === countryId;
  const kind = (k: 'narration' | 'anthem') => {
    if (failed === k) return 'Voice unavailable';
    if (mine && state === k) return 'Stop';
    if (mine && state === 'loading' && pressed === k) return 'Summoning...';
    return k === 'narration' ? 'Hear their story' : 'Play anthem';
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

  const relations = world.relations
    .filter((r) => (r.a === countryId || r.b === countryId) && world.countries[r.a === countryId ? r.b : r.a])
    .map((r) => ({ other: r.a === countryId ? r.b : r.a, stance: r.stance }))
    .sort((x, y) => STANCE_ORDER.indexOf(x.stance) - STANCE_ORDER.indexOf(y.stance));

  const section = (title: string, text: string | undefined) => (
    <section className="tn-section" key={title}>
      <h3 className="tn-h">{title}</h3>
      {error ? null : loading || !lore ? <Lines /> : <p className="tn-p tn-fade">{text}</p>}
    </section>
  );

  return (
    <div className="tn-card">
      <div className="tn-card-body">
        <header className="tn-head">
          <Flag countryId={countryId} spec={country.flag} />
          <div className="tn-head-text">
            <h2 className="tn-name">{country.name}</h2>
            <div className="tn-sub">{country.government} &middot; led by {country.leader}</div>
          </div>
        </header>
        {badges.length > 0 && (
          <div className="tn-badges">{badges.map((b) => <span key={b} className="tn-badge">{b}</span>)}</div>
        )}
        <p className="tn-ideology">{country.ideology}</p>
        <div className="tn-chips">{country.culture.map((c) => <span key={c} className="tn-chip">{c}</span>)}</div>
        <div className="tn-figures">
          <div><span className="tn-fig-n">{fmt(country.population)}</span><span className="tn-fig-l">Population</span></div>
          <div><span className="tn-fig-n">{fmt(country.treasury)}</span><span className="tn-fig-l">Treasury</span></div>
        </div>

        <div className="tn-sound">
          <button type="button" className="tn-btn" onClick={() => press('narration')}>{kind('narration')}</button>
          <button type="button" className="tn-btn" onClick={() => press('anthem')}>{kind('anthem')}</button>
        </div>
        {mine && state === 'anthem' && lore && lore.anthemLyrics.length > 0 && (
          <div className="tn-lyrics tn-fade">
            {lore.anthemLyrics.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}

        {error ? (
          <section className="tn-section">
            <p className="tn-muted">The archives are silent. <button type="button" className="tn-link" onClick={retry}>Try again</button></p>
          </section>
        ) : (
          <>
            {section('Who they are', lore?.summary)}
            {section('Culture', lore?.culture)}
            {section('Politics', lore?.politics)}
            {section('History', lore?.history)}
          </>
        )}

        {relations.length > 0 && (
          <section className="tn-section">
            <h3 className="tn-h">Relations</h3>
            <ul className="tn-rels">
              {relations.map(({ other, stance }) => {
                const oc = world.countries[other]!;
                const story = lore?.relations.find((r) => r.with === other)?.story;
                return (
                  <li key={other}>
                    <button type="button" className="tn-rel" onClick={() => { select(other); flyTo(other); }}>
                      <span className="tn-rel-flag" dangerouslySetInnerHTML={{ __html: flagSvg(oc.flag, 24, 16) }} />
                      <span className="tn-rel-main">
                        <span className="tn-rel-top">
                          <span className="tn-rel-name">{oc.name}</span>
                          <span className={`tn-stance tn-stance-${stance}`}>{stance}</span>
                        </span>
                        {story && <span className="tn-rel-story tn-fade">{story}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
