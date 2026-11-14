// The real-world runner. Row A2 gave it world creation and a clock; row A3 runs the per-nation
// rules (packages/shared/src/sim/rules.ts) each tick; wars come with row A6. Same WorldRunner seam.
import {
  applyEvent, autopilotPolicy, generateWorld, hashString, isEventValid, mulberry32, nationTurn,
  type AgentStatus, type NationPolicy, type World, type WorldEvent,
} from '@terra/shared';
import type { ControlMessage, NewWorldOptions, RunnerListener, WorldRunner } from '../runner';
import { mockBible } from './bible';

const TICK_MS = 500;
const MAX_TICKS_PER_STEP = 16;

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
  private policies = new Map<number, NationPolicy>();
  private regionNames: string[][] = [];   // per nation, from the bible the world was built from

  getWorld(): World | null { return this.world; }
  getLog() { return this.world && this.initial ? { initial: this.initial, events: this.log } : null; }

  newWorld(opts: NewWorldOptions): World {
    this.stop();
    const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
    const bible = mockBible(opts, seed);
    const w = generateWorld(bible, { seed, seaLevel: opts.seaLevel });
    this.regionNames = bible.nations.map((nn) => nn.regionNames);
    this.policies.clear();
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

    /** Plug a ruler's focus in (row A5). Nations without one run on autopilotPolicy. */
  setPolicy(countryId: number, policy: NationPolicy | null): void {
    if (policy) this.policies.set(countryId, policy); else this.policies.delete(countryId);
  }

  private policyOf(countryId: number): NationPolicy {
    return this.policies.get(countryId) ?? autopilotPolicy(this.world!, countryId);
  }

  private step(): void {
    const w = this.world;
    const now = Date.now();
    const dt = now - this.lastTick;
    this.lastTick = now;
    if (!w || w.paused) return;
    this.acc = Math.min(this.acc + (dt * w.speed) / TICK_MS, MAX_TICKS_PER_STEP);
    const batch: WorldEvent[] = [];
    while (this.acc >= 1) {
      this.acc -= 1;
      this.runTick(batch);
    }
    if (batch.length) this.emit(batch);
  }

  /** One year: the clock ticks, then every live nation takes its own turn on the true world, in a
   *  seeded order. Row A4 swaps the true world for per-agent replicas; the rules stay the same. */
  private runTick(batch: WorldEvent[]): void {
    const w = this.world!;
    const tick = w.tick + 1;
    const clock: WorldEvent = { id: `e-w-${tick}`, tick, actor: 'world', lamport: ++this.lamport, type: 'tick', year: w.year + 1 };
    applyEvent(w, clock);
    batch.push(clock);
    const order = w.countries
      .filter((c) => c.alive && !w.agents.find((a) => a.countryId === c.id)?.deleted)
      .map((c) => c.id);
    const shuffle = mulberry32(hashString(`order:${w.seed}:${tick}`));
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(shuffle() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    for (const id of order) {
      const rng = mulberry32(hashString(`turn:${w.seed}:${tick}:${id}`));
      const events = nationTurn(w, id, this.policyOf(id), tick, rng, { regionNames: this.regionNames[id] });
      for (const e of events) {
        if (!isEventValid(w, e)) continue;   // e.g. a claim of a tile another nation took earlier this tick
        e.lamport = ++this.lamport;
        applyEvent(w, e);
        batch.push(e);
      }
    }
  }

  private emit(batch: WorldEvent[]): void {
    const w = this.world!;
    this.log.push(...batch);
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
      case 'silence': { const a = agent(msg.countryId); if (a && !a.deleted) { a.ruler = 'autopilot'; this.policies.delete(a.countryId); } break; }
      case 'wake': { const a = agent(msg.countryId); if (a && !a.deleted) a.ruler = 'llm'; break; }
      case 'delete': { const a = agent(msg.countryId); if (a) { a.deleted = true; a.link = 'cut'; } break; }
      case 'blackout': for (const a of w.agents) if (!a.deleted) a.link = msg.value ? 'cut' : 'up'; break;
      case 'speed': this.setSpeed(msg.value); break;
      case 'pause': this.setPaused(msg.value); break;
      case 'decree': {
        const n = ++this.decrees;
        const ev: WorldEvent = {
          id: `e-decree-${n}`, tick: w.tick, actor: 'decree', lamport: ++this.lamport, type: 'chronicle',
          entry: { id: `c-decree-${n}`, tick: w.tick, year: w.year, kind: 'decree', countries: [], text: msg.text },
        };
        applyEvent(w, ev);
        this.emit([ev]);
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
