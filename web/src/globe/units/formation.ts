// Army formations (#287, X4 "Army formations"): where each figure stands, in figure spacings.
// x is across the march (right is +), z along it (forward is +). Lane b.
import type { FormationRole } from './unitModels';

export interface Slot { role: FormationRole; x: number; z: number }

const F = 0.3, L = 0.55, B = -0.85;

/** 3 to 7 slots: front line, a flank either side and slightly forward, ranged or support behind. */
const LAYOUTS: Slot[][] = [
  // 3: front, one flank, back
  [{ role: 'front', x: 0, z: F }, { role: 'flank', x: 1.15, z: L }, { role: 'back', x: 0, z: B }],
  // 4: front, both flanks, back
  [{ role: 'front', x: 0, z: F }, { role: 'flank', x: -1.2, z: L }, { role: 'flank', x: 1.2, z: L }, { role: 'back', x: 0, z: B }],
  // 5: two in front
  [{ role: 'front', x: -0.5, z: F }, { role: 'front', x: 0.5, z: F }, { role: 'flank', x: -1.5, z: L }, { role: 'flank', x: 1.5, z: L }, { role: 'back', x: 0, z: B }],
  // 6: three in front
  [{ role: 'front', x: -0.9, z: F }, { role: 'front', x: 0, z: F }, { role: 'front', x: 0.9, z: F }, { role: 'flank', x: -1.9, z: L }, { role: 'flank', x: 1.9, z: L }, { role: 'back', x: 0, z: B }],
  // 7: two behind
  [{ role: 'front', x: -0.9, z: F }, { role: 'front', x: 0, z: F }, { role: 'front', x: 0.9, z: F }, { role: 'flank', x: -1.9, z: L }, { role: 'flank', x: 1.9, z: L }, { role: 'back', x: -0.55, z: B }, { role: 'back', x: 0.55, z: B }],
];

/** Figures grow with strength: under 20 is 3, then one more every 10 or so, 7 from 55. */
export function figureCount(strength: number): number {
  if (strength < 20) return 3;
  if (strength < 30) return 4;
  if (strength < 40) return 5;
  if (strength < 55) return 6;
  return 7;
}

export function formationSlots(strength: number): readonly Slot[] {
  return LAYOUTS[figureCount(strength) - 3]!;
}
