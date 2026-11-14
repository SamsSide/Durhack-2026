// Row A9: every run is an event log, so every run is saved and can be replayed exactly, offline.
// A recording is two files, written as the run goes so a crash keeps it:
//   server/replays/<worldId>.head.json   the meta and the world at tick 0
//   server/replays/<worldId>.ndjson      one line per event `{"e":...}` or agents update `{"a":...}`
// A finished run can be compacted into one file, server/replays/<id>.json (the demo is one).
// The recorder is only a listener: it never touches the tick loop and never throws.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import type { AgentStatus, World, WorldEvent } from '@terra/shared';
import type { RunnerListener, WorldRunner } from '../runner';

export const REPLAYS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'replays');
const FLUSH_MS = 1000;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** The X2 `agents` update that went out after `at` events had been logged. */
export interface AgentsRecord { at: number; tick: number; agents: AgentStatus[] }

export interface ReplayMeta { id: string; name: string; era: string; prompt: string; createdAt: string }
export interface ReplayFile extends ReplayMeta {
  initial: World;
  events: WorldEvent[];
  agents: AgentsRecord[];
}

// --- recording --------------------------------------------------------------------------------

export class Recorder implements RunnerListener {
  private id = '';
  private ndjson = '';
  private buf: string[] = [];
  private count = 0;
  private lastShape = '';
  private writing: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private runner: WorldRunner, private dir = REPLAYS_DIR) {}

  /** Starts recording a new world: the old run's tail is flushed, the new run's files are begun. */
  snapshot = (w: World): void => {
    try {
      this.flushSync();
      fs.mkdirSync(this.dir, { recursive: true });
      this.id = w.id;
      this.count = 0;
      this.lastShape = '';
      const head: ReplayMeta & { initial: World } = {
        id: w.id, name: w.name, era: w.era, prompt: w.prompt, createdAt: new Date().toISOString(), initial: w,
      };
      fs.rmSync(path.join(this.dir, `${w.id}.json`), { force: true });
      fs.writeFileSync(path.join(this.dir, `${w.id}.head.json`), JSON.stringify(head));
      this.ndjson = path.join(this.dir, `${w.id}.ndjson`);
      fs.writeFileSync(this.ndjson, '');
      if (!this.timer) {
        this.timer = setInterval(() => this.flush(), FLUSH_MS);
        this.timer.unref?.();
        process.once('exit', () => this.flushSync());
      }
      this.agents(w.agents);
    } catch (e) { this.warn(e); }
  };

  events = (batch: WorldEvent[]): void => {
    if (!this.id) return;
    for (const e of batch) this.buf.push(`{"e":${JSON.stringify(e)}}`);
    this.count += batch.length;
  };

  agents = (agents: AgentStatus[]): void => {
    if (!this.id) return;
    // Heartbeats alone (lastHeardTick) are not worth a line; the replay recomputes them.
    const shape = JSON.stringify(agents.map((a) => ({ ...a, lastHeardTick: 0 })));
    if (shape === this.lastShape) return;
    this.lastShape = shape;
    const tick = this.runner.getWorld()?.tick ?? 0;
    this.buf.push(`{"a":${JSON.stringify({ at: this.count, tick, agents } satisfies AgentsRecord)}}`);
  };

  private lastWarn = 0;
  private warn(e: unknown): void {
    if (Date.now() - this.lastWarn < 60_000) return;
    this.lastWarn = Date.now();
    console.warn('replays: recording problem:', e instanceof Error ? e.message : e);
  }

  /** Appends the buffered lines in the background (writes are chained, so they stay in order). */
  private flush(): void {
    if (!this.buf.length) return;
    const text = this.buf.join('\n') + '\n';
    this.buf = [];
    const file = this.ndjson;
    this.writing = this.writing.then(() => fs.promises.appendFile(file, text)).catch((e) => this.warn(e));
  }

  /** Writes everything now (run end, new world, process exit). */
  flushSync(): void {
    if (!this.buf.length || !this.ndjson) return;
    const text = this.buf.join('\n') + '\n';
    this.buf = [];
    try { fs.appendFileSync(this.ndjson, text); } catch (e) { this.warn(e); }
  }

  /** The id of the run being recorded. */
  get currentId(): string { return this.id; }

  /** The files of run `id` once every event heard so far is on disk (GET /api/world/log reads them).
   *  `size` is where the event file ended at that moment: read no further (it keeps growing). */
  async settled(id: string): Promise<RecordingFiles | null> {
    if (!id || id !== this.id) return null;
    this.flush();
    let p: Promise<void>;
    do { p = this.writing; await p; } while (p !== this.writing);
    if (id !== this.id) return null;
    try {
      return { head: path.join(this.dir, `${id}.head.json`), ndjson: this.ndjson, size: fs.statSync(this.ndjson).size };
    } catch { return null; }
  }
}

/** A recording on disk, as far as it was complete when asked (Recorder.settled). */
export interface RecordingFiles { head: string; ndjson: string; size: number }

// --- the log for the timeline scrubber (X3 GET /api/world/log) ----------------------------------

const CHUNK = 256 * 1024;

/** Where the log is written: an HTTP response, in practice. */
export interface LogSink {
  write(chunk: string): boolean;
  once(ev: 'drain' | 'close', fn: () => void): unknown;
  off(ev: 'drain' | 'close', fn: () => void): unknown;
  readonly destroyed: boolean;
}

/** Writes `{"initial":...,"events":[...]}` a chunk at a time, waiting when the client is slow, so a
 *  long run is never built as one string in memory. Stops early if the client goes away. */
export async function writeLog(out: LogSink, initialJson: string, events: Iterable<string> | AsyncIterable<string>): Promise<void> {
  const send = (s: string): Promise<void> | null => {
    if (out.destroyed) return null;
    if (out.write(s)) return null;
    return new Promise((ok) => {
      const done = () => { out.off('drain', done); out.off('close', done); ok(); };
      out.once('drain', done); out.once('close', done);
    });
  };
  await send(`{"initial":${initialJson},"events":[`);
  let buf = '';
  let first = true;
  for await (const e of events) {
    if (out.destroyed) return;
    buf += first ? e : `,${e}`;
    first = false;
    if (buf.length >= CHUNK) { const s = buf; buf = ''; await send(s); }
  }
  await send(`${buf}]}`);
}

/** The recorded events of a run (the `e` lines), as JSON strings, up to `files.size` bytes. */
async function* recordedEvents(files: RecordingFiles): AsyncGenerator<string> {
  if (files.size <= 0) return;
  const lines = readline.createInterface({ input: fs.createReadStream(files.ndjson, { start: 0, end: files.size - 1 }), crlfDelay: Infinity });
  for await (const line of lines) if (line.startsWith('{"e":') && line.endsWith('}')) yield line.slice(5, -1);
}

/** GET /api/world/log for the run being recorded, straight from its files. */
export async function writeRecordedLog(out: LogSink, files: RecordingFiles): Promise<void> {
  const head = JSON.parse(await fs.promises.readFile(files.head, 'utf8')) as { initial: World };
  await writeLog(out, JSON.stringify(head.initial), recordedEvents(files));
}

/** Records every world the runner makes. Returns the recorder (scripts flush it by hand). */
export function bindRecorder(runner: WorldRunner, dir = REPLAYS_DIR): Recorder {
  const rec = new Recorder(runner, dir);
  runner.subscribe(rec);
  return rec;
}

// --- reading ----------------------------------------------------------------------------------

function readJson<T>(file: string): T | null {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return null; }
}

/** Loads one saved run, from a compacted `<id>.json` or from `<id>.head.json` plus `<id>.ndjson`. */
export function loadReplay(id: string, dir = REPLAYS_DIR): ReplayFile | null {
  if (!ID_RE.test(id)) return null;
  const full = readJson<ReplayFile>(path.join(dir, `${id}.json`));
  if (full?.initial && Array.isArray(full.events)) return { ...full, agents: full.agents ?? [] };
  const head = readJson<ReplayMeta & { initial: World }>(path.join(dir, `${id}.head.json`));
  if (!head?.initial) return null;
  let text = '';
  try { text = fs.readFileSync(path.join(dir, `${id}.ndjson`), 'utf8'); } catch { /* no events yet */ }
  const events: WorldEvent[] = [];
  const agents: AgentsRecord[] = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    try {
      const row = JSON.parse(line) as { e?: WorldEvent; a?: AgentsRecord };
      if (row.e) events.push(row.e); else if (row.a) agents.push(row.a);
    } catch { /* a torn last line after a crash */ }
  }
  return { ...head, events, agents };
}

/** Writes a finished run as one file (the demo is saved this way). */
export function saveCompact(file: ReplayFile, dir = REPLAYS_DIR): string {
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${file.id}.json`);
  fs.writeFileSync(out, JSON.stringify(file));
  return out;
}

export interface ReplayListing { id: string; name: string; events: number }
const listingCache = new Map<string, { key: string; row: ReplayListing & { createdAt: string } }>();

function summarise(dir: string, id: string, complete: boolean): (ReplayListing & { createdAt: string }) | null {
  const base = path.join(dir, complete ? `${id}.json` : `${id}.head.json`);
  const nd = path.join(dir, `${id}.ndjson`);
  let key: string;
  try {
    const s = fs.statSync(base);
    const n = complete ? null : fs.statSync(nd, { throwIfNoEntry: false });
    key = `${s.mtimeMs}:${s.size}:${n?.mtimeMs ?? 0}:${n?.size ?? 0}`;
  } catch { return null; }
  const hit = listingCache.get(base);
  if (hit && hit.key === key) return hit.row;
  const f = loadReplay(id, dir);
  if (!f) return null;
  const row = { id, name: f.name, events: f.events.length, createdAt: f.createdAt };
  listingCache.set(base, { key, row });
  return row;
}

/** Saved runs for GET /api/replays: the demo worlds first, then the rest, newest first. */
export function listReplayFiles(dir = REPLAYS_DIR): ReplayListing[] {
  let names: string[] = [];
  try { names = fs.readdirSync(dir); } catch { return []; }
  const complete = new Set(names.filter((n) => n.endsWith('.json') && !n.endsWith('.head.json')).map((n) => n.slice(0, -5)));
  const heads = names.filter((n) => n.endsWith('.head.json')).map((n) => n.slice(0, -10)).filter((id) => !complete.has(id));
  const rows = [
    ...[...complete].map((id) => summarise(dir, id, true)),
    ...heads.map((id) => summarise(dir, id, false)),
  ].filter((r): r is NonNullable<typeof r> => !!r && r.events > 0);
  const demo = (id: string) => id.startsWith('demo-');
  rows.sort((a, b) => (demo(a.id) === demo(b.id)
    ? (demo(a.id) ? a.id.localeCompare(b.id) : b.createdAt.localeCompare(a.createdAt))
    : demo(a.id) ? -1 : 1));
  return rows.map(({ id, name, events }) => ({ id, name, events }));
}
