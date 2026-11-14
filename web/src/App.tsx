// Full-screen shell. Lane b owns this file after the seed.
import type { ComponentType, CSSProperties } from 'react';
import { Globe } from './globe';
import * as ui from './ui';
import { Chronicle, Collapsible, CreateScreen, DecreeBox, HourglassIcon, NationCard, NetworkPanel, PreparePanel, PresentationYear, QuillIcon, ScrollIcon, usePresentationKeys } from './ui';
import { useWorld } from './state/world';
import { EventFeed } from './hud/lookup';
import { BeliefBanner, ClosingCard, DiplomacyLegend, Minimap, MODES, TerrainLegend, TopBar, useTimelineOpen, WealthLegend, PoliticsLegend } from './hud';
import { HoverTooltip } from './globe/hover/HoverTooltip';
import { useEffect, useState } from 'react';
import { TimelineScrubber } from './globe/timeline';   // B9 timeline (lane a)

// Lane c's NewsBroadcast (X5); resolved at run time so the app builds before it lands.
const NewsBroadcast = (ui as unknown as Record<string, ComponentType | undefined>).NewsBroadcast;

const overlay: CSSProperties = { position: 'absolute', zIndex: 5 };

export function App() {
  const world = useWorld((s) => s.world);
  const epoch = useWorld((s) => s.epoch);   // new world: remount per-world panels so no old state survives
  const selected = useWorld((s) => s.selectedCountryId);
  const regionId = useWorld((s) => s.selectedRegionId);
  const [creating, setCreating] = useState(false);
  const timelineOpen = useTimelineOpen();
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
  usePresentationKeys();   // P toggles presentation mode, Esc leaves it (C16)
  useEffect(() => setCreating(false), [world?.id]);
  useEffect(() => { setDock(null); setDockOut(false); }, [epoch]);
  const showCreate = !world || creating;
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Globe />
      <div className="tn-scrim" />
      <TopBar onCreate={() => setCreating(true)} />
      <BeliefBanner />
      {world && <div className="left-net" style={{ ...overlay, top: 76, left: 'var(--space-4)', bottom: 'calc(var(--space-4) + var(--ticker-height) + var(--space-3))' }}><NetworkPanel key={epoch} /></div>}
      {world && <Minimap hidden={timelineOpen} />}
      {/* Calm UI (#245): the card docks on the LEFT, under the folded Network tab; only one left panel is open at a time */}
      {world && dock && <div className={`hud left-dock${dockOut ? ' out' : ''}`}><NationCard key={epoch} countryId={dock.id} regionId={dock.regionId} /></div>}
      <DiplomacyLegend hidden={timelineOpen} />
      <TerrainLegend hidden={timelineOpen} />
      <WealthLegend hidden={timelineOpen} />
      <PoliticsLegend hidden={timelineOpen} />
      {/* Start collapsed (C16, #276): the decree box is one quill icon until opened. */}
      {world && !timelineOpen && (
        <Collapsible id="decree" label="the decree box" icon={<QuillIcon />} wrapClass="hud decree-slot"><DecreeBox key={epoch} /></Collapsible>
      )}
      {/* B9 timeline (lane a): the history scrubber, in the band above the chronicle ticker */}
      {world && !showCreate && (
        <Collapsible id="history" label="the history strip" icon={<HourglassIcon />} chevron="above-left"><TimelineScrubber /></Collapsible>
      )}
      {/* While the Chronicle timeline sheet is open it rides above the news slot (6) and the history scrubber (5). */}
      {/* The Chronicle stays mounted when collapsed (it also renders the war tabs and the timeline sheet); only its ticker hides. */}
      {world && (
        <Collapsible id="chronicle" label="the chronicle" icon={<ScrollIcon />} keepMounted wrapStyle={{ ...overlay, zIndex: timelineOpen ? 7 : 5, left: 'var(--space-4)', right: 'var(--space-4)', bottom: 'var(--space-4)' }}><Chronicle key={epoch} /></Collapsible>
      )}
      {world && EventFeed && <div className="event-feed-slot"><EventFeed key={epoch} /></div>}
      {world && NewsBroadcast && (
        <div className="news-slot"><NewsBroadcast key={epoch} /></div>
      )}
      {world && !showCreate && <PreparePanel />}
      <PresentationYear />
      <ClosingCard />
      {world && <HoverTooltip />}
      {showCreate && (
        <div style={{ ...overlay, inset: 0, zIndex: 10, background: 'radial-gradient(ellipse at center, rgba(5,6,10,.35), rgba(5,6,10,.7))', display: 'grid', placeItems: 'center' }} onClick={() => world && setCreating(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <CreateScreen />
          </div>
        </div>
      )}
    </div>
  );
}
