// The real-world runner. Row A2 gave it world creation, row A3 the rules, row A4 the agents: the
// runner is now only the clock and the observer. Each tick it rings the clock, lets every live nation
// agent take its own turn on its own replica (agents/nation.ts), moves their messages through the bus
// (engine/bus.ts) and applies what arrives to the true world, which is what the browser sees. It never
// decides anything for a nation. Rulers (row A5) are called from here, fire and forget.
import {
  applyEvent, applyTickBatch, generateWorld, hashString, mulberry32,
  type AgentStatus, type World, type WorldEvent,
} from '@terra/shared';
import type { ControlMessage, NewWorldOptions, RunnerListener, WorldRunner } from '../runner';
import { MessageBus, type BusEndpoint } from './bus';
import { prepareWorld } from './bibleAi';
import { NationAgent } from '../agents/nation';
import { RulerScheduler } from '../agents/ruler';
import { currentMode, getBudget, resetRun } from '../llm';

const TICK_MS = 500;
const MAX_TICKS_PER_STEP = 16;
const AGENTS_HEARTBEAT_MS = 1000;

export class EngineRunner implements WorldRunner {
  private world: World | null = null;        // the truth: only ever changed by applying published events
  private initial: World | null = null;
  private log: WorldEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<RunnerListener>();
  private lamport = 0;
  private decrees = 0;
  private lastTick = 0;
  private acc = 0;
  private lastAgents = '';
  private lastAgentsPush = 0;
  private generation = 0;
  private agents = new Map<number, NationAgent>();
  private bus: MessageBus = this.makeBus();
  private scheduler = new RulerScheduler();
  private outgoing: WorldEvent[] = [];         // applied to the truth, waiting to be broadcast

  getWorld(): World | null { return this.world; }
  getLog() { return this.world && this.initial ? { initial: this.initial, events: this.log } : null; }
  /** One nation's agent (for rows A7, A18 and headless checks). */
  getAgent(countryId: number): NationAgent | undefined { return this.agents.get(countryId); }
  getBus(): MessageBus { return this.bus; }

  private makeBus(): MessageBus {
    return new MessageBus({ onRestore: (id, missedByIt, missedByOthers) => this.onRestore(id, missedByIt, missedByOthers) });
  }

  /** The observer: the true world hears the bus like any agent, and records heartbeats. */
  private observer: BusEndpoint = {
    receive: (batch) => {
      const w = this.world;
      if (!w) return;
      for (const e of batch) if (e.lamport > this.lamport) this.lamport = e.lamport;
      this.outgoing.push(...applyTickBatch(w, batch));
    },
    hear: (from, tick) => {
      const a = this.world?.agents.find((x) => x.countryId === from);
      if (a) a.lastHeardTick = tick;
    },
  };

  async newWorld(opts: NewWorldOptions): Promise<World> {
    const gen = ++this.generation;
    resetRun();                                   // a new world starts a fresh budget; the bible counts
    const { bible, seed } = await prepareWorld(opts);
    const w = generateWorld(bible, { seed, seaLevel: opts.seaLevel });
    w.prompt = opts.prompt;
    if (gen !== this.generation) return w;        // a newer request won the race; it installs its own
    this.stop();
    for (const a of this.agents.values()) a.retired = true;
    this.world = w;
    this.initial = structuredClone(w);
    this.log = [];
    this.lamport = 0;
    this.outgoing = [];
    this.lastTick = Date.now();
    this.acc = 0;
    this.lastAgents = '';
    this.bus = this.makeBus();
    this.bus.setObserver(this.observer);
    this.scheduler = new RulerScheduler();
    this.agents.clear();
    const rulerOn = currentMode() === 'live' && !!process.env.GEMINI_API_KEY;
    for (const c of w.countries) this.addAgent(c.id, bible.nations[c.id]?.regionNames, rulerOn);
    this.syncStatuses();
    this.start();
    for (const l of this.listeners) l.snapshot?.(w);
    return w;
  }

  /** Starts an agent for a nation (at creation; row A18 calls it for a breakaway nation). */
  addAgent(countryId: number, regionNames: string[] | undefined, rulerOn: boolean): NationAgent {
    const agent = new NationAgent(countryId, this.world!, this.bus, {
      regionNames, rulerOn, onBigEvent: (id) => this.scheduler.notify(id),
    });
    this.agents.set(countryId, agent);
    this.bus.join(countryId, agent);
    return agent;
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

  private step(): void {
    const w = this.world;
    const now = Date.now();
    const dt = now - this.lastTick;
    this.lastTick = now;
    if (!w || w.paused) return;
    this.acc = Math.min(this.acc + (dt * w.speed) / TICK_MS, MAX_TICKS_PER_STEP);
    let n = 0;
    while (this.acc >= 1) { this.acc -= 1; n++; }
    this.advance(n);
    this.rulers(now);
  }

  /** Runs `ticks` years at once and broadcasts the result (the timer uses it; so can headless checks). */
  advance(ticks: number): void {
    if (!this.world) return;
    for (let i = 0; i < ticks; i++) this.runTick();
    this.syncStatuses();
    this.flushOut();
    this.pushAgents();
  }

  /** One year: the clock rings, every live agent takes its turn on its own replica (seeded order;
   *  the order changes nothing, as no agent hears this year's news until the bus flushes), then the
   *  bus delivers the year's batch to every up agent and to the true world. */
  private runTick(): void {
    const w = this.world!;
    const tick = w.tick + 1;
    const clock: WorldEvent = { id: `e-w-${tick}`, tick, actor: 'world', lamport: ++this.lamport, type: 'tick', year: w.year + 1 };
    applyEvent(w, clock);
    this.outgoing.push(clock);
    const order = [...this.agents.values()].filter((a) => !a.deleted).map((a) => a.id).sort((a, b) => a - b);
    const shuffle = mulberry32(hashString(`order:${w.seed}:${tick}`));
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(shuffle() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    for (const id of order) this.agents.get(id)!.turn(tick, w.year);
    this.bus.flush();
  }

  /** The ruler loop (row A5): at most one call per step, chosen by the scheduler; never awaited. */
  private rulers(now: number): void {
    const capped = getBudget().capped;
    const nations = [];
    for (const a of this.agents.values()) {
      if (a.deleted) continue;
      if (capped && a.ruler === 'llm') a.fallBack();          // the budget cap is the same path as silence
      nations.push({ id: a.id, alive: !!this.world?.countries[a.id]?.alive, silenced: a.silenced });
    }
    for (const id of this.scheduler.tick(now, nations)) void this.agents.get(id)?.think();
  }

  /** The observer's view of each agent: link, queue, ruler (heartbeats set lastHeardTick). */
  private syncStatuses(): void {
    const w = this.world;
    if (!w) return;
    for (const s of w.agents) {
      const a = this.agents.get(s.countryId);
      if (!a) continue;
      s.deleted = a.deleted;
      s.link = a.deleted ? 'cut' : this.bus.link(a.id) ?? 'cut';
      s.ruler = a.ruler;
      s.pendingEvents = this.bus.pending(a.id);
    }
  }

  private flushOut(): void {
    if (!this.outgoing.length) return;
    const batch = this.outgoing;
    this.outgoing = [];
    this.log.push(...batch);
    for (const l of this.listeners) l.events?.(batch);
  }

  /** Agent statuses go out when something other than a heartbeat changed, and at most once a
   *  second when only lastHeardTick moved. */
  private pushAgents(force = false): void {
    if (!this.world) return;
    const ag = this.world.agents;
    const shape = JSON.stringify(ag.map((a) => ({ ...a, lastHeardTick: 0 })));
    const now = Date.now();
    const heartbeatDue = now - this.lastAgentsPush >= AGENTS_HEARTBEAT_MS;
    if (!force && shape === this.lastAgents && !heartbeatDue) return;
    this.lastAgents = shape;
    this.lastAgentsPush = now;
    for (const l of this.listeners) l.agents?.(ag);
  }

  // --- resilience hooks (row A7 grows these) ---------------------------------------------------

  /** A link came back. Default before row A7: the agent rebuilds its beliefs from the moment it was
   *  cut (NationAgent.rejoin), then its queued events go to everyone else and the true world, applied
   *  on top in lamport order; any that are no longer legal are dropped. Row A7 adds the disputes. */
  onRestore(countryId: number, missedByIt: WorldEvent[][], missedByOthers: WorldEvent[]): void {
    const agent = this.agents.get(countryId);
    if (!agent) return;
    agent.rejoin(missedByIt, missedByOthers);
    this.bus.deliver(missedByOthers, countryId);
  }

  /** A nation's agent is removed: no more turns, heartbeats or ruler calls. Row A7: its neighbours
   *  notice the silence (NationAgent.silentPeers) and carve up its ruins. */
  onDelete(countryId: number): void {
    const agent = this.agents.get(countryId);
    if (!agent || agent.deleted) return;
    agent.deleted = true;
    agent.retired = true;
    this.bus.leave(countryId);
    this.scheduler.forget(countryId);
  }

  control(msg: ControlMessage): void {
    const w = this.world;
    if (!w) return;
    const live = (id: number): NationAgent | undefined => { const a = this.agents.get(id); return a && !a.deleted ? a : undefined; };
    const cut = (a: NationAgent): void => { if (this.bus.cut(a.id)) a.onCut(); };
    switch (msg.action) {
      case 'cut': { const a = live(msg.countryId); if (a) cut(a); break; }
      case 'restore': { if (live(msg.countryId)) this.bus.restore(msg.countryId); break; }
      case 'silence': live(msg.countryId)?.silence(); break;
      case 'wake': { const a = live(msg.countryId); if (a) { a.wake(); this.scheduler.notify(a.id); } break; }
      case 'delete': this.onDelete(msg.countryId); break;
      case 'blackout':
        for (const id of this.bus.ids()) {
          const a = live(id);
          if (!a) continue;
          if (msg.value) cut(a); else this.bus.restore(id);
        }
        break;
      case 'speed': this.setSpeed(msg.value); break;
      case 'pause': this.setPaused(msg.value); break;
      case 'decree': {
        const n = ++this.decrees;
        const ev: WorldEvent = {
          id: `e-decree-${n}`, tick: w.tick, actor: 'decree', lamport: ++this.lamport, type: 'chronicle',
          entry: { id: `c-decree-${n}`, tick: w.tick, year: w.year, kind: 'decree', countries: [], text: msg.text },
        };
        this.bus.deliver([ev]);       // news for every agent that can hear it, and the true world
        break;
      }
    }
    this.syncStatuses();
    this.flushOut();
    this.pushAgents(true);
  }

  /** What one nation believes: its own replica's tile ownership. */
  belief(countryId: number): number[] | null {
    const a = this.agents.get(countryId);
    if (!a) return null;
    return [...a.replica.owner];
  }

  subscribe(listener: RunnerListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** For tests and the headless check: the agent statuses as the observer sees them. */
  statuses(): AgentStatus[] { return this.world?.agents ?? []; }
}
