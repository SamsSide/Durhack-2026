// Tile ownership as one nation's own replica sees it (X2 `belief`). Kept outside the fixed X5 store.
import { create } from 'zustand';

interface BeliefStore {
  countryId: number | null;
  owner: number[] | null;
  set(countryId: number | null, owner: number[] | null): void;
}

export const useBelief = create<BeliefStore>((set) => ({
  countryId: null,
  owner: null,
  set: (countryId, owner) => set({ countryId, owner }),
}));
