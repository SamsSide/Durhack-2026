// #311: the left dock for a selected army or battle. It slides in like the nation card (#254) and
// shows lane a's ArmyCard / BattleCard from web/src/ui/index.ts once they exist (looked up at run
// time, like NewsBroadcast), and until then, in dev builds only, the plain debug card. Lane b.
import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import * as ui from '../ui';
import { useLeftPanel } from '../ui';
import { useWorld } from '../state/world';
import { ArmyBattleDebug } from './ArmyBattleDebug';

const cards = ui as unknown as Record<string, ComponentType<Record<string, unknown>> | undefined>;

type Pick = { kind: 'army'; unitId: string } | { kind: 'battle'; tile: number };

// One left panel at a time (#245): picking an army or battle folds the Network panel, and opening
// the Network panel drops the pick.
useWorld.subscribe((s, prev) => {
  const picked = s.selectedUnitId != null || s.selectedBattleTile != null;
  const was = prev.selectedUnitId != null || prev.selectedBattleTile != null;
  if (picked && !was && useLeftPanel.getState().networkOpen) useLeftPanel.getState().setNetworkOpen(false);
});
useLeftPanel.subscribe((s, prev) => {
  if (s.networkOpen && !prev.networkOpen) useWorld.setState({ selectedUnitId: null, selectedBattleTile: null });
});

export function ArmyBattleDock() {
  const epoch = useWorld((s) => s.epoch);
  const unitId = useWorld((s) => s.selectedUnitId);
  const tile = useWorld((s) => s.selectedBattleTile);
  // keep the card mounted while its slide-out plays (the same as the nation card in App.tsx)
  const [shown, setShown] = useState<Pick | null>(null);
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (unitId != null) { setShown({ kind: 'army', unitId }); setOut(false); return; }
    if (tile != null) { setShown({ kind: 'battle', tile }); setOut(false); return; }
    setOut(true);
    const t = window.setTimeout(() => setShown(null), 240);
    return () => window.clearTimeout(t);
  }, [unitId, tile]);
  useEffect(() => { setShown(null); setOut(false); }, [epoch]);
  if (!shown) return null;
  const Card = shown.kind === 'army' ? cards.ArmyCard : cards.BattleCard;
  const props = shown.kind === 'army' ? { unitId: shown.unitId } : { tile: shown.tile };
  let body = null;
  if (Card) body = <Card key={`${epoch}-${shown.kind}`} {...props} />;
  else if (import.meta.env.DEV) body = <ArmyBattleDebug key={`${epoch}-${shown.kind}`} {...props} />;
  if (!body) return null;
  return <div className={`hud left-dock${out ? ' out' : ''}`}>{body}</div>;
}
