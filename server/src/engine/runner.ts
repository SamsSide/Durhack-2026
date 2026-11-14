// The real-world runner. Row A2 gave it world creation, row A3 the rules, row A4 the agents: the
// runner is now only the clock and the observer. Each tick it rings the clock, lets every live nation
// agent take its own turn on its own replica (agents/nation.ts), moves their messages through the bus
// (engine/bus.ts) and applies what arrives to the true world, which is what the browser sees. It never
// decides anything for a nation. Rulers (row A5) are called from here, fire and forget.
import {
  applyEvent, applyTickBatch, findSecession, generateWorld, hashString, mulberry32,
  type AgentStatus, type ChronicleKind, type World, type WorldEvent,
} from '@terra/shared';
import type { ControlMessage, NewWorldOptions, RunnerListener, WorldRunner } from '../runner';
import { MessageBus, type BusEndpoint } from './bus';
import { prepareWorld } from './bibleAi';
import { NationAgent } from '../agents/nation';
import {
  FALL_AFTER_TICKS, disputeText, fallText, findDisputes, returnText, silenceText,
} from './resilience';
import { decreeEvents, interpretDecree, interpretDecreeMock, type Decree } from './decrees';
import { RulerScheduler } from '../agents/ruler';
import { secessionBatch } from './secession';
import { currentMode, getBudget, resetRun } from '../llm';
import { Clock, TickLoop, clampSpeed, type ClockState } from './clock';
import { anyBigMoment } from './bigMoments';
import { CouncilKeeper } from './council';

const AGENTS_HEARTBEAT_MS = 1000;
/** Row A29: decree words that kill a council member, and those that name the general. */
const KILL_RE = /\b(kill\w*|slay\w*|slain|murder\w*|assassin\w*|poison\w*|behead\w*|struck down|strikes? down)\b/i;
const LEADER_RE = /\b(leader|ruler|king|queen|chancellor|speaker|emperor|empress|khan|sultan|president|regent|general|marshal|commander|captain|warlord)s?\b/i;
const GENERAL_RE = /\b(general|marshal|commander|captain|warlord)s?\b/i;

export class EngineRunner implements WorldRunner {
  private world: World | null = null;        // the truth: only ever changed by applying published events
  private initial: World | null = null;
  private log: WorldEvent[] = [];
  private listeners = new Set<RunnerListener>();
  private lamport = 0;
  private decrees = 0;
  private lastAgents = '';
  private lastAgentsPush = 0;
  private generation = 0;
  private agents = new Map<number, NationAgent>();
  private bus: MessageBus = this.makeBus();
  private scheduler = new RulerScheduler();
  private outgoing: WorldEvent[] = [];         // applied to the truth, waiting to be broadcast
  // Row A7: when each link was cut and each agent deleted, and which deleted nations have fallen.
  private cutAt = new Map<number, number>();
  private deletedAt = new Map<number, number>();
  private fallen = new Set<number>();
  private worldSeq = 0;
  private scanned = 0;                          // how much of `outgoing` the director has looked at
  private clock = new Clock();
  private council = new CouncilKeeper();     // row A29: assassinations, successions, the council controls
  private loop = new TickLoop(this.clock, (n, now) => this.step(n, now));

  constructor() {
    this.clock.onChange = (s) => { for (const l of this.listeners) l.clock?.(s); };
  }

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
    this.scanned = 0;
    this.clock.setPaused(!!opts.paused);         // row A31: prepare mode starts the world paused
    this.clock.reset();
    w.speed = this.clock.target;
    w.paused = !!opts.paused;
    this.lastAgents = '';
    this.bus = this.makeBus();
    this.bus.setObserver(this.observer);
    this.scheduler = new RulerScheduler();
    this.agents.clear();
    this.cutAt.clear();
    this.deletedAt.clear();
    this.fallen.clear();
    this.worldSeq = 0;
    this.council = new CouncilKeeper();
    this.council.observe(w);
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
    if (this.loop.active || !this.world) return;
    this.loop.start();
  }

  stop(): void { this.loop.stop(); }

  /** Row A25: any speed from 1/24 to 64 (clamped); the director may run below it in auto pacing. */
  setSpeed(speed: number): void {
    if (!Number.isFinite(speed)) return;
    if (this.world) this.world.speed = clampSpeed(speed);
    this.clock.setTarget(speed);
  }

  setPaused(paused: boolean): void {
    if (this.world) this.world.paused = paused;
    this.clock.setPaused(paused);
  }

  clockState(): ClockState { return this.clock.state(); }

  /** One timer fire: the ticks the clock says are due (maybe none), then the ruler loop. */
  private step(n: number, now: number): void {
    const w = this.world;
    if (!w || w.paused) return;
    if (n) this.advance(n);
    this.rulers(now);
  }

  /** Runs `ticks` years at once and broadcasts the result (the timer uses it; so can headless checks). */
  advance(ticks: number): void {
    if (!this.world) return;
    for (let i = 0; i < ticks; i++) {
      this.runTick();
      // Auto pacing: stop the rest of this fire's years at the first big moment.
      if (this.scanBig() && this.clock.pacing === 'auto') break;
    }
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
    this.collapseDeleted(tick);
    this.secede(tick);
    this.councilTurn(tick);
  }

  /** Row A29: the world's council news for the year (successions, assassinations), as one batch. */
  private councilTurn(tick: number): void {
    const w = this.world!;
    const bodies = this.council.turn(w, tick, (id) => {
      const a = this.agents.get(id);
      return !!a && !a.deleted && !!w.countries[id]?.alive;
    });
    if (bodies.length) this.bus.deliver(bodies.map((b) => this.worldEvent(b)));
    this.council.observe(w);
  }

  /** Delivers council bodies from a control or decree as one world batch. */
  private councilBatch(bodies: ReturnType<CouncilKeeper['kill']>): void {
    if (!bodies.length) return;
    this.bus.deliver(bodies.map((b) => this.worldEvent(b)));
    this.council.observe(this.world!);
  }

  /** Row A18: a restless region may break away. The world decides (findSecession, a pure function of
   *  the true world; see engine/secession.ts for why), every replica applies the one batch, and the new
   *  nation gets its own agent and ruler, its replica cloned from the true world after the batch. */
  private secede(tick: number): void {
    const plan = findSecession(this.world!, tick, (id) => {
      const a = this.agents.get(id);
      return !!a && !a.deleted && this.bus.link(id) === 'up';
    });
    if (!plan) return;
    const { events, country, regionNames } = secessionBatch(this.world!, plan, (body) => this.worldEvent(body));
    this.bus.deliver(events);
    const agent = this.addAgent(country.id, regionNames, currentMode() === 'live' && !!process.env.GEMINI_API_KEY);
    agent.lamport = this.lamport;
    this.scheduler.notify(country.id);
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
    for (const id of this.scheduler.tick(now, nations, this.world?.tick)) void this.agents.get(id)?.think();
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
    this.scanBig();
    const batch = this.outgoing;
    this.outgoing = [];
    this.scanned = 0;
    this.log.push(...batch);
    for (const l of this.listeners) l.events?.(batch);
  }

  /** Looks at what was applied since the last scan; a big moment tells the pacing director. */
  private scanBig(): boolean {
    const fresh = this.outgoing.slice(this.scanned);
    this.scanned = this.outgoing.length;
    if (!anyBigMoment(fresh, this.world)) return false;
    this.clock.bigMoment();
    return true;
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

  // --- resilience (row A7) ----------------------------------------------------------------------

  /** One event from the world itself (not a nation): silences, returns, disputes, falls. */
  private worldEvent(body: Record<string, unknown> & { type: WorldEvent['type'] }): WorldEvent {
    const n = ++this.worldSeq;
    return { id: `e-w-r${n}`, tick: this.world!.tick, actor: 'world', lamport: ++this.lamport, ...body } as WorldEvent;
  }

  private chronicleEvent(kind: ChronicleKind, countries: number[], text: string): WorldEvent {
    const w = this.world!;
    return this.worldEvent({ type: 'chronicle', entry: { id: `c-w-r${this.worldSeq + 1}`, tick: w.tick, year: w.year, kind, countries, text } });
  }

  /** Links just cut: one `silence` line per nation, heard at once by the world and every up agent
   *  (the cut ones get it queued and read it when they come back). */
  private announceSilence(ids: number[]): void {
    const w = this.world!;
    const batch: WorldEvent[] = [];
    for (const id of ids) {
      const c = w.countries[id];
      this.cutAt.set(id, w.tick);
      if (c) batch.push(this.chronicleEvent('silence', [id], silenceText(w, c)));
    }
    this.bus.deliver(batch);
  }

  /**
   * A link came back. The agent rebuilds its beliefs from the moment it was cut and, on that merged
   * view, the border disputes are settled (resilience.ts: the earlier claim wins). The settlement is
   * one batch: the `return` line, a `tile_claimed` cause 'dispute' for every tile the returning
   * nation wins back, one `dispute` line per pair of nations. Every replica applies that batch, then
   * the nation's queued events (its claims that lost are no longer legal and are dropped), in the same
   * order, so they all converge.
   */
  onRestore(countryId: number, missedByIt: WorldEvent[][], missedByOthers: WorldEvent[]): void {
    const agent = this.agents.get(countryId);
    const w = this.world;
    if (!agent || !w) return;
    const since = this.cutAt.get(countryId) ?? w.tick;
    this.cutAt.delete(countryId);
    const settle = (merged: World): WorldEvent[] => {
      const out: WorldEvent[] = [];
      const me = merged.countries[countryId];
      if (me) out.push(this.chronicleEvent('return', [countryId], returnText(merged, me, w.tick - since)));
      const disputes = me?.alive ? findDisputes(merged, countryId, missedByIt, missedByOthers) : [];
      const pairs = new Map<number, { won: number; lost: number }>();
      for (const d of disputes) {
        const p = pairs.get(d.holder) ?? { won: 0, lost: 0 };
        if (d.winner === countryId) {
          p.won++;
          out.push(this.worldEvent({ type: 'tile_claimed', tile: d.tile, owner: countryId, from: d.holder, cause: 'dispute' }));
        } else p.lost++;
        pairs.set(d.holder, p);
      }
      for (const [holder, p] of [...pairs].sort((a, b) => a[0] - b[0])) {
        const other = merged.countries[holder];
        if (me && other) out.push(this.chronicleEvent('dispute', [countryId, holder], disputeText(me, other, p.won, p.lost)));
      }
      this.lastDisputes = disputes;
      return out;
    };
    const { settled } = agent.rejoin(missedByIt, missedByOthers, settle);
    this.bus.deliver(settled, countryId);
    this.bus.deliver(missedByOthers, countryId);
    this.bus.heartbeat(countryId, w.tick);
  }

  /** The disputes settled by the last restore (for headless checks and logs). */
  lastDisputes: ReturnType<typeof findDisputes> = [];

  /** A nation's agent is removed: no more turns, heartbeats or ruler calls. Its neighbours notice the
   *  silence (NationAgent.noticeSilence) and FALL_AFTER_TICKS later it falls (collapseDeleted). */
  onDelete(countryId: number): void {
    const agent = this.agents.get(countryId);
    if (!agent || agent.deleted) return;
    agent.deleted = true;
    agent.retired = true;
    this.bus.leave(countryId);
    this.scheduler.forget(countryId);
    this.deletedAt.set(countryId, this.world?.tick ?? 0);
  }

  /** A deleted nation that has been silent long enough falls with no conqueror: every structure
   *  becomes a ruin, its units disband, its land is released (cause 'collapse') and its neighbours
   *  carve the ruins up by their ordinary expansion over the next years. */
  private collapseDeleted(tick: number): void {
    const w = this.world!;
    for (const [id, at] of [...this.deletedAt].sort((a, b) => a[0] - b[0])) {
      if (this.fallen.has(id) || tick < at + FALL_AFTER_TICKS) continue;
      this.fallen.add(id);
      const c = w.countries[id];
      if (!c?.alive) continue;
      const batch: WorldEvent[] = [];
      for (const s of w.structures) if (s.owner === id && s.kind !== 'ruin') batch.push(this.worldEvent({ type: 'structure_upgraded', structureId: s.id, kind: 'ruin' }));
      for (const u of w.units) if (u.owner === id) batch.push(this.worldEvent({ type: 'unit_removed', unitId: u.id, reason: 'collapse' }));
      for (let t = 0; t < w.owner.length; t++) if (w.owner[t] === id) batch.push(this.worldEvent({ type: 'tile_claimed', tile: t, owner: -1, from: id, cause: 'collapse' }));
      batch.push(this.worldEvent({ type: 'country_fell', countryId: id }));
      batch.push(this.chronicleEvent('fall', [id], fallText(c)));
      this.bus.deliver(batch);
    }
  }

  control(msg: ControlMessage): void {
    const w = this.world;
    if (!w) return;
    const live = (id: number): NationAgent | undefined => { const a = this.agents.get(id); return a && !a.deleted ? a : undefined; };
    const cut = (a: NationAgent): boolean => { if (!this.bus.cut(a.id)) return false; a.onCut(); return true; };
    switch (msg.action) {
      case 'cut': { const a = live(msg.countryId); if (a && cut(a)) this.announceSilence([a.id]); break; }
      case 'restore': { if (live(msg.countryId)) this.bus.restore(msg.countryId); break; }
      case 'silence': live(msg.countryId)?.silence(); break;
      case 'wake': { const a = live(msg.countryId); if (a) { a.wake(); this.scheduler.notify(a.id); } break; }
      case 'delete': this.onDelete(msg.countryId); break;
      // Row A29: the council controls; the world decides, every replica applies the one batch.
      case 'kill': if (live(msg.countryId)) this.councilBatch(this.council.kill(w, msg.countryId, msg.role)); break;
      case 'cut_member': if (live(msg.countryId)) this.councilBatch(this.council.cut(w, msg.countryId, msg.role)); break;
      case 'restore_member': if (live(msg.countryId)) this.councilBatch(this.council.restore(w, msg.countryId, msg.role)); break;
      case 'blackout': {
        // Every link at once; restore-all goes in ascending id order (the outcome of the disputes
        // does not depend on the order: the earlier claim wins).
        const cutNow: number[] = [];
        for (const id of this.bus.ids()) {
          const a = live(id);
          if (!a) continue;
          if (msg.value) { if (cut(a)) cutNow.push(id); } else this.bus.restore(id);
        }
        if (cutNow.length) this.announceSilence(cutNow);
        break;
      }
      case 'speed': this.setSpeed(msg.value); break;
      case 'pacing': this.clock.setPacing(msg.value); break;
      case 'pause': this.setPaused(msg.value); break;
      case 'decree': {
        // Typed decrees take the same path as spoken ones (row A20): interpret, then applyDecree.
        if (currentMode() === 'live') void interpretDecree(msg.text, w).then((d) => { if (this.world === w) this.applyDecree(d); });
        else this.applyDecree(interpretDecreeMock(msg.text, w));
        return;
      }
    }
    this.syncStatuses();
    this.flushOut();
    this.pushAgents(true);
  }

  /** Applies an interpreted decree: its events go through the bus like any world event (row A20). */
  applyDecree(decree: Decree): void {
    const w = this.world;
    if (!w) return;
    const events = decreeEvents(w, decree, w.tick, { n: ++this.decrees, lamport: () => ++this.lamport });
    this.bus.deliver(events);
    // Row A29: a decree that strikes down a leader or a general kills one (its target nation, else one by hash).
    if (KILL_RE.test(decree.text) && LEADER_RE.test(decree.text)) {
      const alive = w.countries.filter((c) => c.alive && c.council && this.agents.get(c.id) && !this.agents.get(c.id)!.deleted);
      const target = decree.target.countryId ?? alive[hashString(`decree-kill:${decree.text}:${w.tick}`) % Math.max(1, alive.length)]?.id;
      if (target !== undefined) this.councilBatch(this.council.kill(w, target, GENERAL_RE.test(decree.text) ? 'general' : 'ruler'));
    }
    this.syncStatuses();
    this.flushOut();
    this.pushAgents(true);
  }

  /** Row A31 (prepare mode): one ruler's opening decision, asked now while the world waits paused. It
   *  takes the normal path: the agent adopts it and publishes its events on its next turn, exactly as
   *  if the scheduler had called. The scheduler counts it as that nation's decision, so the first
   *  turn uses it instead of a fresh call. */
  async prepareRuler(countryId: number): Promise<boolean> {
    const a = this.agents.get(countryId);
    if (!a || a.deleted || a.silenced || a.ruler !== 'llm') return false;
    const before = a.decision;
    await a.think();
    if (a.retired || a.deleted || a.decision === before) return false;
    this.scheduler.decided(countryId, Date.now(), this.world?.tick);
    return true;
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
