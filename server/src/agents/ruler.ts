// The ruler (row A5): one nation's Gemini decision, from a compact digest to a schema-checked JSON
// decision. On any failure it throws RulerFailed and the caller (row A4) runs the nation on autopilot.
// It never retries. RulerScheduler decides when each nation is next due, spreading calls under the cap.
import { isCombatant, relationOf, type Stance, type TechAge, type World, type WorldEvent } from '@terra/shared';
import { getBudget, llmJson, rulerModel, type Schema } from '../llm';
import { chronicleToneOf, governmentKeyOf } from '../story/identity';

export type Focus = 'expand' | 'develop' | 'fortify' | 'attack';
const FOCUSES: Focus[] = ['expand', 'develop', 'fortify', 'attack'];
const STANCES: Stance[] = ['war', 'hostile', 'neutral', 'trade', 'alliance'];

export class RulerFailed extends Error {
  constructor(message: string, readonly countryId?: number) { super(message); this.name = 'RulerFailed'; }
}

export interface RulerNeighbour { id: number; name: string; stance: Stance; strength: number; grievance: number }
export interface RulerDigest {
  id: number; name: string; government: string; ideology: string; year: number;
  temperament: { aggression: number; expansion: number; trade: number; faith: number };
  treasury: number; population: number; tiles: number; cities: number; armies: number; strength: number;
  techAge: TechAge;                      // its weapons and ships (row A23)
  focus: Focus;
  neighbours: RulerNeighbour[];          // alive nations that share a border; strength is relative to ours (1 = equal)
  chronicle: string[];                   // the last few lines involving this nation
  events: string[];                      // recent big events anywhere
}
export interface RulerDecision {
  focus: Focus;
  target?: number;                       // country id to attack, only with focus 'attack'
  stances: { with: number; stance: Stance }[]; // changes only
  proclamation: string;                  // one sentence for the chronicle
}

const BIG_KINDS = new Set(['war', 'battle', 'fall', 'betrayal', 'alliance', 'peace']);
const r2 = (x: number): number => Math.round(x * 100) / 100;

/** Builds the compact view of the world for one nation. `focus` is its current focus (the engine knows it). */
export function makeDigest(world: World, countryId: number, focus: Focus = 'expand'): RulerDigest {
  const c = world.countries[countryId];
  if (!c) throw new RulerFailed(`no country ${countryId}`, countryId);
  const strengthOf = (id: number) => world.units.filter((u) => u.owner === id && isCombatant(u)).reduce((s, u) => s + u.strength, 0);
  const mine = strengthOf(countryId);
  const tiles = world.owner.reduce((n, o) => n + (o === countryId ? 1 : 0), 0);
  const border = new Set<number>();
  world.owner.forEach((o, t) => {
    if (o !== countryId) return;
    for (const nb of world.tiles[t]!.neighbors) { const no = world.owner[nb]!; if (no >= 0 && no !== countryId) border.add(no); }
  });
  // Nations at war with it or allied to it count as neighbours too, even without a shared border (row A6).
  for (const r of world.relations) {
    if (r.stance !== 'war' && r.stance !== 'alliance') continue;
    if (r.a === countryId) border.add(r.b); else if (r.b === countryId) border.add(r.a);
  }
  const neighbours = [...border].filter((id) => world.countries[id]?.alive).map((id) => {
    const rel = relationOf(world, countryId, id);
    return { id, name: world.countries[id]!.name, stance: rel.stance, strength: r2(strengthOf(id) / Math.max(1, mine)), grievance: r2(rel.grievance) };
  });
  const lines = (es: typeof world.chronicle) => es.map((e) => `y${e.year}: ${e.text.slice(0, 120)}`);
  return {
    id: countryId, name: c.name, government: c.government, ideology: c.ideology.slice(0, 100), year: world.year,
    temperament: { aggression: r2(c.temperament.aggression), expansion: r2(c.temperament.expansion), trade: r2(c.temperament.trade), faith: r2(c.temperament.faith) },
    treasury: Math.round(c.treasury), population: Math.round(c.population), tiles,
    cities: world.structures.filter((s) => s.owner === countryId && (s.kind === 'city' || s.kind === 'capital' || s.kind === 'town')).length,
    armies: world.units.filter((u) => u.owner === countryId && u.kind === 'army').length, strength: Math.round(mine),
    techAge: c.techAge ?? 'ancient',
    focus, neighbours,
    chronicle: lines(world.chronicle.filter((e) => e.countries.includes(countryId)).slice(-5)),
    events: lines(world.chronicle.filter((e) => BIG_KINDS.has(e.kind) && !e.countries.includes(countryId)).slice(-3)),
  };
}

const SYSTEM = [
  'You are the ruler of a nation in a strategy simulation. Stay in character: your government, ideology and temperament',
  'decide what you do. Choose one focus: expand (claim land), develop (grow economy), fortify (defence), attack (go to war).',
  'Only attack a neighbour listed in the digest, by its id. List stance changes only, towards listed neighbours.',
  'The proclamation is one sentence in your own voice for the chronicle. Plain words, no emojis. Reply with JSON only.',
].join(' ');

/** The system prompt plus the government's chronicle voice for the proclamation (A24). */
function systemFor(digest: RulerDigest): string {
  const tone = chronicleToneOf(governmentKeyOf({ government: digest.government, ideology: digest.ideology, temperament: digest.temperament }));
  return `${SYSTEM} Proclamation voice: ${tone}`;
}

const decisionSchema: Schema = {
  type: 'object',
  required: ['focus', 'stances', 'proclamation'],
  properties: {
    focus: { type: 'string', enum: FOCUSES },
    target: { type: 'integer', description: 'neighbour id to attack; only with focus attack' },
    stances: {
      type: 'array', maxItems: 3,
      items: { type: 'object', required: ['with', 'stance'], properties: { with: { type: 'integer' }, stance: { type: 'string', enum: STANCES } } },
    },
    proclamation: { type: 'string', description: 'one sentence, under 25 words' },
  },
};

/** Drops invalid ids and stances; war only against a real neighbour. Pure, exported for reuse. */
export function checkDecision(raw: RulerDecision, digest: RulerDigest): RulerDecision {
  const near = new Map(digest.neighbours.map((n) => [n.id, n]));
  const stances: RulerDecision['stances'] = [];
  for (const s of raw.stances ?? []) {
    const n = near.get(s.with);
    if (!n || !STANCES.includes(s.stance) || s.stance === n.stance) continue;
    if (stances.some((x) => x.with === s.with)) continue;
    stances.push({ with: s.with, stance: s.stance });
  }
  const proclamation = (raw.proclamation ?? '').replace(/\s+/g, ' ').trim().slice(0, 240);
  if (!FOCUSES.includes(raw.focus) || !proclamation) throw new Error('decision has no usable focus or proclamation');
  const out: RulerDecision = { focus: raw.focus, stances, proclamation };
  if (raw.focus === 'attack' && raw.target !== undefined && near.has(raw.target)) out.target = raw.target;
  return out;
}

/** One ruler decision. Throws RulerFailed on mock mode, cap, network or bad output; never retries. */
export async function decide(digest: RulerDigest): Promise<RulerDecision> {
  try {
    const raw = await llmJson<RulerDecision>({
      model: rulerModel(), system: systemFor(digest), purpose: 'ruler', schema: decisionSchema, maxOutputTokens: 220,
      prompt: `Digest (JSON):\n${JSON.stringify(digest)}\nDecide for ${digest.name} now.`,
    });
    return checkDecision(raw, digest);
  } catch (e) {
    throw new RulerFailed(e instanceof Error ? e.message : String(e), digest.id);
  }
}

// --- scheduling ---------------------------------------------------------------

export interface SchedNation { id: number; alive: boolean; silenced: boolean }
export interface SchedulerOptions {
  minMs?: number; maxMs?: number;           // routine interval per nation, default 30 to 45 s
  urgentGapMs?: number;                     // minimum gap between decisions for one nation, default 10 s
  maxCallsPerMin?: number;                  // default LLM_MAX_CALLS_PER_MIN or 20
  minTicks?: number;                        // minimum simulated years between decisions for one nation, default 5 (row A25: very low speeds)
  rng?: () => number;
}

/**
 * Time-driven: the engine loop calls tick(now, nations) often (every second is plenty) and decides
 * for each id returned. notify(id) makes a nation due as soon as its minimum gap allows. At most one id is
 * returned per call to spread calls: a global spacing of 60 s / cap (a little wider) keeps bursts under the cap.
 */
export class RulerScheduler {
  private next = new Map<number, number>();
  private last = new Map<number, number>();
  private lastYear = new Map<number, number>();
  private urgent = new Set<number>();
  private lastAny = 0;
  private o: Required<SchedulerOptions>;
  constructor(opts: SchedulerOptions = {}) {
    const envCap = Number(process.env.LLM_MAX_CALLS_PER_MIN);
    this.o = {
      minMs: 30_000, maxMs: 45_000, urgentGapMs: 10_000, minTicks: 5,
      maxCallsPerMin: Number.isFinite(envCap) && envCap > 0 ? envCap : 20, rng: Math.random, ...opts,
    };
  }

  private jitter(): number { return this.o.minMs + this.o.rng() * (this.o.maxMs - this.o.minMs); }

  /** Something big happened to this nation (war on it, battle or city lost, an ally fell). */
  notify(countryId: number): void { this.urgent.add(countryId); }

  /** Forget a nation (deleted) or reset everything for a new world. */
  forget(countryId?: number): void {
    if (countryId === undefined) { this.next.clear(); this.last.clear(); this.lastYear.clear(); this.urgent.clear(); this.lastAny = 0; return; }
    this.next.delete(countryId); this.last.delete(countryId); this.lastYear.delete(countryId); this.urgent.delete(countryId);
  }

  /** Returns the ids that should be decided now (zero or one). They are marked as decided. */
  tick(now: number, nations: SchedNation[], year?: number): number[] {
    const spacing = (60_000 / this.o.maxCallsPerMin) * 1.1;
    if (now - this.lastAny < spacing) return [];
    if (getBudget().capped) return [];
    let best: { id: number; score: number } | null = null;
    for (const n of nations) {
      if (!n.alive || n.silenced) { this.urgent.delete(n.id); continue; }
      if (!this.next.has(n.id)) this.next.set(n.id, now + this.rngSpread());
      // Row A25: at 0.1x thirty real seconds is under one year; wait for minTicks years as well.
      if (year !== undefined && year - (this.lastYear.get(n.id) ?? -Infinity) < this.o.minTicks) continue;
      const gapOk = now - (this.last.get(n.id) ?? -Infinity) >= this.o.urgentGapMs;
      const isUrgent = this.urgent.has(n.id) && gapOk;
      const due = now >= this.next.get(n.id)!;
      if (!isUrgent && !due) continue;
      // Urgent nations first, then whoever is most overdue.
      const score = (isUrgent ? 1e12 : 0) + (now - this.next.get(n.id)!);
      if (!best || score > best.score) best = { id: n.id, score };
    }
    if (!best) return [];
    this.last.set(best.id, now); this.lastAny = now;
    if (year !== undefined) this.lastYear.set(best.id, year);
    this.next.set(best.id, now + this.jitter());
    this.urgent.delete(best.id);
    return [best.id];
  }

  /** The first decision of each nation is spread over the whole interval so they do not all fire together. */
  private rngSpread(): number { return this.o.rng() * this.o.maxMs; }
}

/** Which nations had something big happen in these events? Feed the result to RulerScheduler.notify. */
export function bigEventTargets(world: World, events: WorldEvent[]): number[] {
  const out = new Set<number>();
  for (const e of events) {
    if (e.type === 'relation_changed' && e.stance === 'war') { out.add(e.a); out.add(e.b); }
    else if (e.type === 'battle') out.add(e.winner === e.attacker ? e.defender : e.attacker);
    else if (e.type === 'tile_claimed' && e.from >= 0 && e.cause === 'conquest') out.add(e.from);
    else if (e.type === 'structure_destroyed') {
      const s = world.structures.find((x) => x.id === e.structureId);
      if (s && s.owner >= 0) out.add(s.owner);
    } else if (e.type === 'country_fell') {
      for (const r of world.relations) {
        if (r.stance !== 'alliance') continue;
        if (r.a === e.countryId) out.add(r.b); else if (r.b === e.countryId) out.add(r.a);
      }
    }
  }
  return [...out];
}
