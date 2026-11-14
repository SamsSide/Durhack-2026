import { useEffect, useState } from 'react';
import { flagSvg } from '@terra/shared';
import { useWorld } from '../state/world';
import { audio } from '../audio';
import { useAudio } from '../audio/useAudio';

interface Lore { summary: string; culture: string; politics: string; history: string }

export function NationCard({ countryId }: { countryId: number; regionId?: number | null }) {
  const country = useWorld((s) => s.world?.countries[countryId]);
  const [lore, setLore] = useState<Lore | null>(null);
  const [loreError, setLoreError] = useState(false);
  const { state, countryId: playing } = useAudio();

  useEffect(() => {
    setLore(null); setLoreError(false);
    let live = true;
    fetch(`/api/country/${countryId}/lore`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((l: Lore) => { if (live) setLore(l); })
      .catch(() => { if (live) setLoreError(true); });
    return () => { live = false; };
  }, [countryId]);

  if (!country) return null;
  const active = playing === countryId ? state : 'idle';
  return (
    <div className="panel" style={{ width: 380 }}>
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <div style={{ border: '1px solid var(--color-ink)', lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: flagSvg(country.flag, 90, 60) }} />
        <div>
          <h2 style={{ margin: 0 }}>{country.name}</h2>
          <div className="muted">Led by {country.leader}</div>
        </div>
      </div>
      <div><b>Government</b> {country.government}</div>
      <div style={{ marginBottom: 'var(--space-2)' }}><b>Ideology</b> {country.ideology}</div>
      <div className="muted">
        Population {country.population.toLocaleString()} / Treasury {country.treasury.toLocaleString()}
        {!country.alive && ' / fallen'}
      </div>
      <h3 style={{ marginTop: 'var(--space-3)' }}>Lore</h3>
      {!lore && !loreError && <div className="muted">Consulting the archives...</div>}
      {loreError && <div className="muted">No lore is available yet.</div>}
      {lore && (
        <div style={{ fontSize: 14, lineHeight: 1.4 }}>
          <p style={{ margin: '0 0 var(--space-2)' }}>{lore.summary}</p>
          <p style={{ margin: 0 }} className="muted">{lore.history}</p>
        </div>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
        <button className="btn" onClick={() => (active === 'narration' ? audio.stop() : audio.playNarration(countryId))}>
          {active === 'narration' ? 'Stop' : active === 'loading' ? 'Loading...' : 'Narrate'}
        </button>
        <button className="btn" onClick={() => (active === 'anthem' ? audio.stop() : audio.playAnthem(countryId))}>
          {active === 'anthem' ? 'Stop' : 'Anthem'}
        </button>
      </div>
    </div>
  );
}
