// Camera fly-to request, read by the globe. Kept outside the fixed X5 store.
import { create } from 'zustand';

interface CameraStore {
  target: number | null;      // country id to fly to
  nonce: number;              // bumps on every request so the same target can be re-requested
  request(countryId: number): void;
}

export const useCamera = create<CameraStore>((set, get) => ({
  target: null,
  nonce: 0,
  request: (countryId) => set({ target: countryId, nonce: get().nonce + 1 }),
}));
