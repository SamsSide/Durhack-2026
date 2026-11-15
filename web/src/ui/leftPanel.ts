// Calm UI (#245): one left panel at a time. The nation card and the Network panel share the left
// edge; opening one closes the other. The card is open while a nation is selected (X5), so this
// store only holds the Network panel's side and keeps the two in step.
import { create } from 'zustand';
import { useWorld } from '../state/world';

const FOLD_KEY = 'tn-network-folded';
function writeOpen(open: boolean): void {
  try { localStorage.setItem(FOLD_KEY, open ? '0' : '1'); } catch { /* storage unavailable */ }
}

export type LeftPanel = 'none' | 'network' | 'card';

interface LeftPanelStore {
  networkOpen: boolean;
  /** The nation picked on the Network graph. Opening the panel over a nation's card picks that nation. */
  pick: number | null;
  setPick(id: number | null): void;
  /** Open or fold the Network panel. Opening it closes the nation card. */
  setNetworkOpen(open: boolean): void;
}

export const useLeftPanel = create<LeftPanelStore>((set) => ({
  // A card that is already open wins over a remembered open panel.
  // Owner (#275): every reload starts calm, so the Network panel always starts folded for the next judge.
  networkOpen: false,
  pick: null,
  setPick: (id) => set({ pick: id }),
  setNetworkOpen: (open) => {
    // The card and the panel share the left edge, so the card closes; the nation it showed stays
    // picked on the graph, ready for Cut and Show beliefs without a second click.
    const sel = open ? useWorld.getState().selectedCountryId : null;
    if (sel != null) useWorld.getState().select(null);
    writeOpen(open);
    set(sel != null ? { networkOpen: open, pick: sel } : { networkOpen: open });
  },
}));

// Selecting a nation or province opens its card, which folds the Network panel.
useWorld.subscribe((s, prev) => {
  if (s.selectedCountryId != null && prev.selectedCountryId == null && useLeftPanel.getState().networkOpen) {
    useLeftPanel.getState().setNetworkOpen(false);
  }
});

/** Which panel holds the left edge right now. */
export function useLeftPanelKind(): LeftPanel {
  const networkOpen = useLeftPanel((s) => s.networkOpen);
  const selected = useWorld((s) => s.selectedCountryId);
  // An army or battle card also fills the left slot, so the camera makes room for it too.
  const army = useWorld((s) => s.selectedUnitId != null || s.selectedBattleTile != null);
  return selected != null || army ? 'card' : networkOpen ? 'network' : 'none';
}
