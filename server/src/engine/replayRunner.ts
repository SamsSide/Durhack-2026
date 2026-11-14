// Row A9: plays a saved run back with no API calls, and the hub that lets one server switch between
// the live engine and a replay without the sockets, lore, Tiger and the rest noticing.
//
// Playback applies the log with applyEvent, never applyTickBatch: the log already holds the battles
// as the true world settled them, so settling them again would count them twice.
import { applyEvent, cloneWorld, type AgentStatus, type World, type WorldEvent } from '@terra/shared';
import type { ControlMessage, NewWorldOptions, RunnerListener, WorldRunner } from '../runner';
import { listReplayFiles, loadReplay, type ReplayFile } from './replays';
import { Clock, TickLoop, clampSpeed, type ClockState } from './clock';
import { anyBigMoment } from './bigMoments';
import type { Decree, DecreeOutcome, DecreeRunner } from './decrees';

const AGENTS_HEARTBEAT_MS = 1000;

export class ReplayRunner implements WorldRunner {
  private world: World;
  private pos = 0;               // next event to play
  private agentPos = 0;          // next agents record to apply
  private listeners = new Set<RunnerListener>();
  private clock = new Clock();
  private loop = new TickLoop(this.clock, (n) => this.step(n));
  private lastAgents = '';
  private lastAgentsPush = 0;
  finished = false;

  constructor(private file: ReplayFile) {
    this.world = cloneWorld(file.initial);
    this.world.speed = this.clock.target;   // a replay starts at one month a second until the live clock is handed over
    this.world.paused = false;
    this.clock.onChange = (s) => { for (const l of this.listeners) l.clock?.(s); };
  }

  clockState(): ClockState { return this.clock.state(); }
  /** The hub hands the live runner's speed, pacing and pause over when a replay starts. */
  applyClock(s: ClockState): void { this.clock.apply(s); this.world.speed = this.clock.target; this.world.paused = s.paused; }

  getWorld(): World { return this.world; }
  /** The whole saved run, for the timeline scrubber. */
  getLog() { return { initial: this.file.initial, events: this.file.events }; }
  async newWorld(_opts: NewWorldOptions): Promise<World> { throw new Error('a replay cannot make a new world; use the hub'); }
  listReplays() { return listReplayFiles(); }
  replay(_id: string): World | null { return null; }

  start(): void {
    if (this.loop.active || this.finished) return;
    this.loop.start();
  }

  stop(): void { this.loop.stop(); }

  setSpeed(speed: number): void {
    if (!Number.isFinite(speed)) return;
    this.world.speed = clampSpeed(speed);
    this.clock.setTarget(speed);
  }
  setPaused(paused: boolean): void { this.world.paused = paused; this.clock.setPaused(paused); }

  /** Only speed and pause work during playback; cut, delete, decree and the rest are ignored. */
  control(msg: ControlMessage): void {
    if (msg.action === 'speed') this.setSpeed(msg.value);
    else if (msg.action === 'pause') this.setPaused(msg.value);
    else if (msg.action === 'pacing') this.clock.setPacing(msg.value);
  }

  belief(countryId: number): number[] | null {
    return this.world.countries[countryId] ? [...this.world.owner] : null;
  }

  subscribe(listener: RunnerListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private step(n: number): void {
    if (!this.world.paused && n) this.advance(n);
  }

  /** Plays `ticks` years of the log at once and broadcasts them (the timer uses it; so do headless checks). */
  advance(ticks: number): void {
    const events = this.file.events;
    if (this.finished || this.pos >= events.length) return this.finish();
    const batch: WorldEvent[] = [];
    let seen = 0;
    let agentsChanged = false;
    let bigAt = -1;
    while (this.pos < events.length) {
      const e = events[this.pos]!;
      if (e.type === 'tick' && ++seen > ticks) break;
      if (bigAt < 0 && anyBigMoment([e], this.world)) bigAt = batch.length;
      if (this.applyAgentsUpTo(this.pos)) agentsChanged = true;
      applyEvent(this.world, e);
      batch.push(e);
      this.pos++;
    }
    if (this.applyAgentsUpTo(this.pos)) agentsChanged = true;
    // Linked nations are heard every year, as in the live run.
    for (const a of this.world.agents) if (!a.deleted && a.link === 'up') a.lastHeardTick = this.world.tick;
    for (const l of this.listeners) l.events?.(batch);
    if (bigAt >= 0) this.clock.bigMoment();
    this.pushAgents(agentsChanged);
    if (this.pos >= events.length) this.finish();
  }

  /** Applies the recorded agents updates that had gone out once `pos` events were logged. */
  private applyAgentsUpTo(pos: number): boolean {
    let changed = false;
    const recs = this.file.agents;
    while (this.agentPos < recs.length && recs[this.agentPos]!.at <= pos) {
      const r = recs[this.agentPos++]!;
      this.world.agents.splice(0, this.world.agents.length, ...structuredClone(r.agents));
      changed = true;
    }
    return changed;
  }

  private pushAgents(force: boolean): void {
    const ag: AgentStatus[] = this.world.agents;
    const now = Date.now();
    const shape = JSON.stringify(ag.map((a) => ({ ...a, lastHeardTick: 0 })));
    if (!force && shape === this.lastAgents && now - this.lastAgentsPush < AGENTS_HEARTBEAT_MS) return;
    this.lastAgents = shape;
    this.lastAgentsPush = now;
    for (const l of this.listeners) l.agents?.(ag);
  }

  private finish(): void {
    this.finished = true;
    this.stop();
  }
}

/**
 * The runner the network layer talks to. It is the live runner until a replay is played, then the
 * replay, then the live runner again when a new world is made. Listeners subscribe once and hear
 * whichever runner is current.
 */
export class RunnerHub implements WorldRunner {
  private current: WorldRunner;
  private replayRunner: ReplayRunner | null = null;
  private listeners = new Set<RunnerListener>();

  constructor(private live: WorldRunner) {
    this.current = live;
    this.attach(live);
  }

  private attach(r: WorldRunner): void {
    r.subscribe({
      snapshot: (w) => { if (this.current === r) for (const l of this.listeners) l.snapshot?.(w); },
      events: (e) => { if (this.current === r) for (const l of this.listeners) l.events?.(e); },
      agents: (a) => { if (this.current === r) for (const l of this.listeners) l.agents?.(a); },
      clock: (c) => { if (this.current === r) for (const l of this.listeners) l.clock?.(c); },
    });
  }

  /** True while a saved run is playing (Tiger and the recorder skip their writes). */
  playback(): boolean { return this.current !== this.live; }

  getWorld() { return this.current.getWorld(); }
  getLog() { return this.current.getLog(); }
  listReplays() { return listReplayFiles(); }

  async newWorld(opts: NewWorldOptions): Promise<World> {
    if (this.replayRunner) { this.replayRunner.stop(); this.replayRunner = null; }
    this.current = this.live;
    return this.live.newWorld(opts);
  }

  replay(id: string): World | null {
    const file = loadReplay(id);
    if (!file) return null;
    this.live.stop();
    this.replayRunner?.stop();
    const rr = new ReplayRunner(file);
    const carry = this.live.clockState?.();
    if (carry) rr.applyClock(carry);
    this.replayRunner = rr;
    this.attach(rr);
    this.current = rr;
    const w = rr.getWorld();
    for (const l of this.listeners) l.snapshot?.(w);
    rr.start();
    return w;
  }

  start() { this.current.start(); }
  stop() { this.current.stop(); }
  setSpeed(s: number) { this.current.setSpeed(s); }
  setPaused(p: boolean) { this.current.setPaused(p); }
  clockState() { return this.current.clockState?.(); }
  control(msg: ControlMessage) { this.current.control(msg); }
  /** A spoken decree, already interpreted: only the live world takes it (a replay ignores decrees). */
  applyDecree(decree: Decree): DecreeOutcome | null {
    const live = this.live as WorldRunner & Partial<DecreeRunner>;
    return this.current === this.live && live.applyDecree ? live.applyDecree(decree) : null;
  }
  belief(id: number) { return this.current.belief(id); }
  /** Row A31: only the live engine has rulers; a replay never calls one. */
  prepareRuler(id: number): Promise<boolean> {
    return this.current === this.live && this.live.prepareRuler ? this.live.prepareRuler(id) : Promise.resolve(false);
  }

  subscribe(listener: RunnerListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}
