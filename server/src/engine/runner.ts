// The real-world runner. Row A2 gives it world creation and a bare clock; row A3 replaces the
// body of `step` with the actual simulation (expansion, wars, agents). Same WorldRunner seam.
import { applyEvent, generateWorld, type AgentStatus, type World, type WorldEvent } from '@terra/shared';
import type { ControlMessage, NewWorldOptions, RunnerListener, WorldRunner } from '../runner';
import { mockBible } from './bible';

const TICK_MS = 500;

export class EngineRunner implements WorldRunner {
  private world: World | null = null;
  private initial: World | null = null;
  private log: WorldEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<RunnerListener>();
  private lamport = 0;
  private decrees = 0;
  private lastTick = 0;
  private acc = 0;
  private lastAgents = '';

  getWorld(): World | null { return this.world; }
  getLog() { return this.world && this.initial ? { initial: this.initial, events: this.log } : null; }

  newWorld(opts: NewWorldOptions): World {
    this.stop();
    const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
    const w = generateWorld(mockBible(opts, seed), { seed, seaLevel: opts.seaLevel });
    w.prompt = opts.prompt;
    this.world = w;
    this.initial = structuredClone(w);
    this.log = [];
    this.lamport = 0;
    this.lastTick = Date.now();
    this.acc = 0;
    this.lastAgents = '';
    this.start();
    for (const l of this.listeners) l.snapshot?.(w);
    return w;
  }

  // Replays arrive with row A9.
  listReplays() { return []; }
  replay(_id: string): World | null { return null; }

  start(): void {
    if (this.timer || !this.world) return;
    this.lastTick = Date.now();
    this.timer = setInterval(() => this.step(), 100);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setSpeed(speed: number): void {
    if (![1, 2, 4, 8].includes(speed)) return;
    if (this.world) this.world.speed = speed;
  }

  setPaused(paused: boolean): void {
    if (this.world) this.world.paused = paused;
  }

  /** Row A3 replaces this: it only advances the clock. */
  private step(): void {
    const w = this.world;
    const now = Date.now();
    const dt = now - this.lastTick;
    this.lastTick = now;
    if (!w || w.paused) return;
    this.acc += (dt * w.speed) / TICK_MS;
    const batch: WorldEvent[] = [];
    while (this.acc >= 1) {
      this.acc -= 1;
      batch.push(this.makeEvent({ type: 'tick', tick: w.tick + batch.length + 1, year: w.year + 1 }));
    }
    if (batch.length) this.emit(batch);
  }

  private makeEvent(body: { type: 'tick'; tick: number; year: number }): WorldEvent {
    return { id: `e-${++this.lamport}`, tick: body.tick, actor: 'world', lamport: this.lamport, type: 'tick', year: body.year };
  }

  private emit(batch: WorldEvent[]): void {
    const w = this.world!;
    for (const e of batch) applyEvent(w, e);
    this.log.push(...batch);
    for (const a of w.agents) {
      if (a.deleted) continue;
      if (a.link === 'up') { a.lastHeardTick = w.tick; a.pendingEvents = 0; }
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
          id: `e-decree-${n}`, tick: w.tick, actor: 'decree', lamport: ++this.lamport, type: 'chronicle',
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
