// Where every drawn army formation stands this frame, for the firing effects (B16). UnitLayer writes it
// while it draws the models (only armies within the model LOD and facing the camera get here), Firing
// reads it. Fixed typed arrays, reset each frame: nothing allocates. Lane b.
import type * as THREE from 'three';

export const MAX_ARMIES = 48;
export const MAX_FIGS = MAX_ARMIES * 7;
export const ROLE_FRONT = 0, ROLE_FLANK = 1, ROLE_BACK = 2;

class FiringFeed {
  armies = 0;
  figs = 0;
  readonly keys: string[] = new Array<string>(MAX_ARMIES).fill('');
  readonly owner = new Int16Array(MAX_ARMIES);
  readonly age = new Int8Array(MAX_ARMIES);
  readonly tile = new Int32Array(MAX_ARMIES);
  readonly center = new Float32Array(MAX_ARMIES * 3);
  readonly fig0 = new Int16Array(MAX_ARMIES);
  readonly fig1 = new Int16Array(MAX_ARMIES);
  readonly role = new Int8Array(MAX_FIGS);
  readonly pos = new Float32Array(MAX_FIGS * 3);
  readonly size = new Float32Array(MAX_FIGS);

  /** When each army (by key) was last engaged and last fired: UnitLayer reads these to brace, lunge and recoil. */
  private readonly foughtAt = new Map<string, number>();
  private readonly shotAt = new Map<string, number>();

  begin(): void { this.armies = 0; this.figs = 0; }

  /** Firing: this army has an enemy in reach right now. */
  markFight(key: string, now: number): void {
    if (this.foughtAt.size > 256) this.foughtAt.clear();
    this.foughtAt.set(key, now);
  }

  /** Firing: this army just loosed a volley. */
  markShot(key: string, now: number): void {
    if (this.shotAt.size > 256) this.shotAt.clear();
    this.shotAt.set(key, now);
  }

  fighting(key: string, now: number): boolean { return now - (this.foughtAt.get(key) ?? -1e9) < 700; }

  /** Ms since the army's last volley (a large number when it never fired). */
  sinceShot(key: string, now: number): number { return now - (this.shotAt.get(key) ?? -1e9); }

  /** One formation; returns its index, or -1 when the feed is full. */
  army(key: string, owner: number, age: number, tile: number, c: THREE.Vector3): number {
    if (this.armies >= MAX_ARMIES) return -1;
    const i = this.armies++;
    this.keys[i] = key; this.owner[i] = owner; this.age[i] = age; this.tile[i] = tile;
    this.center[i * 3] = c.x; this.center[i * 3 + 1] = c.y; this.center[i * 3 + 2] = c.z;
    this.fig0[i] = this.figs; this.fig1[i] = this.figs;
    return i;
  }

  /** One figure of the formation just added. */
  figure(army: number, role: number, p: THREE.Vector3, size: number): void {
    if (army < 0 || army !== this.armies - 1 || this.figs >= MAX_FIGS) return;
    const k = this.figs++;
    this.role[k] = role; this.size[k] = size;
    this.pos[k * 3] = p.x; this.pos[k * 3 + 1] = p.y; this.pos[k * 3 + 2] = p.z;
    this.fig1[army] = this.figs;
  }
}

export const firingFeed = new FiringFeed();
