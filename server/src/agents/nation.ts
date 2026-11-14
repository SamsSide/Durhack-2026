// A nation agent (row A4): one per country. It keeps its OWN replica of the world (what it believes),
// its own lamport clock and its own policy, takes its turn on its replica, and publishes only its own
// events on the bus. Nobody decides for it. Its ruler (row A5, Gemini) is called rarely and never
// inside the tick loop; between calls, and whenever the ruler is silenced or fails, the rules run on
// its last focus or on autopilotPolicy from its temperament.
import {
  applyEvent, applyTickBatch, autopilotPolicy, cloneWorld, hashString, mulberry32, nationTurn, newAgeMemory, newUnrestMemory, noteUnrestEvents, noteWarEvents, relationOf, rulerPresent,
  type ChronicleKind, type NationPolicy, type WarLedger, type World, type WorldEvent,
} from '@terra/shared';
import type { MessageBus, BusEndpoint } from '../engine/bus';
import { SILENCE_NOTICE_TICKS, noticeText } from '../engine/resilience';
import { bigEventTargets, decide, makeDigest, type Focus, type RulerDecision } from './ruler';

export interface NationAgentOptions {
  regionNames?: string[];
  /** Start with the LLM ruler on (live mode with a key) or on autopilot. */
  rulerOn: boolean;
  /** Something big happened to this nation, as its own replica sees it (feeds RulerScheduler.notify). */
  onBigEvent?: (countryId: number) => void;
}

type EventBody = Record<string, unknown> & { type: WorldEvent['type'] };

export class NationAgent implements BusEndpoint {
  readonly id: number;
  replica: World;
  lamport = 0;
  /** The ruler's last decision as a policy; null runs autopilotPolicy each tick. */
  policy: NationPolicy | null = null;
  /** The focus it used last turn (the ruler digest reports it). */
  focus: Focus = 'expand';
  ruler: 'llm' | 'autopilot';
  silenced = false;
  thinking = false;
  deleted = false;
  /** Rulers answering after the world was replaced or the agent deleted are ignored. */
  retired = false;
  /** Last tick it heard each peer's heartbeat (row A7: neighbours notice the silence). */
  readonly lastHeard = new Map<number, number>();
  /** Silent peers it has already remarked on (cleared when it hears them again): one line per silence. */
  private noticed = new Set<number>();
  /** Its replica at the moment its link was cut; the base for rejoin(). */
  private checkpoint: World | null = null;
  /** Ruler output waiting for its next turn (relation changes, the proclamation). */
  private pendingRuler: EventBody[] = [];
  private lastDecision: { tick: number; decision: RulerDecision } | null = null;
  /** Provinces and battles won and lost per enemy, from the events it applied (row A6). */
  readonly wars: WarLedger = new Map();
  /** Provinces it took and battles it fought, per region, for the unrest of its regions (row A18). */
  readonly unrestMemo = newUnrestMemory();
  /** Its progress towards the next age and the foreign merchant ships it has counted at its ports (row A23). */
  readonly ageMemo = newAgeMemory();

  constructor(id: number, world: World, private bus: MessageBus, private opts: NationAgentOptions) {
    this.id = id;
    this.replica = cloneWorld(world);
    this.ruler = opts.rulerOn ? 'llm' : 'autopilot';
    for (const c of world.countries) if (c.id !== id) this.lastHeard.set(c.id, world.tick);
  }

  /** The policy this turn: the ruler's, or autopilot from its temperament. */
  currentPolicy(): NationPolicy {
    // Row A29: while the ruler's seat is empty or cut off, the general runs the nation on autopilot.
    if (this.policy && !this.silenced && this.ruler === 'llm' && rulerPresent(this.replica, this.id)) {
      // An attack with no named target goes for the neighbour autopilot would pick (row A6).
      if (this.policy.focus === 'attack' && !this.policy.targets?.length) return { ...this.policy, targets: autopilotPolicy(this.replica, this.id).targets };
      return this.policy;
    }
    return autopilotPolicy(this.replica, this.id);
  }

  // --- the turn -----------------------------------------------------------------------------

  /** One year for this nation, on its own replica. Its events go on the bus; if its link is cut it
   *  applies them alone (it believes the world is only what it can see). Then a heartbeat. */
  turn(tick: number, year: number): void {
    if (this.deleted) return;
    const w = this.replica;
    applyEvent(w, { id: `e-${this.id}-${tick}-clock`, tick, actor: 'world', lamport: this.lamport, type: 'tick', year });
    const policy = this.seizeSilence(this.currentPolicy());
    this.focus = policy.focus;
    const rng = mulberry32(hashString(`turn:${w.seed}:${tick}:${this.id}`));
    const events: WorldEvent[] = [
      ...this.rulerEvents(tick, year),
      ...this.noticeSilence(tick, year),
      ...nationTurn(w, this.id, policy, tick, rng, { regionNames: this.opts.regionNames, wars: this.wars, unrest: this.unrestMemo, ages: this.ageMemo }),
    ];
    for (const e of events) e.lamport = ++this.lamport;
    const onWire = this.bus.publish(this.id, events);
    if (!onWire) this.note(applyTickBatch(w, events));
    this.bus.heartbeat(this.id, tick);
  }

  private rulerEvents(tick: number, year: number): WorldEvent[] {
    if (!this.pendingRuler.length) return [];
    const out = this.pendingRuler.map((b, k) => {
      const ev = { id: `e-${this.id}-${tick}-r${k}`, tick, actor: this.id, lamport: 0, ...b } as WorldEvent;
      // Offers keep their protocol id (c-<from>-<tick>-offer-<kind>-<to>, see sim/war.ts).
      if (ev.type === 'chronicle') {
        const id = ev.entry.id.startsWith('offer-') ? `c-${this.id}-${tick}-${ev.entry.id}` : `c-${this.id}-${tick}-r${k}`;
        ev.entry = { ...ev.entry, id, tick, year };
      }
      return ev;
    });
    this.pendingRuler = [];
    return out;
  }

  // --- the bus ------------------------------------------------------------------------------

  receive(batch: WorldEvent[]): void {
    if (this.deleted) return;
    for (const e of batch) if (e.lamport > this.lamport) this.lamport = e.lamport;
    if (this.opts.onBigEvent && bigEventTargets(this.replica, batch).includes(this.id)) this.opts.onBigEvent(this.id);
    this.note(applyTickBatch(this.replica, batch));
  }

  /** What it remembers of the events it applied: its wars (row A6) and its regions' unrest (row A18). */
  private note(applied: WorldEvent[]): void {
    noteWarEvents(this.wars, this.id, applied);
    noteUnrestEvents(this.unrestMemo, this.id, this.replica, applied);
  }

  hear(from: number, tick: number): void { this.lastHeard.set(from, tick); this.noticed.delete(from); }

  /** Peers it has not heard for more than `ticks` (row A7 decides what neighbours do about it). */
  silentPeers(now: number, ticks: number): number[] {
    const out: number[] = [];
    for (const [id, t] of this.lastHeard) if (now - t > ticks) out.push(id);
    return out;
  }

  /** The link was cut: remember what it knew, so the merge on restore starts from common ground. */
  onCut(): void { this.checkpoint ??= cloneWorld(this.replica); }

  /**
   * The link is back (row A7). The agent rebuilds its beliefs from the moment it was cut: first
   * every batch the others exchanged meanwhile, in the order they did; then the settlement of the
   * border disputes (`settle` reads that merged view and returns one batch: the return, the disputed
   * tiles changing hands, the dispute lines); then its own queued events as one batch. Every other
   * replica applies the settlement and the queue in the same order, so they all agree again. Its
   * claims that lost a dispute, or that are no longer legal, are dropped.
   */
  rejoin(
    missedByIt: WorldEvent[][], mine: WorldEvent[], settle: (merged: World) => WorldEvent[] = () => [],
  ): { kept: WorldEvent[]; settled: WorldEvent[] } {
    const { tick, year } = this.replica;
    const base = this.checkpoint ?? this.replica;
    this.checkpoint = null;
    const w = cloneWorld(base);
    for (const batch of missedByIt) {
      for (const e of batch) if (e.lamport > this.lamport) this.lamport = e.lamport;
      applyTickBatch(w, batch);
    }
    const settled = settle(w);
    for (const e of settled) if (e.lamport > this.lamport) this.lamport = e.lamport;
    applyTickBatch(w, settled);
    const kept = applyTickBatch(w, mine);
    applyEvent(w, { id: `e-${this.id}-${tick}-clock`, tick, actor: 'world', lamport: this.lamport, type: 'tick', year });
    this.replica = w;
    // It has just heard from everyone: no stale silences on its first turn back.
    for (const id of this.lastHeard.keys()) this.lastHeard.set(id, tick);
    this.noticed.clear();
    return { kept, settled };
  }

  // --- silence (row A7) ---------------------------------------------------------------------

  /** Living nations that share a border with it, as its replica sees them. */
  private neighbours(): Set<number> {
    const w = this.replica;
    const out = new Set<number>();
    for (let i = 0; i < w.owner.length; i++) {
      if (w.owner[i] !== this.id) continue;
      for (const j of w.tiles[i]!.neighbors) {
        const o = w.owner[j]!;
        if (o >= 0 && o !== this.id && w.countries[o]?.alive) out.add(o);
      }
    }
    return out;
  }

  /** Neighbours it has not heard for SILENCE_NOTICE_TICKS: one chronicle line each per silence, and
   *  an aggressive nation turns hostile to a quiet neutral neighbour. A nation whose own link is cut
   *  hears nobody, so it remarks on nothing (it would report everyone). */
  private noticeSilence(tick: number, year: number): WorldEvent[] {
    if (this.bus.link(this.id) !== 'up') return [];
    const fresh = this.silentPeers(tick, SILENCE_NOTICE_TICKS).filter((id) => !this.noticed.has(id));
    if (!fresh.length) return [];
    const w = this.replica;
    const me = w.countries[this.id];
    if (!me?.alive) return [];
    const near = this.neighbours();
    const out: WorldEvent[] = [];
    for (const id of fresh.sort((a, b) => a - b)) {
      const other = w.countries[id];
      if (!other?.alive || !near.has(id)) continue;
      this.noticed.add(id);
      const k = out.length;
      out.push({
        id: `e-${this.id}-${tick}-q${k}`, tick, actor: this.id, lamport: 0, type: 'chronicle',
        entry: { id: `c-${this.id}-${tick}-q${k}`, tick, year, kind: 'proclamation', countries: [this.id, id], text: noticeText(w, me, other) },
      });
      if (me.temperament.aggression >= 0.55 && relationOf(w, this.id, id).stance === 'neutral') {
        out.push({
          id: `e-${this.id}-${tick}-q${k}h`, tick, actor: this.id, lamport: 0, type: 'relation_changed',
          a: this.id, b: id, stance: 'hostile', reason: `${me.name} reads the silence of ${other.name.replace(/^The /, 'the ')} as weakness.`,
        });
      }
    }
    return out;
  }

  /** The opportunity: a quiet neighbour it has noticed goes to the front of its target list, so if
   *  it turns to attack its armies march on that border. Its focus itself is left alone. */
  private seizeSilence(policy: NationPolicy): NationPolicy {
    if (!this.noticed.size || !policy.targets?.length) return policy;
    const quiet = policy.targets.filter((t) => this.noticed.has(t));
    if (!quiet.length) return policy;
    return { ...policy, targets: [...quiet, ...policy.targets.filter((t) => !this.noticed.has(t))] };
  }

  // --- the ruler ----------------------------------------------------------------------------

  /** Calls the ruler once (fire and forget from the engine; never awaited inside a tick). A cut
   *  nation can still think: its ruler reads its own, possibly stale, replica. */
  async think(): Promise<void> {
    if (this.thinking || this.deleted || this.silenced) return;
    if (!rulerPresent(this.replica, this.id)) return;          // row A29: no ruler, no council of state
    this.thinking = true;
    try {
      const decision = await decide(makeDigest(this.replica, this.id, this.focus));
      if (this.retired || this.deleted || this.silenced || !rulerPresent(this.replica, this.id)) return;
      this.adopt(decision);
    } catch {
      // RulerFailed (mock mode, cap, network, bad output): autopilot until the next good answer.
      if (!this.retired && !this.deleted) this.fallBack();
    } finally {
      this.thinking = false;
    }
  }

  /** A good decision: its policy, its stance changes and one proclamation, published next turn. */
  adopt(d: RulerDecision): void {
    const me = this.replica.countries[this.id];
    if (!me) return;
    this.policy = { focus: d.focus, targets: d.target !== undefined ? [d.target] : undefined };
    this.ruler = 'llm';
    this.lastDecision = { tick: this.replica.tick, decision: d };
    // Row A6: war is declared by one side; peace, trade and alliance are offers the other side accepts
    // on its own turn (sim/war.ts diplomacyTurn); stepping down from friendship is one-sided.
    const chron = (kind: 'war' | 'peace' | 'alliance' | 'betrayal' | 'proclamation', other: number, text: string, id = ''): void => {
      this.pendingRuler.push({ type: 'chronicle', entry: { id, tick: 0, year: 0, kind, countries: [this.id, other], text } });
    };
    const reason = d.proclamation.slice(0, 160);
    for (const s of d.stances) {
      const other = this.replica.countries[s.with];
      if (!other || !other.alive) continue;
      const cur = relationOf(this.replica, this.id, s.with).stance;
      if (s.stance === cur) continue;
      if (s.stance === 'war') {
        this.pendingRuler.push({ type: 'relation_changed', a: this.id, b: s.with, stance: 'war', reason });
        chron('war', s.with, `${me.name} declares war on ${other.name}.`);
        if (cur === 'alliance') chron('betrayal', s.with, `${me.name} turns on its ally ${other.name}.`);
      } else if (cur === 'war') {
        chron('peace', s.with, `${me.name} sends envoys to ${other.name} to talk of peace.`, `offer-peace-${s.with}`);
      } else if (s.stance === 'trade' || (s.stance === 'alliance' && cur !== 'trade')) {
        chron('proclamation', s.with, `${me.name} sends merchants to ${other.name} with an offer of trade.`, `offer-trade-${s.with}`);
      } else if (s.stance === 'alliance') {
        chron('alliance', s.with, `${me.name} offers an alliance to ${other.name}.`, `offer-alliance-${s.with}`);
      } else {
        this.pendingRuler.push({ type: 'relation_changed', a: this.id, b: s.with, stance: s.stance, reason });
        if (cur === 'alliance') chron('betrayal', s.with, `${me.name} renounces its alliance with ${other.name}.`);
      }
    }
    this.pendingRuler.push({
      type: 'chronicle',
      entry: { id: '', tick: 0, year: 0, kind: 'proclamation', countries: [this.id], text: `${me.leader} of ${me.name} proclaims: "${d.proclamation}"` },
    });
  }

  /** The ruler failed, was silenced or the budget is capped: run on autopilot from temperament. */
  fallBack(): void {
    this.policy = null;
    this.ruler = 'autopilot';
  }

  silence(): void { this.silenced = true; this.fallBack(); }
  wake(): void { this.silenced = false; this.ruler = 'llm'; }

  /** The last decision its ruler made, for logs and the live check. */
  get decision() { return this.lastDecision; }
}
