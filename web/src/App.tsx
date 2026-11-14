// Full-screen shell. Lane b owns this file after the seed.
import type { CSSProperties } from 'react';
import { Globe } from './globe/Globe';
import { Chronicle, CreateScreen, NationCard, NetworkPanel } from './ui';
import { useWorld } from './state/world';
import type { WorldStore } from './state/world';
import { useEffect, useState } from 'react';

const MODES: WorldStore['mapMode'][] = ['political', 'terrain', 'diplomacy', 'strength'];
const SPEEDS = [1, 2, 4, 8];

const overlay: CSSProperties = { position: 'absolute', zIndex: 5 };

function TopBar({ onCreate }: { onCreate: () => void }) {
  const world = useWorld((s) => s.world);
  useWorld((s) => s.version);
  const connected = useWorld((s) => s.connected);
  const budget = useWorld((s) => s.budget);
  const mapMode = useWorld((s) => s.mapMode);
  const setMapMode = useWorld((s) => s.setMapMode);
  const send = useWorld((s) => s.send);
  return (
    <div style={{ ...overlay, top: 0, left: 0, right: 0, height: 44, display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '0 var(--space-4)', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
      <span title={connected ? 'connected' : 'disconnected'} style={{ width: 10, height: 10, borderRadius: '50%', background: connected ? 'var(--color-ok)' : 'var(--color-danger)' }} />
      <b style={{ fontVariant: 'small-caps', letterSpacing: '0.05em' }}>{world?.name ?? 'Terra Nova'}</b>
      {world && <span style={{ color: 'var(--color-text-muted)' }}>Year {world.year}</span>}
      <span style={{ flex: 1 }} />
      {world && (
        <>
          {SPEEDS.map((v) => (
            <button key={v} className={`btn ${world.speed === v && !world.paused ? 'active' : ''}`} onClick={() => { send({ type: 'control', action: 'pause', value: false }); send({ type: 'control', action: 'speed', value: v }); }}>{v}x</button>
          ))}
          <button className={`btn ${world.paused ? 'active' : ''}`} onClick={() => send({ type: 'control', action: 'pause', value: !world.paused })}>Pause</button>
          <select className="btn" value={mapMode} onChange={(e) => setMapMode(e.target.value as WorldStore['mapMode'])}>
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </>
      )}
      {budget && <span style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{budget.mode} / {budget.calls} calls{budget.capped ? ' (capped)' : ''}</span>}
      <button className="btn" onClick={onCreate}>New world</button>
    </div>
  );
}

export function App() {
  const world = useWorld((s) => s.world);
  const selected = useWorld((s) => s.selectedCountryId);
  const regionId = useWorld((s) => s.selectedRegionId);
  const [creating, setCreating] = useState(false);
  useEffect(() => setCreating(false), [world?.id]);
  const showCreate = !world || creating;
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Globe />
      <TopBar onCreate={() => setCreating(true)} />
      {world && <div style={{ ...overlay, top: 56, left: 'var(--space-3)', bottom: 170 }}><NetworkPanel /></div>}
      {world && selected != null && <div style={{ ...overlay, top: 56, right: 'var(--space-3)' }}><NationCard countryId={selected} regionId={regionId} /></div>}
      {world && <div style={{ ...overlay, left: 'var(--space-3)', right: 'var(--space-3)', bottom: 'var(--space-3)' }}><Chronicle /></div>}
      {showCreate && (
        <div style={{ ...overlay, inset: 0, zIndex: 10, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center' }} onClick={() => world && setCreating(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <CreateScreen />
          </div>
        </div>
      )}
    </div>
  );
}
