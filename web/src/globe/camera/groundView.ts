// Ground view: zoom right in and the orbit camera tilts until it looks along the surface, so walls and
// the sides of buildings show. The numbers and the shared state live here so other layers can match
// them (for example to fade labels). Built by lane a in lane b's camera code (owner decision, 14 Nov).
import type { World } from '@terra/shared';
import { tileHeight } from '../mesh/buildProvinceMesh';

/** Height of the orbit camera above the local ground where the tilt starts (top-down above this). */
export const GROUND_START = 0.45;
/** Height at which the tilt is complete. */
export const GROUND_FULL = 0.19;
/** Closest the camera gets to its ground point (the wheel stops here). */
export const GROUND_MIN = 0.13;
/** Pitch away from straight down at the closest zoom, in radians (75 degrees). */
export const GROUND_PITCH = (75 * Math.PI) / 180;
/** The camera never sits lower than this above the terrain under it (clears walls and roofs). */
export const GROUND_CLEARANCE = 0.032;

/** 0 in the normal top-down orbit, 1 in full ground view: an ease in-out of the height above ground. */
export function groundTilt(height: number): number {
  const u = Math.min(1, Math.max(0, (GROUND_START - height) / (GROUND_START - GROUND_FULL)));
  return u * u * (3 - 2 * u);
}

/** Live camera state, written once per frame by CameraRig. Read it, never replace it. */
export const groundView = {
  /** 0 top-down orbit .. 1 full ground view. */
  tilt: 0,
  /** Look direction turned around the local normal, radians, 0 = north up. */
  heading: 0,
  /** Camera height above the terrain right under it. */
  height: 1,
};

/** Nearest-tile lookup by walking neighbours from the last answer (the camera moves a little per frame). */
export class TerrainLookup {
  private dirs: Float32Array;
  private heights: Float32Array;
  private last = 0;

  constructor(private world: World) {
    const n = world.tiles.length;
    this.dirs = new Float32Array(n * 3);
    this.heights = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = world.tiles[i]!;
      const c = t.center;
      const l = Math.hypot(c[0], c[1], c[2]) || 1;
      this.dirs[i * 3] = c[0] / l;
      this.dirs[i * 3 + 1] = c[1] / l;
      this.dirs[i * 3 + 2] = c[2] / l;
      this.heights[i] = tileHeight(t);
    }
  }

  private dot(i: number, x: number, y: number, z: number): number {
    return this.dirs[i * 3]! * x + this.dirs[i * 3 + 1]! * y + this.dirs[i * 3 + 2]! * z;
  }

  /** Tile whose centre is nearest to the direction (x, y, z); the vector need not be unit length. */
  tileAt(x: number, y: number, z: number, from = this.last): number {
    const tiles = this.world.tiles;
    let cur = from >= 0 && from < tiles.length ? from : 0;
    let best = this.dot(cur, x, y, z);
    for (let guard = 0; guard < tiles.length; guard++) {
      let next = -1;
      for (const nb of tiles[cur]!.neighbors) {
        const d = this.dot(nb, x, y, z);
        if (d > best) { best = d; next = nb; }
      }
      if (next < 0) break;
      cur = next;
    }
    this.last = cur;
    return cur;
  }

  /** Surface radius of the tile under the direction. */
  radiusAt(x: number, y: number, z: number): number {
    return this.heights[this.tileAt(x, y, z)] ?? 1;
  }

  /** Highest surface radius among the tile under the direction and its neighbours. */
  ridgeAt(x: number, y: number, z: number): number {
    const t = this.tileAt(x, y, z);
    let h = this.heights[t] ?? 1;
    for (const nb of this.world.tiles[t]!.neighbors) h = Math.max(h, this.heights[nb] ?? 1);
    return h;
  }
}
