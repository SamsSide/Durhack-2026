// Row A25: the clock every runner shares. Speed is any number from 1/24 to 64 (a multiplier on the
// base rate of two years a second: 1/24 is one month a second, a tick every 12 s). The Clock turns wall time into whole ticks (carrying the
// fraction, so 64x is 128 ticks a second without drift), runs the pacing director, and tells the
// network layer when the effective speed changes. TickLoop is the timer around it.
//
// Director (pacing 'auto'): the chosen speed is a ceiling (the target). A big moment drops the
// effective speed to min(target, 1) for HOLD_MS real seconds, then it eases back up to the target
// over EASE_MS (exponential). A new big moment starts the hold again. Because the whole recovery
// takes 11 s, the "quiet for 20 s, nudge up" rule is already satisfied: the speed is back at the
// target well before any 20 s of quiet. Pause always wins.
export const MIN_SPEED = 1 / 24;   // one month a second: a year (one tick) every 12 s
export const MAX_SPEED = 64;
export const BASE_TICKS_PER_SEC = 2;
export const MAX_TICKS_PER_FIRE = 16;
export const HOLD_MS = 8000;
export const EASE_MS = 3000;
const BATCH_MS = 60;             // timer period at 4x and above
const SLOW_BELOW = 4;            // below this, one tick per fire at 500 ms / speed
const CLOCK_EMIT_MS = 250;       // clock messages at most four a second while easing
const WINDOW_MS = 2000;          // how far back the achieved rate looks

export type Pacing = 'auto' | 'manual';
export interface ClockState { speed: number; target: number; pacing: Pacing; paused: boolean }

export const clampSpeed = (v: number): number => Math.min(MAX_SPEED, Math.max(MIN_SPEED, v));
// Four places, so the slow gears reach the clients whole enough to interpolate months (1/24 = 0.0417).
const r4 = (x: number): number => Math.round(x * 10000) / 10000;

export class Clock {
  target = 1;
  pacing: Pacing = 'manual';
  paused = false;
  /** Called with the new state whenever it changed (throttled while easing). */
  onChange: ((s: ClockState) => void) | null = null;
  /** Called when a setting changed, so the timer can reschedule at once. */
  onKick: (() => void) | null = null;

  private bigAt = -Infinity;
  private last: number;
  private acc = 0;
  private lagUntil = 0;
  private ran: { at: number; n: number }[] = [];
  private sent = '';
  private sentAt = -Infinity;

  constructor(readonly now: () => number = Date.now) { this.last = this.now(); }

  /** A fresh world: forget the last big moment and the backlog, keep the user's settings. */
  reset(): void {
    this.bigAt = -Infinity; this.acc = 0; this.lagUntil = 0; this.ran = []; this.last = this.now();
  }

  /** Banks the time since the last look at the rate that applied then (before a setting changes). */
  private accrue(at: number): void {
    const dt = Math.min(Math.max(0, at - this.last), 5000);
    this.last = at;
    if (!this.paused) this.acc += (dt / 1000) * BASE_TICKS_PER_SEC * this.effective(at);
  }

  setTarget(v: number): void {
    if (!Number.isFinite(v)) return;
    this.accrue(this.now());
    this.target = clampSpeed(v);
    this.changed();
  }
  setPacing(p: Pacing): void {
    if (p !== 'auto' && p !== 'manual') return;
    this.accrue(this.now());
    this.pacing = p;
    this.bigAt = -Infinity;
    this.changed();
  }
  setPaused(p: boolean): void {
    this.accrue(this.now());
    this.paused = p;
    this.changed();
  }
  apply(s: ClockState): void {
    this.target = clampSpeed(s.target); this.pacing = s.pacing; this.paused = s.paused;
    this.bigAt = -Infinity;
  }

  /** A big moment happened (the runner found one in what it just applied). */
  bigMoment(at = this.now()): void {
    if (this.pacing !== 'auto') return;
    this.bigAt = at;
    this.acc %= 1;               // drop the unplayed backlog (the slowdown starts now), keep the year's phase
    this.poll(at, true);
  }

  /** The effective speed the director wants right now (ignores pause and lag). */
  effective(at = this.now()): number {
    if (this.pacing !== 'auto' || this.bigAt === -Infinity) return this.target;
    const low = Math.min(this.target, 1);
    const t = at - this.bigAt;
    if (t < HOLD_MS) return low;
    if (t >= HOLD_MS + EASE_MS) return this.target;
    const p = (t - HOLD_MS) / EASE_MS;
    return low + (this.target - low) * ((1 - Math.exp(-4 * p)) / (1 - Math.exp(-4)));
  }

  /** What the clients are told: the effective speed, or the achieved speed if the machine is behind. */
  state(at = this.now()): ClockState {
    let speed = this.effective(at);
    if (!this.paused && at < this.lagUntil) {
      const from = at - WINDOW_MS;
      const n = this.ran.filter((x) => x.at >= from).reduce((s, x) => s + x.n, 0);
      speed = Math.min(speed, n / (WINDOW_MS / 1000) / BASE_TICKS_PER_SEC);
    }
    return { speed: r4(Math.max(0, speed)), target: this.target, pacing: this.pacing, paused: this.paused };
  }

  /** Whole ticks to run now (0 if paused or not yet due). Carries the fraction. */
  take(at = this.now()): number {
    this.accrue(at);
    if (this.paused) return 0;
    const n = Math.min(Math.floor(this.acc), MAX_TICKS_PER_FIRE);
    this.acc -= n;
    if (this.acc >= 1) { this.lagUntil = at + WINDOW_MS; this.acc = Math.min(this.acc, MAX_TICKS_PER_FIRE); }
    if (n) {
      this.ran.push({ at, n });
      while (this.ran.length && this.ran[0]!.at < at - WINDOW_MS * 2) this.ran.shift();
    }
    return n;
  }

  /** Emits `clock` when the state changed; throttled unless forced. */
  poll(at = this.now(), force = false): void {
    const s = this.state(at);
    const key = JSON.stringify(s);
    if (key === this.sent) return;
    if (!force && at - this.sentAt < CLOCK_EMIT_MS) return;
    this.sent = key; this.sentAt = at;
    this.onChange?.(s);
  }

  /** True while the last state sent is out of date (the timer should fire soon). */
  unsettled(at = this.now()): boolean { return JSON.stringify(this.state(at)) !== this.sent; }

  /** Milliseconds until the next timer fire. */
  delay(at = this.now()): number {
    if (this.paused) return 100;
    const speed = this.effective(at);
    const cap = this.unsettled(at) || speed !== this.target ? CLOCK_EMIT_MS : 1000;
    if (speed >= SLOW_BELOW) return Math.min(BATCH_MS, cap);
    const rate = BASE_TICKS_PER_SEC * speed;
    const wait = ((1 - this.acc) / rate) * 1000;
    return Math.min(cap, Math.max(15, wait));
  }

  private changed(): void {
    this.poll(this.now(), true);
    this.onKick?.();
  }
}

/** The timer: a self-rescheduling timeout, so the period follows the effective speed. */
export class TickLoop {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  constructor(private clock: Clock, private fire: (ticks: number, now: number) => void) {
    clock.onKick = () => { if (this.running) this.schedule(1); };
  }

  start(): void { if (this.running) return; this.running = true; this.clock.reset(); this.schedule(this.clock.delay()); }
  stop(): void { this.running = false; if (this.timer) clearTimeout(this.timer); this.timer = null; }
  get active(): boolean { return this.running; }

  private schedule(ms: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(), ms);
  }

  private run(): void {
    this.timer = null;
    if (!this.running) return;
    const at = this.clock.now();
    try {
      this.fire(this.clock.take(at), at);
      this.clock.poll(at);
    } finally {
      if (this.running && !this.timer) this.schedule(this.clock.delay());
    }
  }
}
