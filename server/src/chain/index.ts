// Row A27: the chain records every coin that moves between nations. The simulation stays the
// source of truth for treasuries (income and spending never leave the sim); this module only
// listens. A `payment` event becomes a ledger row, rows settle on a wall-clock window (netted per
// payer and payee, memo plus transfer, signed by the payer nation's own wallet), and the chain never
// makes the tick loop wait: all network work is async, caught, backed off and behind a breaker.
// Per nation, `ledger` = genesis float + confirmed payments in - confirmed payments out (+ Commons
// advances); `onChain` is what the chain holds; they should agree to the cent.
// SOLANA_MODE: off (nothing), mock (default: fake signatures, no network) or devnet.
import fs from 'node:fs';
import path from 'node:path';
import type { EconomyMessage, EconomyMode, EconomyState, LedgerEntry, WorldEvent, World } from '@terra/shared';
import { REPLAYS_DIR } from '../engine/replays';
import type { WorldRunner } from '../runner';
import { MockBackend } from './mock';
import {
  explorerAddress, explorerTx, floatSize, SUPPLY, SYMBOL, currencyName, plainName,
  type ChainBackend, type Group, type GroupResult, type Outcome,
} from './types';
import { fakeAddress } from './wallets';

export type ChainMessage = EconomyMessage | { type: 'ledger'; entries: LedgerEntry[] };

const RECENT = 50;
const MAX_ROWS = 5000;
const MAX_ATTEMPTS = 3;
const BREAKER_AFTER = 5;               // failed windows in a row
const POLL_MS = 2_000;
const BREAKER_MS = 30_000;
const GENESIS_RETRY_MS = 30_000;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const num = (raw: string | undefined, dflt: number, min: number) => {
  const n = Number(raw);
  return Number.isFinite(n) && n >= min ? n : dflt;
};
const log = (s: string) => console.log(`chain: ${s}`);
const round2 = (n: number) => Math.round(n * 100) / 100;

interface Sidecar {
  worldId: string; mode: EconomyMode;
  info: { name: string; symbol: string; mint: string; supply: number; mintAuthority: string | null; commons: string } | null;
  addresses: Record<string, string>;
  totals: { payments: number; volume: number; transactions: number; feesSol: number };
  /** Genesis floats by country id, so a replay can show the ledger. */
  floats?: Record<string, number>;
  rows: LedgerEntry[];
}

class Chain {
  private world: { id: string; name: string } | null = null;
  private year = 0;
  private rows = new Map<string, LedgerEntry>();
  private attempts = new Map<string, number>();
  private changed = new Set<string>();
  private payments = 0;
  private volume = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private lastEcon = '';
  private lastEconAt = 0;
  private online = true;
  private failures = 0;
  private breakerUntil = 0;
  private settling = false;
  private polling = false;
  private maintaining = false;
  /** Per nation: genesis float + confirmed payments in - out (+ advances). */
  private ledger = new Map<number, number>();
  private commonsLedger = 0;
  /** Groups sent and not yet confirmed, by group id. */
  private flights = new Map<string, Group>();
  private groupSeq = 0;
  private genesisRunning = false;
  private genesisTimer: ReturnType<typeof setTimeout> | null = null;
  private playback = false;
  private saved: Sidecar | null = null;
  private lastSave = 0;
  private savedCount = -1;
  /** Nations founded after genesis whose token account is not open yet, by country id. */
  private opening = new Map<number, { name: string; tries: number; at: number }>();
  private openRunning = false;
  private noWallet = new Set<number>();
  private names = new Map<number, string>();

  constructor(private runner: WorldRunner, readonly mode: Exclude<EconomyMode, 'off'>, private backend: ChainBackend,
    private settleMs: number, private maxTx: number) {}

  // --- fan-out -----------------------------------------------------------------------------

  private emit(m: ChainMessage): void { for (const l of listeners) { try { l(m); } catch { /* a closed socket */ } } }
  private touch(row: LedgerEntry): void {
    this.changed.add(row.id);
    this.flushTimer ??= setTimeout(() => this.flushRows(), 200);
  }
  private flushRows(): void {
    this.flushTimer = null;
    const entries = [...this.changed].map((id) => this.rows.get(id)).filter((r): r is LedgerEntry => !!r);
    this.changed.clear();
    if (entries.length) this.emit({ type: 'ledger', entries });
  }
  private pending(): number { let n = 0; for (const r of this.rows.values()) if (r.status === 'queued' || r.status === 'sent') n++; return n; }
  economy(): EconomyMessage {
    const t = this.totals();
    return {
      type: 'economy', mode: this.mode, online: this.online, pending: this.pending(),
      payments: t.payments, volume: round2(t.volume), feesSol: Math.round(t.feesSol * 1e6) / 1e6,
    };
  }
  private totals() {
    if (this.playback) {
      const s = this.saved?.totals;
      return { payments: this.payments, volume: this.volume, transactions: s?.transactions ?? 0, feesSol: s?.feesSol ?? 0 };
    }
    const st = this.backend.stats();
    return { payments: this.payments, volume: this.volume, transactions: st.transactions, feesSol: st.feesSol };
  }
  /** Sent to a socket that has just connected. */
  hello(): ChainMessage[] {
    const recent = this.recent(RECENT).reverse();
    return [...(recent.length ? [{ type: 'ledger' as const, entries: recent }] : []), this.economy()];
  }
  private recent(n: number): LedgerEntry[] { return [...this.rows.values()].slice(-n).reverse(); }

  private flushEconomy(): void {
    const m = this.economy();
    const s = JSON.stringify(m);
    if (s === this.lastEcon || Date.now() - this.lastEconAt < 1000) return;
    this.lastEcon = s; this.lastEconAt = Date.now();
    this.emit(m);
  }

  // --- the world ---------------------------------------------------------------------------

  start(): void {
    this.runner.subscribe({
      snapshot: (w) => { try { this.onSnapshot(w); } catch (e) { log(`snapshot failed: ${msg(e)}`); } },
      events: (events) => { try { this.onEvents(events); } catch (e) { log(`events failed: ${msg(e)}`); } },
    });
    // Each timer catches everything, including a throw before the task's own try block (a backend
    // that throws from ready() or balanceOf(), say): a chain fault is a log line, never a rejection.
    const guard = (what: string, task: () => Promise<void>) => () => {
      try { task().catch((e) => log(`${what} failed: ${msg(e)}`)); } catch (e) { log(`${what} failed: ${msg(e)}`); }
    };
    setInterval(guard('settle window', () => this.tickSettle()), this.settleMs).unref();
    setInterval(guard('status poll', () => this.tickPoll()), POLL_MS).unref();
    setInterval(guard('account opening', () => this.tickOpen()), 2000).unref();
    setInterval(() => { try { this.flushEconomy(); this.maybeSave(); } catch (e) { log(`housekeeping failed: ${msg(e)}`); } }, 1000).unref();
    setInterval(guard('balance read', () => this.tickMaintain()), 1000).unref();
  }

  /** A world that already exists when the module starts (devnet loads its libraries lazily). */
  adopt(w: World): void { try { this.onSnapshot(w); } catch (e) { log(`adopt failed: ${msg(e)}`); } }

  private onSnapshot(w: World): void {
    const same = this.world?.id === w.id;
    this.playback = !!this.runner.playback?.();
    this.world = { id: w.id, name: w.name };
    this.year = w.year;
    if (same && !this.playback) return;
    this.rows.clear(); this.attempts.clear(); this.changed.clear(); this.flights.clear();
    this.payments = 0; this.volume = 0; this.savedCount = -1;
    this.ledger.clear(); this.commonsLedger = 0;
    this.opening.clear(); this.noWallet.clear(); this.names.clear();
    this.saved = this.playback ? this.loadSidecar(w.id) : null;
    if (this.playback) this.seedPlaybackLedger(w);
    if (this.genesisTimer) { clearTimeout(this.genesisTimer); this.genesisTimer = null; }
    this.lastEcon = '';
    if (!this.playback) this.runGenesis(w).catch((e) => log(`genesis failed: ${msg(e)}`));
  }

  private loadSidecar(id: string): Sidecar | null {
    if (!ID_RE.test(id)) return null;
    try {
      const s = JSON.parse(fs.readFileSync(path.join(REPLAYS_DIR, `${id}.ledger.json`), 'utf8')) as Sidecar;
      return Array.isArray(s.rows) ? s : null;
    } catch { return null; }
  }

  /** A replay has no chain to read: the ledger starts from the saved floats (or the default) and
   *  follows the replayed rows, and on-chain shows the same. */
  private seedPlaybackLedger(w: World): void {
    const saved = this.saved?.floats;
    let total = 0;
    for (const c of w.countries) {
      const f = saved ? saved[String(c.id)] : (c.alive ? floatSize() : undefined);
      if (f === undefined) continue;
      this.ledger.set(c.id, f); total += f;
    }
    this.commonsLedger = Math.max(0, SUPPLY - total);
  }

  private async runGenesis(w: World): Promise<void> {
    if (this.genesisRunning) return;
    this.genesisRunning = true;
    try {
      await this.backend.genesis(w);
      if (this.world?.id !== w.id) return;
      const f = this.backend.floats();
      this.ledger = new Map(f.nations); this.commonsLedger = f.commons;
      this.online = true; this.failures = 0;
      const info = this.backend.info();
      log(`${this.mode} genesis done mint=${info?.mint ?? '?'} supply=${info?.supply ?? SUPPLY} ${info?.symbol ?? SYMBOL}`);
    } catch (e) {
      this.online = false;
      log(`${this.mode} genesis failed, will retry: ${msg(e)}`);
      const id = w.id;
      this.genesisTimer = setTimeout(() => { this.genesisTimer = null; if (this.world?.id === id && !this.playback) void this.runGenesis(w); }, GENESIS_RETRY_MS);
      this.genesisTimer.unref?.();
    } finally { this.genesisRunning = false; }
  }

  private onEvents(events: WorldEvent[]): void {
    this.playback = !!this.runner.playback?.();
    for (const ev of events) {
      if (ev.type === 'tick') this.year = ev.year;
      else if (ev.type === 'country_founded') this.onFounded(ev.country);
      else if (ev.type === 'payment') this.onPayment(ev, this.runner.getWorld()?.tick ?? ev.tick);
    }
  }

  /** A nation founded mid-game gets a token account (live runs only, never in a replay). */
  private onFounded(c: { id: number; name: string }): void {
    this.names.set(c.id, plainName(c.name));
    if (this.playback || !this.backend.openAccount) return;
    if (this.backend.canMove(c.id) || this.opening.has(c.id)) return;
    this.opening.set(c.id, { name: plainName(c.name), tries: 0, at: 0 });
  }

  /** One account at a time, retried a few times; never blocks settlement. */
  private async tickOpen(): Promise<void> {
    if (this.openRunning || this.playback || !this.opening.size || !this.backend.ready() || !this.backend.openAccount) return;
    if (Date.now() < this.breakerUntil || this.backend.backingOff?.()) return;
    const now = Date.now();
    const next = [...this.opening.entries()].find(([, j]) => now - j.at >= 10_000 * j.tries);
    if (!next) return;
    const [id, job] = next;
    this.openRunning = true; job.tries++; job.at = now;
    try {
      const ok = await this.backend.openAccount(id, job.name);
      if (ok) { this.opening.delete(id); log(`opened the token account of ${job.name} (nation ${id})`); }
      else {
        this.opening.delete(id);
        if (!this.noWallet.has(id)) { this.noWallet.add(id); log(`nation ${id} has no wallet file`); }
      }
    } catch (e) {
      log(`opening the account of ${job.name} failed (try ${job.tries}): ${msg(e).split('\n')[0]}`);
      if (job.tries >= MAX_ATTEMPTS) { this.opening.delete(id); log(`giving up on the account of nation ${id}; its payments will not move on chain`); }
    } finally { this.openRunning = false; }
  }

  private onPayment(ev: Extract<WorldEvent, { type: 'payment' }>, _tick: number): void {
    if (!(ev.amount > 0) || ev.from === ev.to) return;
    const id = `p-${ev.id.replace(/^e-/, '')}`;
    if (this.rows.has(id)) return;
    const base: LedgerEntry = {
      id, eventIds: [ev.id], tick: ev.tick, year: this.year, from: ev.from, to: ev.to,
      amount: round2(ev.amount), reason: ev.reason, note: ev.note, status: 'queued',
    };
    let row = base;
    if (this.playback) {
      // A replay sends nothing to the chain: rows come from the saved sidecar, else they are simulated.
      const saved = this.saved?.rows.find((r) => r.eventIds.includes(ev.id));
      row = saved ? { ...base, status: saved.status, signature: saved.signature, url: saved.url ?? null }
        : { ...base, status: 'simulated', url: null };
      this.payments++; this.volume += row.amount;
      if (row.status === 'confirmed' || row.status === 'simulated') { this.move(row.from, -row.amount); this.move(row.to, row.amount); }
    }
    this.rows.set(id, row);
    if (this.rows.size > MAX_ROWS) {
      for (const k of this.rows.keys()) { const st = this.rows.get(k)!.status; if (st !== 'queued' && st !== 'sent') { this.rows.delete(k); this.attempts.delete(k); break; } }
    }
    this.touch(row);
  }

  // --- settlement --------------------------------------------------------------------------

  private move(who: number | 'commons', delta: number): void {
    if (who === 'commons') { this.commonsLedger = round2(this.commonsLedger + delta); return; }
    if (!this.ledger.has(who) && delta === 0) return;
    this.ledger.set(who, round2((this.ledger.get(who) ?? 0) + delta));
  }

  /** Queued rows netted per (payer, payee). A payer whose ledger, less what it already has in
   *  flight, cannot cover the transfer gets a Commons advance in the same transaction. */
  private groups(): Group[] {
    const by = new Map<string, Group>();
    for (const r of this.rows.values()) {
      if (r.status !== 'queued') continue;
      const key = `${r.from}|${r.to}`;
      const g = by.get(key);
      if (g) {
        g.amount = round2(g.amount + r.amount); g.rows.push(r);
        if (!g.reasons.includes(r.reason)) g.reasons.push(r.reason);
        g.note = `${g.rows[0]!.note} +${g.rows.length - 1}`;
      } else {
        by.set(key, {
          id: `g${++this.groupSeq}`, from: r.from, to: r.to, reason: r.reason, reasons: [r.reason],
          amount: r.amount, note: r.note, year: r.year, advance: 0, rows: [r],
        });
      }
    }
    const committed = new Map<number, number>();
    for (const g of this.flights.values()) committed.set(g.from, (committed.get(g.from) ?? 0) + g.amount - g.advance);
    const nameOf = (id: number) => this.names.get(id) ?? plainName(this.runner.getWorld()?.countries.find((c) => c.id === id)?.name ?? `Nation ${id}`);
    // A nation whose token account is still opening: its payments wait, queued, until it exists.
    const out = [...by.values()].filter((g) => !this.waitingForAccount(g.from) && !this.waitingForAccount(g.to));
    for (const g of out) {
      g.fromName = nameOf(g.from); g.toName = nameOf(g.to);
      if (!this.backend.canMove(g.from) || !this.backend.canMove(g.to)) continue;
      const known = this.ledger.get(g.from) ?? 0;
      const read = this.backend.balanceOf(g.from);
      const have = round2(Math.min(known, read ?? known) - (committed.get(g.from) ?? 0));
      if (have < g.amount) g.advance = round2(Math.ceil(g.amount - Math.max(0, have)) + 1);
      committed.set(g.from, (committed.get(g.from) ?? 0) + g.amount - g.advance);
    }
    return out;
  }

  private waitingForAccount(id: number): boolean {
    return this.opening.has(id) && !!this.backend.needsAccount?.(id);
  }

  private async tickSettle(): Promise<void> {
    if (this.settling || this.playback || !this.backend.ready()) return;
    if (Date.now() < this.breakerUntil || this.backend.backingOff?.()) return;
    const groups = this.groups();
    if (!groups.length && !this.flights.size) return;
    this.settling = true;
    try {
      let results: GroupResult[];
      try { results = await this.backend.settle(groups, this.maxTx); }
      catch (e) { results = groups.slice(0, 1).map((g) => ({ group: g, ok: false, error: msg(e) })); }
      for (const r of results) this.apply(r);
      const bad = results.filter((r) => !r.ok);
      if (bad.length && !results.some((r) => r.ok)) {
        this.failures += 1;
        log(`settlement failed (${this.failures} in a row): ${(bad[0]!.error ?? 'unknown').split('\n')[0]}`);
        if (this.failures >= BREAKER_AFTER) {
          this.breakerUntil = Date.now() + BREAKER_MS; this.online = false; this.failures = 0;
          log(`ledger offline, pausing ${BREAKER_MS / 1000} s with ${this.pending()} payments waiting`);
        }
      } else if (results.some((r) => r.ok)) { this.failures = 0; this.online = true; }
    } catch (e) { log(`settlement crashed: ${msg(e)}`); }
    finally { this.settling = false; this.flushEconomy(); }
  }

  private apply(res: GroupResult): void {
    const g = res.group;
    if (res.status === 'sent' && res.signature) {
      if (this.flights.has(g.id)) return; // a resend of a group already in flight
      this.flights.set(g.id, g);
      for (const row of g.rows) {
        const live = this.rows.get(row.id);
        if (!live) continue;
        live.status = 'sent'; live.signature = res.signature; live.url = this.mode === 'devnet' ? explorerTx(res.signature) : null;
        this.touch(live);
      }
    } else if (res.status === 'simulated' || res.status === 'confirmed') {
      this.confirm(g, res.status, res.signature);
    }
    // Otherwise the send never left (no signature): the rows stay queued for the next window.
  }

  /** A group landed: its rows are settled and the ledger moves (only when something moved). */
  private confirm(g: Group, status: 'confirmed' | 'simulated', signature?: string): void {
    if (signature) {
      if (g.advance > 0) { this.move('commons', -g.advance); this.move(g.from, g.advance); }
      this.move(g.from, -g.amount); this.move(g.to, g.amount);
    }
    for (const row of g.rows) {
      const live = this.rows.get(row.id);
      if (!live) continue;
      live.status = status;
      if (signature) { live.signature = signature; live.url = this.mode === 'devnet' ? explorerTx(signature) : null; }
      else live.url = null;
      this.payments++; this.volume += live.amount;
      this.touch(live);
    }
  }

  private async tickPoll(): Promise<void> {
    if (this.polling || this.playback || !this.flights.size || !this.backend.poll || !this.backend.ready()) return;
    this.polling = true;
    try {
      const outcomes = await this.backend.poll();
      for (const o of outcomes) this.onOutcome(o);
      if (outcomes.length) this.flushEconomy();
    } catch (e) { log(`status poll failed: ${msg(e).split('\n')[0]}`); }
    finally { this.polling = false; }
  }

  private onOutcome(o: Outcome): void {
    const g = this.flights.get(o.groupId);
    if (!g) return;
    this.flights.delete(o.groupId);
    if (o.status === 'confirmed') {
      const sig = g.rows.map((r) => this.rows.get(r.id)?.signature).find(Boolean);
      this.confirm(g, 'confirmed', sig);
      this.failures = 0; this.online = true;
      return;
    }
    if (o.status === 'failed') log(`payment ${g.rows[0]?.id ?? g.id} failed on chain: ${o.error ?? 'unknown'}`);
    for (const row of g.rows) {
      const live = this.rows.get(row.id);
      if (!live) continue;
      if (o.status === 'failed') live.status = 'failed';
      else {
        // It provably never landed: send it again, with a fresh blockhash, unless it keeps expiring.
        const n = (this.attempts.get(row.id) ?? 0) + 1;
        this.attempts.set(row.id, n);
        live.status = n >= MAX_ATTEMPTS ? 'failed' : 'queued';
        delete live.signature; delete live.url;
      }
      this.touch(live);
    }
  }

  private async tickMaintain(): Promise<void> {
    if (!this.backend.maintain || this.maintaining || this.playback || !this.backend.ready()) return;
    const w = this.runner.getWorld();
    if (!w) return;
    this.maintaining = true;
    try { await this.backend.maintain(w); }
    catch (e) { log(`balance read failed: ${msg(e).split('\n')[0]}`); }
    finally { this.maintaining = false; }
  }

  // --- the demo sidecar --------------------------------------------------------------------

  private maybeSave(): void {
    if (this.mode !== 'devnet' || this.playback || !this.world || !ID_RE.test(this.world.id)) return;
    if (Date.now() - this.lastSave < 10_000) return;
    const rows = [...this.rows.values()].filter((r) => r.status === 'confirmed');
    if (!rows.length || rows.length === this.savedCount) return;
    this.lastSave = Date.now();
    try {
      const w = this.runner.getWorld();
      const addresses: Record<string, string> = {};
      for (const c of w?.countries ?? []) { const a = this.backend.addressOf(c.id); if (a) addresses[String(c.id)] = a; }
      const floats: Record<string, number> = {};
      for (const [id, f] of this.backend.floats().nations) floats[String(id)] = f;
      const file: Sidecar = {
        worldId: this.world.id, mode: this.mode, info: this.backend.info(), addresses, totals: this.totals(), floats,
        rows: [...this.rows.values()],
      };
      fs.mkdirSync(REPLAYS_DIR, { recursive: true });
      fs.writeFileSync(path.join(REPLAYS_DIR, `${this.world.id}.ledger.json`), JSON.stringify(file));
      this.savedCount = rows.length;
    } catch (e) { log(`could not save the ledger sidecar: ${msg(e)}`); }
  }

  // --- GET /api/economy --------------------------------------------------------------------

  state(): EconomyState | null {
    const w = this.runner.getWorld();
    const wid = this.world?.id ?? w?.id ?? 'none';
    const fromSide = this.playback ? this.saved : null;
    let info = this.backend.ready() ? this.backend.info() : null;
    if (this.playback) info = fromSide?.info ?? null;
    const mockLike = this.mode === 'mock' || (this.playback && !info);
    if (!info && mockLike) {
      info = {
        name: currencyName(w ?? { name: 'Terra Nova' }), symbol: SYMBOL, mint: fakeAddress(`${wid}:mint`), supply: SUPPLY,
        mintAuthority: null, commons: fakeAddress(`${wid}:commons`),
      };
    }
    if (!info) return null; // devnet, genesis not done yet
    const link = (a: string) => (mockLike ? null : explorerAddress(a));
    const addr = (id: number) => (this.playback ? fromSide?.addresses[String(id)] ?? fakeAddress(`${wid}:nation:${id}`) : this.backend.addressOf(id));
    // A nation with a payment in flight may already show it on chain but not yet in the ledger:
    // it is not counted as out of sync until that payment is confirmed.
    const busy = new Set<number>();
    for (const g of this.flights.values()) { busy.add(g.from); busy.add(g.to); }
    const nations = (w?.countries ?? []).flatMap((c) => {
      const a = addr(c.id);
      if (!a) return [];
      const ledger = round2(this.ledger.get(c.id) ?? 0);
      const real = this.playback ? null : this.backend.balanceOf(c.id);
      const onChain = round2(real ?? ledger);
      const drift = round2(onChain - ledger);
      return [{
        countryId: c.id, address: a, url: link(a), onChain, ledger, sim: round2(c.treasury), drift,
        inSync: busy.has(c.id) || Math.abs(drift) <= 0.01,
      }];
    });
    const realCommons = this.playback ? null : this.backend.commonsBalance();
    const t = this.totals();
    return {
      mode: this.mode, cluster: this.mode === 'devnet' ? 'devnet' : 'mock',
      currency: { name: info.name, symbol: info.symbol, mint: info.mint, url: link(info.mint), supply: info.supply, mintAuthority: info.mintAuthority },
      commons: { address: info.commons, url: link(info.commons), balance: round2(realCommons ?? this.commonsLedger) },
      nations,
      totals: { payments: t.payments, volume: round2(t.volume), transactions: t.transactions, feesSol: Math.round(t.feesSol * 1e6) / 1e6 },
      recent: this.recent(RECENT),
    };
  }
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

const listeners = new Set<(m: ChainMessage) => void>();
let chain: Chain | null = null;
let chainMode: EconomyMode = 'off';
export function chainActive(): Chain | null { return chain; }
export function chainModeNow(): EconomyMode { return chainMode; }
/** Lets the WebSocket layer forward `ledger` and `economy` messages; returns an unsubscribe. */
export function onChainMessage(fn: (m: ChainMessage) => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
/** The messages a freshly connected socket should get. */
export function chainHello(): ChainMessage[] { try { return chain?.hello() ?? []; } catch { return []; } }

export function bindChain(runner: WorldRunner): void {
  try {
    const raw = (process.env.SOLANA_MODE ?? 'mock').trim().toLowerCase();
    const mode: EconomyMode = raw === 'off' || raw === 'devnet' || raw === 'mock' ? raw : 'mock';
    chainMode = mode;
    if (raw !== mode) log(`unknown SOLANA_MODE "${raw}", using mock`);
    if (mode === 'off') { log('SOLANA_MODE=off, economy mirror off'); return; }
    const settleMs = num(process.env.SOLANA_SETTLE_MS, 5000, 500);
    const maxTx = Math.floor(num(process.env.SOLANA_MAX_TX_PER_WINDOW, 4, 1));
    if (mode === 'mock') {
      chain = new Chain(runner, 'mock', new MockBackend(), settleMs, maxTx);
      chain.start();
      log(`mock mode, window ${settleMs} ms (fake signatures, no network)`);
      return;
    }
    // Devnet: the Solana libraries load only now, so mock mode never pays for them.
    void import('./settle').then(({ DevnetBackend }) => {
      chain = new Chain(runner, 'devnet', new DevnetBackend(), settleMs, maxTx);
      chain.start();
      // The world may already exist (npm run mock creates it at once): genesis for it now.
      const w = runner.getWorld();
      if (w && !runner.playback?.()) chain.adopt(w);
      log(`devnet mode, window ${settleMs} ms, max ${maxTx} transactions per window`);
    }).catch((e) => log(`devnet libraries failed to load, economy off: ${msg(e)}`));
  } catch (e) { log(`could not start: ${msg(e)}`); }
}
