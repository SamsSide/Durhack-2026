import { createContext, useContext } from 'react';
import type { ProvinceMesh } from './buildProvinceMesh';

export const ProvinceMeshContext = createContext<ProvinceMesh | null>(null);

export function useProvinceMesh(): ProvinceMesh | null {
  return useContext(ProvinceMeshContext);
}
