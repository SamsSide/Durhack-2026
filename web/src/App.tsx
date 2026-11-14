// Full-screen shell. Lane b owns this file after the seed.
import type { CSSProperties } from 'react';
import { Globe } from './globe';
import { Chronicle, CreateScreen, DecreeBox, NationCard, NetworkPanel } from './ui';
import { useWorld } from './state/world';
import { BeliefBanner, DiplomacyLegend, MODES, TopBar } from './hud';
import { useEffect, useState } from 'react';

const overlay: CSSProperties = { position: 'absolute', zIndex: 5 };

// The chronicle's timeline sits where the decree box is, so hide the box while it is open.
function useTimelineOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => setOpen(!!document.querySelector('.tn-chron-timeline'));
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return open;
}

export function App() {
  const world = useWorld((s) => s.world);
  const selected = useWorld((s) => s.selectedCountryId);
  const regionId = useWorld((s) => s.selectedRegionId);
  const [creating, setCreating] = useState(false);
  const timelineOpen = useTimelineOpen();
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
      {world && selected != null && <div className="hud card-dock" data-hologram><NationCard countryId={selected} regionId={regionId} /></div>}
      <DiplomacyLegend />
      {world && !timelineOpen && <div className="hud decree-slot"><DecreeBox /></div>}
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
