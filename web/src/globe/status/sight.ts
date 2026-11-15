// Whether a point on the globe can be seen from the camera, cheaply: is it over the planet's horizon, and (for
// a low camera) does nearer high ground or a town stand in the way. Counters and pinned tags draw on top of the
// scene, so without this they show through hills and towns from ground level. No raycasts: the horizon is one
// line of arithmetic, and the ground test walks a few points along the line of sight over the tile heights
// (camera/groundView's TerrainLookup), a few times a second per counter. Lane b.
import * as THREE from 'three';
import type { TerrainLookup } from '../camera/groundView';

/** The sea's surface: nothing stands below it, so a point hidden behind this sphere is hidden for certain. */
const SEA_R = 1;
const STEP = 0.025;      // spacing of the points tested along the line of sight (about a quarter of a tile on a big world)
const STEPS = 22;        // so the walk reaches a little over half a planet radius: far enough for any hill that matters
const PROP_TOP = 0.09;   // nothing built or grown stands higher than this above the highest tile
const SLACK = 0.004;     // the line may graze the ground by this much (tile lips, a counter on a slope)

const _d = new THREE.Vector3(), _q = new THREE.Vector3();

/**
 * 0 when the point `p` (globe space) is hidden behind the planet's curve as seen from `eye`, 1 when it is
 * clear of it, easing between over a thin band so a tag fades at the horizon instead of blinking.
 */
export function horizonSight(eye: THREE.Vector3, p: THREE.Vector3): number {
  const d = eye.length(), r = p.length();
  if (d <= SEA_R || r <= 0) return 1;
  // visible while the angle between them is under the sum of each one's own horizon angle
  const reach = Math.acos(Math.min(1, SEA_R / d)) + Math.acos(Math.min(1, SEA_R / Math.max(SEA_R, r)));
  const ang = Math.acos(Math.min(1, Math.max(-1, eye.dot(p) / (d * r))));
  return Math.min(1, Math.max(0, (reach - ang) / 0.03));
}

/**
 * True when no tile surface, town or tree between `p` and `eye` rises above the straight line joining them.
 * `own` is the tile `p` stands on: its own buildings never hide it. Walks out from `p`, so `from` tiles stay
 * neighbours and each lookup is a step or two.
 */
export function groundSight(lookup: TerrainLookup, eye: THREE.Vector3, p: THREE.Vector3, own: number): boolean {
  _d.copy(eye).sub(p);
  const len = _d.length();
  if (len < 1e-6) return true;
  _d.multiplyScalar(1 / len);
  const top = lookup.maxRadius + PROP_TOP;
  let tile = own;
  for (let i = 1; i <= STEPS; i++) {
    const t = i * STEP;
    if (t >= len - STEP) return true;
    _q.copy(p).addScaledVector(_d, t);
    const r = _q.length();
    if (r > top) return true;
    tile = lookup.tileAt(_q.x, _q.y, _q.z, tile);
    if (tile === own) continue;
    if (r < lookup.solidAt(_q.x, _q.y, _q.z) - SLACK) return false;
  }
  return true;
}
