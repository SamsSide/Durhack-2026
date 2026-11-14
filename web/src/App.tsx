// Full-screen shell. Lane b owns this file after the seed.
import type { CSSProperties } from 'react';
import { Globe } from './globe';
import { Chronicle, CreateScreen, NationCard, NetworkPanel } from './ui';
import { useWorld } from './state/world';
import { BeliefBanner, DecreeBox, DiplomacyLegend, MODES, TopBar } from './hud';
import { useEffect, useState } from 'react';

const overlay: CSSProperties = { position: 'absolute', zIndex: 5 };

export function App() {
  const world = useWorld((s) => s.world);
  const selected = useWorld((s) => s.selectedCountryId);
  const regionId = useWorld((s) => s.selectedRegionId);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      const m = MODES[Number(e.key) - 1];
      if (m) useWorld.getState().setMapMode(m);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => setCreating(false), [world?.id]);
  const showCreate = !world || creating;
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Globe />
      <TopBar onCreate={() => setCreating(true)} />
      <BeliefBanner />
      {world && <div style={{ ...overlay, top: 'calc(var(--topbar-height) + var(--space-3))', left: 'var(--space-3)', bottom: 170 }}><NetworkPanel /></div>}
      {world && selected != null && <div className="hud card-dock"><NationCard countryId={selected} regionId={regionId} /></div>}
      <DiplomacyLegend />
      {world && <DecreeBox />}
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
