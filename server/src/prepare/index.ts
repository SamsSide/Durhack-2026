// Row A31 (X2 Prepare): makes a world ready for a demo while it waits paused. Gemini and ElevenLabs
// need about a minute to write the lore and make the voices, so prepare mode makes all of it up front
// (lore, narration, chant per nation; anthems for the biggest nations up to ANTHEM_MAX_PER_RUN; each
// ruler's opening decision), with progress on the socket, and everything is instant once play is
// pressed. It reuses the same cache functions as the routes, so the routes then answer from cache.
// Pressing play at any time starts the world; unfinished items carry on in the background.
//
// Mock mode (--mock or LLM_MODE=mock) makes no API calls: it reports simulated progress over about
// five seconds with the same messages, so the overlay can be built against it.
import type { PrepareItem, PrepareItemKind, PrepareMessage, World } from '@terra/shared';
import type { WorldRunner } from '../runner';
import { currentMode, getBudget } from '../llm';
import { getLore, hasAiLore } from '../story/loreAi';
import { ensureNarration } from '../story/narration';
import { ensureChant } from '../story/chant';
import { anthemFile, anthemLive, anthemMaxPerRun, anthemsGenerated } from '../story/anthem';
import { voiceLive } from '../story/eleven';

const GEMINI_PARALLEL = 3;
const ELEVEN_PARALLEL = 2;
/** Calls per minute left free for everything else (the bible, a decree, a lore click). */
const GEMINI_HEADROOM = 2;
/** How long an item waits for a free slot in the per-minute window before it gives up. */
const RATE_WAIT_MS = 65_000;
const SEND_EVERY_MS = 500;
const MOCK_MS = 5000;
const LORE_RETRY_MS = 5000;

type CapKey = 'gemini' | 'voice' | 'music';
type Item = PrepareItem & { ms?: number; reason?: string };
interface Run {
  worldId: string; items: Item[]; done: boolean; started: number;
  /** Why a budget is spent (Gemini, ElevenLabs speech, ElevenLabs music): the rest of its items fail at once. */
  capped: Partial<Record<CapKey, string>>;
  finished: Promise<PrepareMessage>;
}

let current: Run | null = null;
let latest: PrepareMessage | null = null;
let lastSent = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(m: PrepareMessage) => void>();

/** The socket layer listens here (net/ws.ts). */
export function onPrepare(fn: (m: PrepareMessage) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** The last message sent for this world, for a connection that arrives late; null if none. */
export function latestPrepare(worldId: string): PrepareMessage | null {
  return latest && latest.worldId === worldId ? latest : null;
}

function message(run: Run): PrepareMessage {
  return {
    type: 'prepare', worldId: run.worldId, done: run.done,
    ready: run.items.filter((i) => i.status === 'ready').length, total: run.items.length,
    items: run.items.map(({ kind, countryId, status }) => ({ kind, countryId, status })),
  };
}

/** At most twice a second; `final` (the done message) goes out at once. */
function publish(run: Run, final = false): void {
  if (run !== current) return;
  const send = () => {
    timer = null;
    if (run !== current) return;
    lastSent = Date.now();
    latest = message(run);
    for (const l of listeners) l(latest);
  };
  if (final) { if (timer) clearTimeout(timer); send(); return; }
  if (timer) return;
  const wait = SEND_EVERY_MS - (Date.now() - lastSent);
  if (wait <= 0) send(); else timer = setTimeout(send, wait);
}

/** A tiny priority pool: at most `size` jobs at once, lowest priority number first. */
class Pool {
  private active = 0;
  private seq = 0;
  private queue: { pri: number; seq: number; go: () => void }[] = [];
  constructor(private size: number) {}
  run<T>(pri: number, fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        pri, seq: this.seq++,
        go: () => { this.active++; fn().then(resolve, reject).finally(() => { this.active--; this.pump(); }); },
      });
      this.pump();
    });
  }
  private pump(): void {
    while (this.active < this.size && this.queue.length) {
      this.queue.sort((a, b) => a.pri - b.pri || a.seq - b.seq);
      this.queue.shift()!.go();
    }
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const callsPerMinCap = () => {
  const n = Number(process.env.LLM_MAX_CALLS_PER_MIN);
  return Number.isFinite(n) && n > 0 ? n : 20;
};

class CapReached extends Error {}

/** Waits for room in the per-minute window (leaving some for the rest of the app). Throws CapReached
 *  when the run's token cap is hit or no room comes within RATE_WAIT_MS. */
async function geminiSlot(): Promise<void> {
  const cap = callsPerMinCap();
  const until = Date.now() + RATE_WAIT_MS;
  for (;;) {
    const b = getBudget();
    if (b.capped && b.callsPerMin < cap) throw new CapReached('Gemini token cap for this run reached');
    if (b.callsPerMin < Math.max(1, cap - GEMINI_HEADROOM)) return;
    if (Date.now() > until) throw new CapReached('Gemini per-minute cap: no room for over a minute');
    await sleep(500);
  }
}

/** Biggest nations first (tiles, then people), for the anthem cap. */
function bySize(world: World, ids: number[]): number[] {
  const tiles = new Map<number, number>();
  for (const o of world.owner) if (o >= 0) tiles.set(o, (tiles.get(o) ?? 0) + 1);
  return [...ids].sort((a, b) => (tiles.get(b) ?? 0) - (tiles.get(a) ?? 0)
    || world.countries[b]!.population - world.countries[a]!.population || a - b);
}

/** What prepare will make for this world, in the order the overlay lists it. */
function planItems(runner: WorldRunner, world: World, live: boolean): Item[] {
  const ids = world.countries.filter((c) => c.alive && !world.agents.find((a) => a.countryId === c.id)?.deleted).map((c) => c.id);
  const gemini = !live || !!process.env.GEMINI_API_KEY;
  const voice = !live || voiceLive();
  const music = !live || anthemLive();
  const anthemRoom = Math.max(0, anthemMaxPerRun() - (live ? anthemsGenerated() : 0));
  const anthems = music && gemini ? bySize(world, ids).slice(0, anthemRoom) : [];
  const rulers = live ? !!runner.prepareRuler && gemini : true;
  const out: Item[] = [];
  const add = (kind: PrepareItemKind, list: number[]) => { for (const id of list) out.push({ kind, countryId: id, status: 'pending' }); };
  if (gemini) add('lore', ids);
  if (voice && gemini) add('narration', ids);
  if (voice) add('chant', ids);
  add('anthem', anthems);
  if (rulers) add('ruler', ids);
  return out;
}

/**
 * Pauses the world at its current tick and makes everything above, in parallel within the budgets.
 * One run per world at a time: asking again while it runs returns the same run. Resolves to the
 * final (done) message.
 */
export function prepareWorld(runner: WorldRunner, world: World): Promise<PrepareMessage> {
  if (current && current.worldId === world.id && !current.done) return current.finished;
  runner.setPaused(true);
  const live = currentMode() === 'live';
  let resolve!: (m: PrepareMessage) => void;
  const run: Run = {
    worldId: world.id, items: planItems(runner, world, live), done: false, started: Date.now(), capped: {},
    finished: new Promise<PrepareMessage>((r) => { resolve = r; }),
  };
  if (timer) { clearTimeout(timer); timer = null; }
  current = run;
  console.log(`prepare ${world.id}: ${run.items.length} items (${live ? 'live' : 'simulated'})`);
  publish(run, true);
  const work = live ? runLive(runner, world, run) : runMock(run);
  void work.catch((e) => console.warn('prepare failed:', e instanceof Error ? e.message : e)).finally(() => {
    for (const i of run.items) if (i.status === 'pending' || i.status === 'working') i.status = 'failed';
    run.done = true;
    summarise(run);
    publish(run, true);
    resolve(message(run));
  });
  return run.finished;
}

function summarise(run: Run): void {
  const total = Date.now() - run.started;
  const kinds = [...new Set(run.items.map((i) => i.kind))].map((k) => {
    const ms = run.items.filter((i) => i.kind === k && i.status === 'ready' && i.ms !== undefined).map((i) => i.ms!);
    if (!ms.length) return `${k} none ready`;
    return `${k} avg ${Math.round(ms.reduce((a, b) => a + b, 0) / ms.length)} max ${Math.max(...ms)} ms`;
  });
  const ready = run.items.filter((i) => i.status === 'ready').length;
  console.log(`prepare ${run.worldId}: done in ${total} ms, ${ready}/${run.items.length} ready; ${kinds.join('; ')}`);
}

// --- live --------------------------------------------------------------------------------------

async function runLive(runner: WorldRunner, world: World, run: Run): Promise<void> {
  const gemini = new Pool(GEMINI_PARALLEL);
  const eleven = new Pool(ELEVEN_PARALLEL);
  const alive = () => current === run && runner.getWorld()?.id === world.id;
  const find = (kind: PrepareItemKind, id: number) => run.items.find((i) => i.kind === kind && i.countryId === id);

  const fail = (item: Item, reason: string) => {
    item.status = 'failed'; item.reason = reason;
    console.warn(`prepare ${run.worldId}: ${item.kind} ${item.countryId} failed: ${reason}`);
    publish(run);
  };

  /** Runs one item in a pool slot; resolves true when it is ready. A failure never stops the others. */
  const step = (item: Item | undefined, pool: Pool, capKey: CapKey, pri: number, make: () => Promise<void>): Promise<boolean> => {
    if (!item) return Promise.resolve(false);
    return pool.run(pri, async () => {
      if (!alive()) { item.status = 'failed'; item.reason = 'the world was replaced'; return false; }
      const cap = run.capped[capKey];
      if (cap) { fail(item, cap); return false; }
      try {
        if (capKey === 'gemini') await geminiSlot();
      } catch (e) {
        const why = e instanceof Error ? e.message : String(e);
        run.capped.gemini = why;
        fail(item, why);
        return false;
      }
      item.status = 'working';
      publish(run);
      const t0 = Date.now();
      try {
        await make();
        item.ms = Date.now() - t0;
        item.status = 'ready';
        console.log(`prepare ${run.worldId}: ${item.kind} ${item.countryId} ready in ${item.ms} ms`);
        publish(run);
        return true;
      } catch (e) {
        const why = e instanceof Error ? e.message : String(e);
        if (/cap reached/i.test(why)) run.capped[capKey] = why;
        fail(item, `${why} (after ${Date.now() - t0} ms)`);
        return false;
      }
    });
  };

  const ids = [...new Set(run.items.map((i) => i.countryId))];
  const jobs: Promise<unknown>[] = [];
  for (const id of ids) {
    // Lore first in the Gemini queue: narration and the anthem wait on it.
    // One retry: a lore failure costs the narration and the anthem too, and a 429 is often brief.
    const lore = step(find('lore', id), gemini, 'gemini', 0, async () => {
      for (let attempt = 0; ; attempt++) {
        await getLore(id, world);
        if (hasAiLore(id, world.id)) return;
        if (attempt >= 1 || !alive()) throw new Error('Gemini wrote no lore (the template stands in)');
        console.warn(`prepare ${run.worldId}: lore ${id} failed, trying once more in ${LORE_RETRY_MS} ms`);
        await sleep(LORE_RETRY_MS);
        await geminiSlot();
      }
    });
    jobs.push(lore);
    const after = (kind: 'narration' | 'anthem', capKey: CapKey, pri: number, make: () => Promise<void>) => {
      const item = find(kind, id);
      if (!item) return;
      jobs.push(lore.then((ok) => (ok ? step(item, eleven, capKey, pri, make) : (fail(item, 'its lore failed'), false))));
    };
    // The longest ElevenLabs jobs go first so the slowest one starts early.
    after('anthem', 'music', 0, async () => {
      const l = await getLore(id, world);
      if (!l) throw new Error('no such country');
      await anthemFile(world, world.countries[id]!, l.anthemLyrics);
    });
    after('narration', 'voice', 1, async () => { await ensureNarration(world, id); });
    // The chant's line is a Gemini call too, but it falls back to a template line, so only the voice can fail it.
    jobs.push(step(find('chant', id), eleven, 'voice', 2, async () => { await ensureChant(world, id); }));
    jobs.push(step(find('ruler', id), gemini, 'gemini', 1, async () => {
      if (!(await runner.prepareRuler!(id))) throw new Error('no decision came back (the nation runs on autopilot until its next call)');
    }));
  }
  await Promise.all(jobs);
}

// --- mock --------------------------------------------------------------------------------------

/** Simulated progress over about five seconds, lore before narration, no API calls. */
function runMock(run: Run): Promise<void> {
  const n = run.items.length;
  if (!n) return Promise.resolve();
  let last = 0;
  run.items.forEach((item, i) => {
    const start = 150 + (i / n) * (MOCK_MS - 1200) + ((i * 37) % 200);
    const dur = 300 + ((i * 131) % 600);
    last = Math.max(last, start + dur);
    setTimeout(() => { if (current === run) { item.status = 'working'; publish(run); } }, start);
    setTimeout(() => { if (current === run) { item.status = 'ready'; item.ms = dur; publish(run); } }, start + dur);
  });
  return sleep(last + 50);
}
