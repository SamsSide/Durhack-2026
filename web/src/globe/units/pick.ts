// #311: lets the click handler (camera/usePicking.ts) ask the unit layer which army is under the
// pointer, without the two components sharing a ref. Lane b.
import type * as THREE from 'three';

export const armyPicker: { current: ((ndc: THREE.Vector2, camera: THREE.Camera, viewW: number, viewH: number) => string | null) | null } = { current: null };
