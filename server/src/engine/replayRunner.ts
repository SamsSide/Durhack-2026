// Row A9: plays a saved run back with no API calls, and the hub that lets one server switch between
// the live engine and a replay without the sockets, lore, Tiger and the rest noticing.
//
// Playback applies the log with applyEvent, never applyTickBatch: the log already holds the battles
// as the true world settled them, so settling them again would count them twice.
import { applyEvent, cloneWorld, type AgentStatus, type World, type WorldEvent } from '@terra/shared';
import type { ControlMessage, NewWorldOptions, RunnerListener, WorldRunner } from '../runner';
import { listReplayFiles, loadReplay, type ReplayFile } from './replays';

const TICK_MS = 500;
const MAX_TICKS_PER_STEP = 16;
const AGENTS_HEARTBEAT_MS = 1000;

export class ReplayRunner implements WorldRunner {
  private world: World;
  private pos = 0;               // next event to play
  private agentPos = 0;          // next agents record to apply
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<RunnerListener>();
  private lastTick = 0;
  private acc = 0;
  private lastAgents = '';
  private lastAgentsPush = 0;
  finished = false;

  constructor(private file: ReplayFile) {
    this.world = cloneWorld(file.initial);
  }

  getWorld(): World { return this.world; }
  /** The whole saved run, for the timeline scrubber. */
  getLog() { return { initial: this.file.initial, events: this.file.events }; }
  async newWorld(_opts: NewWorldOptions): Promise<World> { throw new Error('a replay cannot make a new world; use the hub'); }
  listReplays() { return listReplayFiles(); }
  replay(_id: string): World | null { return null; }

  start(): void {
    if (this.timer || this.finished) return;
    this.lastTick = Date.now();
    this.timer = setInterval(() => this.step(), 100);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setSpeed(speed: number): void { if ([1, 2, 4, 8].includes(speed)) this.world.speed = speed; }
  setPaused(paused: boolean): void { this.world.paused = paused; }

  /** Only speed and pause work during playback; cut, delete, decree and the rest are ignored. */
  control(msg: ControlMessage): void {
    if (msg.action === 'speed') this.setSpeed(msg.value);
    else if (msg.action === 'pause') this.setPaused(msg.value);
  }

  belief(countryId: number): number[] | null {
    return this.world.countries[countryId] ? [...this.world.owner] : null;
  }

  subscribe(listener: RunnerListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private step(): void {
    const w = this.world;
    const now = Date.now();
    const dt = now - this.lastTick;
    this.lastTick = now;
    if (w.paused) return;
    this.acc = Math.min(this.acc + (dt * w.speed) / TICK_MS, MAX_TICKS_PER_STEP);
    let n = 0;
    while (this.acc >= 1) { this.acc -= 1; n++; }
    if (n) this.advance(n);
  }

  /** Plays `ticks` years of the log at once and broadcasts them (the timer uses it; so do headless checks). */
  advance(ticks: number): void {
    const events = this.file.events;
    if (this.finished || this.pos >= events.length) return this.finish();
    const batch: WorldEvent[] = [];
    let seen = 0;
    let agentsChanged = false;
    while (this.pos < events.length) {
      const e = events[this.pos]!;
      if (e.type === 'tick' && ++seen > ticks) break;
      if (this.applyAgentsUpTo(this.pos)) agentsChanged = true;
      applyEvent(this.world, e);
      batch.push(e);
      this.pos++;
    }
    if (this.applyAgentsUpTo(this.pos)) agentsChanged = true;
    // Linked nations are heard every year, as in the live run.
    for (const a of this.world.agents) if (!a.deleted && a.link === 'up') a.lastHeardTick = this.world.tick;
    for (const l of this.listeners) l.events?.(batch);
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
  control(msg: ControlMessage) { this.current.control(msg); }
  belief(id: number) { return this.current.belief(id); }

  subscribe(listener: RunnerListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}
