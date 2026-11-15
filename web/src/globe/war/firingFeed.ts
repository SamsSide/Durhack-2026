// Where every drawn army formation stands this frame, for the firing effects (B16). UnitLayer writes it
// while it draws the models (only armies within the model LOD and facing the camera get here), Firing
// reads it. Fixed typed arrays, reset each frame: nothing allocates. Lane b.
// Fleets are in it too (one figure, the hull, `ship` set): Firing turns them broadside and fires
// volleys, writes back where each one aims (UnitLayer turns the hull to it), and UnitLayer queues each
// fleet that sinks so Firing can draw the foam and the wreck. Lane a (naval).
import type * as THREE from 'three';

export const MAX_ARMIES = 48;
export const MAX_FIGS = MAX_ARMIES * 7;
export const ROLE_FRONT = 0, ROLE_FLANK = 1, ROLE_BACK = 2;
export const SINKS = 8;

class FiringFeed {
  armies = 0;
  figs = 0;
  readonly keys: string[] = new Array<string>(MAX_ARMIES).fill('');
  readonly owner = new Int16Array(MAX_ARMIES);
  readonly age = new Int8Array(MAX_ARMIES);
  readonly tile = new Int32Array(MAX_ARMIES);
  /** 1 for a fleet (one figure: its hull), 0 for an army. */
  readonly ship = new Uint8Array(MAX_ARMIES);
  readonly center = new Float32Array(MAX_ARMIES * 3);
  readonly fig0 = new Int16Array(MAX_ARMIES);
  readonly fig1 = new Int16Array(MAX_ARMIES);
  readonly role = new Int8Array(MAX_FIGS);
  readonly pos = new Float32Array(MAX_FIGS * 3);
  readonly size = new Float32Array(MAX_FIGS);

  /** When each army (by key) was last engaged and last fired: UnitLayer reads these to brace, lunge and recoil. */
  private readonly foughtAt = new Map<string, number>();
  private readonly shotAt = new Map<string, number>();
  /** Where each fleet (by key) aims, world space; written by Firing while it fights. */
  private readonly aimAt = new Map<string, Float32Array>();

  /** Fleets that went down this frame or lately: a ring of SINKS (x, y, z, size, age, at). */
  readonly sinks = new Float64Array(SINKS * 6);
  sinkHead = 0;
  sinkCount = 0;

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

  /** Firing: this fleet aims at p (it turns broadside, or bow-on to ram in the early ages). */
  markAim(key: string, p: THREE.Vector3): void {
    let a = this.aimAt.get(key);
    if (!a) {
      if (this.aimAt.size > 128) this.aimAt.clear();
      a = new Float32Array(3);
      this.aimAt.set(key, a);
    }
    a[0] = p.x; a[1] = p.y; a[2] = p.z;
  }

  /** Where the fleet aims, into out; false when it has no target. */
  aimOf(key: string, out: THREE.Vector3): boolean {
    const a = this.aimAt.get(key);
    if (!a) return false;
    out.set(a[0]!, a[1]!, a[2]!);
    return true;
  }

  /** UnitLayer: a fleet beaten in battle starts to sink at p. */
  sink(p: THREE.Vector3, size: number, age: number, now: number): void {
    const k = this.sinkHead * 6;
    this.sinks[k] = p.x; this.sinks[k + 1] = p.y; this.sinks[k + 2] = p.z;
    this.sinks[k + 3] = size; this.sinks[k + 4] = age; this.sinks[k + 5] = now;
    this.sinkHead = (this.sinkHead + 1) % SINKS;
    this.sinkCount++;
  }

  fighting(key: string, now: number): boolean { return now - (this.foughtAt.get(key) ?? -1e9) < 700; }

  /** Ms since the army's last volley (a large number when it never fired). */
  sinceShot(key: string, now: number): number { return now - (this.shotAt.get(key) ?? -1e9); }

  /** One formation; returns its index, or -1 when the feed is full. */
  army(key: string, owner: number, age: number, tile: number, c: THREE.Vector3, ship = false): number {
    if (this.armies >= MAX_ARMIES) return -1;
    const i = this.armies++;
    this.keys[i] = key; this.owner[i] = owner; this.age[i] = age; this.tile[i] = tile; this.ship[i] = ship ? 1 : 0;
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
