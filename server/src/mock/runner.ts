// Mock WorldRunner: plays mockEvents() into a server-side World at about four batches a second.
import { applyEvent, mockEvents, mockWorld, type AgentStatus, type World, type WorldEvent } from '@terra/shared';
import type { ControlMessage, NewWorldOptions, RunnerListener, WorldRunner } from '../runner';

const BATCH_MS = 250;

export class MockRunner implements WorldRunner {
  private world: World | null = null;
  private initial: World | null = null;
  private log: WorldEvent[] = [];
  private gen: Generator<WorldEvent> | null = null;
  private pending: WorldEvent | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<RunnerListener>();
  private speed = 1;
  private paused = false;
  private acc = 0;
  private lamport = 0;
  private decrees = 0;
  private lastAgents = '';

  getWorld(): World | null { return this.world; }
  getLog() { return this.world && this.initial ? { initial: this.initial, events: this.log } : null; }

  private load(w: World): World {
    this.stop();
    this.world = w;
    this.initial = structuredClone(w);
    this.log = [];
    this.gen = mockEvents(w);
    this.pending = null;
    this.speed = 1;
    this.paused = false;
    this.acc = 0;
    this.lamport = 0;
    this.lastAgents = '';
    this.start();
    for (const l of this.listeners) l.snapshot?.(w);
    return w;
  }

  newWorld(opts: NewWorldOptions): World {
    const w = mockWorld(opts.seed ?? Math.floor(Math.random() * 1e6));
    w.prompt = opts.prompt;
    if (opts.era) w.era = opts.era;
    return this.load(w);
  }

  listReplays() { return [{ id: 'demo-1', name: 'The Drowned Age', events: 5210 }]; }

  replay(id: string): World | null {
    if (!this.listReplays().some((r) => r.id === id)) return null;
    const w = mockWorld(1337);
    w.name = 'The Drowned Age';
    return this.load(w);
  }

  start(): void {
    if (this.timer || !this.world) return;
    this.timer = setInterval(() => this.step(), BATCH_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setSpeed(speed: number): void {
    if (![1, 2, 4, 8].includes(speed)) return;
    this.speed = speed;
    if (this.world) this.world.speed = speed;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (this.world) this.world.paused = paused;
  }

  private next(): WorldEvent {
    return this.gen!.next().value as WorldEvent;
  }

  /** One batch: whole ticks, `speed` of them per batch. */
  private step(): void {
    const w = this.world;
    if (!w || !this.gen || this.paused) return;
    this.acc += this.speed;
    const batch: WorldEvent[] = [];
    while (this.acc >= 1) {
      this.acc -= 1;
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
    const json = JSON.stringify(this.world.agents);
    if (!force && json === this.lastAgents) return;
    this.lastAgents = json;
    for (const l of this.listeners) l.agents?.(this.world.agents);
  }

  control(msg: ControlMessage): void {
    const w = this.world;
    if (!w) return;
    const agent = (id: number): AgentStatus | undefined => w.agents.find((a) => a.countryId === id);
    switch (msg.action) {
      case 'cut': { const a = agent(msg.countryId); if (a && !a.deleted) a.link = 'cut'; break; }
      case 'restore': { const a = agent(msg.countryId); if (a && !a.deleted) a.link = 'up'; break; }
      case 'silence': { const a = agent(msg.countryId); if (a && !a.deleted) a.ruler = 'autopilot'; break; }
      case 'wake': { const a = agent(msg.countryId); if (a && !a.deleted) a.ruler = 'llm'; break; }
      case 'delete': { const a = agent(msg.countryId); if (a) { a.deleted = true; a.link = 'cut'; } break; }
      case 'blackout': for (const a of w.agents) if (!a.deleted) a.link = msg.value ? 'cut' : 'up'; break;
      case 'speed': this.setSpeed(msg.value); break;
      case 'pause': this.setPaused(msg.value); break;
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

  belief(countryId: number): number[] | null {
    if (!this.world || !this.world.countries[countryId]) return null;
    return [...this.world.owner];
  }

  subscribe(listener: RunnerListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}
