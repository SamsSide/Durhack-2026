// Full-screen shell. Lane b owns this file after the seed.
import type { ComponentType, CSSProperties } from 'react';
import { Globe } from './globe';
import * as ui from './ui';
import { Chronicle, CreateScreen, DecreeBox, NationCard, NetworkPanel } from './ui';
import { useWorld } from './state/world';
import { EventFeed, LedgerPanel } from './hud/lookup';
import { BeliefBanner, useEconomyOn, ClosingCard, DiplomacyLegend, Minimap, MODES, TerrainLegend, TopBar, useTimelineOpen } from './hud';
import { HoverTooltip } from './globe/hover/HoverTooltip';
import { useEffect, useState } from 'react';
import { TimelineScrubber } from './globe/timeline';   // B9 timeline (lane a)

// Lane c's NewsBroadcast (X5); resolved at run time so the app builds before it lands.
const NewsBroadcast = (ui as unknown as Record<string, ComponentType | undefined>).NewsBroadcast;

const overlay: CSSProperties = { position: 'absolute', zIndex: 5 };

export function App() {
  const world = useWorld((s) => s.world);
  const selected = useWorld((s) => s.selectedCountryId);
  const regionId = useWorld((s) => s.selectedRegionId);
  const [creating, setCreating] = useState(false);
  const timelineOpen = useTimelineOpen();
  const econOn = useEconomyOn();
  const [ledgerOpen, setLedgerOpen] = useState(false);
  // Keep the card mounted while its slide-out plays.
  const [dock, setDock] = useState<{ id: number; regionId: number | null } | null>(null);
  const [dockOut, setDockOut] = useState(false);
  useEffect(() => {
    if (selected != null) { setDock({ id: selected, regionId }); setDockOut(false); return; }
    setDockOut(true);
    const t = window.setTimeout(() => setDock(null), 240);
    return () => window.clearTimeout(t);
  }, [selected, regionId]);
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
      {world && <div style={{ ...overlay, top: 64, left: 'var(--space-4)', bottom: 'calc(var(--space-4) + var(--ticker-height) + var(--space-3))' }}><NetworkPanel /></div>}
      {world && econOn && LedgerPanel && (
        <div className="ledger-slot">
          <button className="btn ledger-toggle" onClick={() => setLedgerOpen((o) => !o)}>{ledgerOpen ? 'Hide ledger' : 'Ledger'}</button>
          {ledgerOpen && <div className="ledger-body"><LedgerPanel /></div>}
        </div>
      )}
      {world && <Minimap hidden={timelineOpen} />}
      {world && dock && <div className={`hud card-dock${dockOut ? ' out' : ''}`}><NationCard countryId={dock.id} regionId={dock.regionId} /></div>}
      <DiplomacyLegend hidden={timelineOpen} />
      <TerrainLegend hidden={timelineOpen} />
      {world && !timelineOpen && <div className="hud decree-slot"><DecreeBox /></div>}
      {/* B9 timeline (lane a): the history scrubber, in the band above the chronicle ticker */}
      {world && !showCreate && <TimelineScrubber />}
      {world && <div style={{ ...overlay, left: 'var(--space-4)', right: 'var(--space-4)', bottom: 'var(--space-4)' }}><Chronicle /></div>}
      {world && EventFeed && <div className="event-feed-slot"><EventFeed /></div>}
      {world && NewsBroadcast && (
        <div className="news-slot"><NewsBroadcast /></div>
      )}
      <ClosingCard />
      {world && <HoverTooltip />}
      {showCreate && (
        <div style={{ ...overlay, inset: 0, zIndex: 10, background: 'color-mix(in srgb, var(--color-bg) 38%, transparent)', display: 'grid', placeItems: 'center' }} onClick={() => world && setCreating(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <CreateScreen />
          </div>
        </div>
      )}
    </div>
  );
}
