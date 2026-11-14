// Mock WorldRunner: plays mockEvents() into a server-side World on the shared clock (row A25).
import {
  applyEvent, cutEvents, deathEvents, mockEvents, mockWorld, restoreEvents, type AgentStatus, type World, type WorldEvent,
} from '@terra/shared';
import type { ControlMessage, NewWorldOptions, RunnerListener, WorldRunner } from '../runner';
import { Clock, TickLoop, clampSpeed, type ClockState } from '../engine/clock';
import { anyBigMoment } from '../engine/bigMoments';
import { loadReplay } from '../engine/replays';

export class MockRunner implements WorldRunner {
  private world: World | null = null;
  private initial: World | null = null;
  private log: WorldEvent[] = [];
  private gen: Generator<WorldEvent> | null = null;
  private pending: WorldEvent | null = null;
  private listeners = new Set<RunnerListener>();
  private clock = new Clock();
  private loop = new TickLoop(this.clock, (n) => this.step(n));
  private lamport = 0;
  private decrees = 0;
  private councilN = 0;
  private lastAgents = '';
  private lastAgentsPush = 0;

  constructor() {
    this.clock.onChange = (s) => { for (const l of this.listeners) l.clock?.(s); };
  }

  clockState(): ClockState { return this.clock.state(); }
  getWorld(): World | null { return this.world; }
  getLog() { return this.world && this.initial ? { initial: this.initial, events: this.log } : null; }

  private load(w: World, paused = false): World {
    this.stop();
    this.world = w;
    this.initial = structuredClone(w);
    this.log = [];
    this.gen = mockEvents(w);
    this.pending = null;
    this.clock.setPaused(paused);                // row A31: prepare mode starts the world paused
    w.speed = this.clock.target;
    w.paused = paused;
    this.lamport = 0;
    this.lastAgents = '';
    this.start();
    for (const l of this.listeners) l.snapshot?.(w);
    return w;
  }

  async newWorld(opts: NewWorldOptions): Promise<World> {
    this.beliefs.clear();
    const w = mockWorld(opts.seed ?? Math.floor(Math.random() * 1e6));
    w.prompt = opts.prompt;
    if (opts.era) w.era = opts.era;
    return this.load(w, !!opts.paused);
  }

  listReplays() { return [{ id: 'demo-1', name: 'The Drowned Age', events: loadReplay('demo-1')?.events.length ?? 0 }]; }

  replay(id: string): World | null {
    if (!this.listReplays().some((r) => r.id === id)) return null;
    const w = mockWorld(1337);
    w.name = 'The Drowned Age';
    return this.load(w);
  }

  start(): void {
    if (this.loop.active || !this.world) return;
    this.loop.start();
  }

  stop(): void { this.loop.stop(); }

  setSpeed(speed: number): void {
    if (!Number.isFinite(speed)) return;
    if (this.world) this.world.speed = clampSpeed(speed);
    this.clock.setTarget(speed);
  }

  setPaused(paused: boolean): void {
    if (this.world) this.world.paused = paused;
    this.clock.setPaused(paused);
  }

  private next(): WorldEvent {
    return this.gen!.next().value as WorldEvent;
  }

  /** One timer fire: `ticks` whole years, broadcast as one batch. */
  private step(ticks: number): void {
    const w = this.world;
    if (!w || !this.gen || w.paused || !ticks) return;
    const batch: WorldEvent[] = [];
    for (let i = 0; i < ticks; i++) {
      const first = this.pending ?? this.next();
      this.pending = null;
      batch.push(first);
      for (;;) {
        const e = this.next();
        if (e.type === 'tick') { this.pending = e; break; }
        batch.push(e);
      }
    }
    this.emit(batch);
  }

  private emit(batch: WorldEvent[]): void {
    const w = this.world!;
    for (const e of batch) {
      applyEvent(w, e);
      this.lamport = Math.max(this.lamport, e.lamport);
    }
    if (anyBigMoment(batch, w)) this.clock.bigMoment();
    this.log.push(...batch);
    // Cut nations "hear" nothing; up nations are heard at the current tick.
    for (const a of w.agents) {
      if (a.deleted) continue;
      if (a.link === 'up') { a.lastHeardTick = w.tick; a.pendingEvents = 0; }
      else a.pendingEvents += batch.filter((e) => e.actor === a.countryId).length;
    }
    for (const l of this.listeners) l.events?.(batch);
    this.pushAgents();
  }

  private pushAgents(force = false): void {
    if (!this.world) return;
    // At most once a second when only the heartbeat moved (row A25: batches can be 16 a second).
    const json = JSON.stringify(this.world.agents.map((a) => ({ ...a, lastHeardTick: 0 })));
    const now = Date.now();
    if (!force && json === this.lastAgents && now - this.lastAgentsPush < 1000) return;
    this.lastAgents = json;
    this.lastAgentsPush = now;
    for (const l of this.listeners) l.agents?.(this.world.agents);
  }

  control(msg: ControlMessage): void {
    const w = this.world;
    if (!w) return;
    const agent = (id: number): AgentStatus | undefined => w.agents.find((a) => a.countryId === id);
    switch (msg.action) {
      case 'cut': { const a = agent(msg.countryId); if (a && !a.deleted) { a.link = 'cut'; this.freezeBelief(msg.countryId); } break; }
      case 'restore': { const a = agent(msg.countryId); if (a && !a.deleted) { a.link = 'up'; this.beliefs.delete(msg.countryId); } break; }
      case 'silence': { const a = agent(msg.countryId); if (a && !a.deleted) a.ruler = 'autopilot'; break; }
      case 'wake': { const a = agent(msg.countryId); if (a && !a.deleted) a.ruler = 'llm'; break; }
      case 'delete': { const a = agent(msg.countryId); if (a) { a.deleted = true; a.link = 'cut'; this.freezeBelief(msg.countryId); } break; }
      case 'blackout': for (const a of w.agents) if (!a.deleted) { a.link = msg.value ? 'cut' : 'up'; if (msg.value) this.freezeBelief(a.countryId); else this.beliefs.delete(a.countryId); } break;
      case 'speed': this.setSpeed(msg.value); break;
      case 'pacing': this.clock.setPacing(msg.value); break;
      case 'pause': this.setPaused(msg.value); break;
      case 'kill':
      case 'cut_member':
      case 'restore_member': {
        // Row A29: the same council events the engine makes, applied to the mock world.
        const n = ++this.councilN;
        const line = { entryId: `c-council-${n}`, tick: w.tick, year: w.year };
        const bodies = msg.action === 'kill' ? deathEvents(w, msg.countryId, msg.role, 'assassination', line)
          : msg.action === 'cut_member' ? cutEvents(w, msg.countryId, msg.role, line) : restoreEvents(w, msg.countryId, msg.role, line);
        if (bodies.length) {
          this.emit(bodies.map((b, i) => ({ id: `e-council-${n}-${i}`, tick: w.tick, actor: 'world', lamport: this.lamport + 1 + i, ...b }) as WorldEvent));
        }
        return;
      }
      case 'decree': {
        const n = ++this.decrees;
        this.emit([{
          id: `e-decree-${n}`, tick: w.tick, actor: 'decree', lamport: this.lamport + 1, type: 'chronicle',
          entry: { id: `c-decree-${n}`, tick: w.tick, year: w.year, kind: 'decree', countries: [], text: msg.text },
        }]);
        return;
      }
    }
    this.pushAgents(true);
  }

  /** A cut nation keeps the map it last saw (row A7's belief view under `npm run mock`, #230). */
  private beliefs = new Map<number, number[]>();
  private freezeBelief(countryId: number): void {
    if (this.world && !this.beliefs.has(countryId)) this.beliefs.set(countryId, [...this.world.owner]);
  }

  belief(countryId: number): number[] | null {
    if (!this.world || !this.world.countries[countryId]) return null;
    return [...(this.beliefs.get(countryId) ?? this.world.owner)];
  }

  subscribe(listener: RunnerListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}
