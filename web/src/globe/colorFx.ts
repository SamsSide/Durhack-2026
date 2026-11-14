// Colour effects on the province mesh: 0.4 s map-mode crossfade and the 0.8 s owner-change pulse.
// The geometry always holds the "shown" colour; `base` is what tileColor says now. No React per frame.
import * as THREE from 'three';
import type { ProvinceMesh } from './mesh/buildProvinceMesh';
import { setTileColor } from './mesh/colors';

const FADE_MS = 400;
const PULSE_MS = 800;
const MAX_PULSES = 60;
const WHITE = new THREE.Color('#ffffff');
const CONQUEST = new THREE.Color('#ff5a3c');
const EPS = 1 / 512;

interface Fade { start: number; r: number; g: number; b: number }
interface Pulse { start: number; r: number; g: number; b: number }

export class ColorFx {
  private base: Float32Array;
  private shown: Float32Array;
  private fades = new Map<number, Fade>();
  private pulses = new Map<number, Pulse>(); // insertion order = oldest first
  private raf = 0;
  private dead = false;
  private c = new THREE.Color();

  constructor(private mesh: ProvinceMesh, private tileCount: number) {
    this.base = new Float32Array(tileCount * 3);
    this.shown = new Float32Array(tileCount * 3);
  }

  private arr(): Float32Array {
    return (this.mesh.geometry.getAttribute('color') as THREE.BufferAttribute).array as Float32Array;
  }

  private read(id: number, into: Float32Array): void {
    const a = this.arr();
    const v = this.mesh.tileVertexStart[id]! * 3; // first vertex of a tile is on top (factor 1)
    into[id * 3] = a[v]!; into[id * 3 + 1] = a[v + 1]!; into[id * 3 + 2] = a[v + 2]!;
  }

  /**
   * Run `write` (which paints the geometry straight to the new base colours for `ids`, or all
   * tiles when null), then take those as the base. With `animate`, tiles whose colour changed
   * start from what was shown and fade over 0.4 s.
   */
  repaint(write: () => void, ids: Iterable<number> | null, animate: boolean): void {
    const list = ids ? Array.from(ids) : Array.from({ length: this.tileCount }, (_, i) => i);
    for (const id of list) this.read(id, this.shown);
    write();
    const now = performance.now();
    for (const id of list) {
      this.read(id, this.base);
      const i = id * 3;
      const b = this.base; const s = this.shown;
      const differs = Math.abs(b[i]! - s[i]!) > EPS || Math.abs(b[i + 1]! - s[i + 1]!) > EPS || Math.abs(b[i + 2]! - s[i + 2]!) > EPS;
      if (animate && differs) {
        this.fades.set(id, { start: now, r: s[i]!, g: s[i + 1]!, b: s[i + 2]! });
        this.c.setRGB(s[i]!, s[i + 1]!, s[i + 2]!);
        setTileColor(this.mesh, id, this.c); // keep showing the old colour until the first frame
      } else if (!animate) {
        this.fades.delete(id);
      }
    }
    this.kick();
  }

  /** Flash a tile that just changed owner. Call after `repaint` so `base` is the new owner colour. */
  pulse(id: number, cause: string): void {
    if (id < 0 || id >= this.tileCount) return;
    const i = id * 3;
    const peak = this.c.setRGB(this.base[i]!, this.base[i + 1]!, this.base[i + 2]!);
    if (cause === 'conquest') peak.copy(CONQUEST); else peak.lerp(WHITE, 0.6);
    this.pulses.delete(id);
    this.pulses.set(id, { start: performance.now(), r: peak.r, g: peak.g, b: peak.b });
    this.fades.delete(id);
    while (this.pulses.size > MAX_PULSES) {
      const oldest = this.pulses.keys().next().value as number;
      this.pulses.delete(oldest);
      this.settle(oldest);
    }
    this.kick();
  }

  private settle(id: number): void {
    const i = id * 3;
    setTileColor(this.mesh, id, this.c.setRGB(this.base[i]!, this.base[i + 1]!, this.base[i + 2]!));
  }

  private kick(): void {
    if (this.raf || this.dead) return;
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (): void => {
    this.raf = 0;
    if (this.dead) return;
    const now = performance.now();
    const b = this.base;
    for (const [id, f] of this.fades) {
      const t = (now - f.start) / FADE_MS;
      if (t >= 1) { this.fades.delete(id); this.settle(id); continue; }
      const e = t * t * (3 - 2 * t);
      const i = id * 3;
      setTileColor(this.mesh, id, this.c.setRGB(f.r + (b[i]! - f.r) * e, f.g + (b[i + 1]! - f.g) * e, f.b + (b[i + 2]! - f.b) * e));
    }
    for (const [id, p] of this.pulses) {
      const t = (now - p.start) / PULSE_MS;
      if (t >= 1) { this.pulses.delete(id); this.settle(id); continue; }
      const e = 1 - (1 - t) * (1 - t); // ease out
      const i = id * 3;
      setTileColor(this.mesh, id, this.c.setRGB(p.r + (b[i]! - p.r) * e, p.g + (b[i + 1]! - p.g) * e, p.b + (b[i + 2]! - p.b) * e));
    }
    if (this.fades.size || this.pulses.size) this.kick();
  };

  dispose(): void {
    this.dead = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
