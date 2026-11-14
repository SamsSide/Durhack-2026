// Row A27: mirror every nation payment to Solana. The simulation stays the source of truth; this
// module only listens. A `payment` event becomes a ledger row, rows settle on a wall-clock window
// (netted, memo plus transfer, signed by the payer nation's own wallet), and the chain never makes
// the tick loop wait: all network work is async, caught, and behind a circuit breaker.
// SOLANA_MODE: off (nothing), mock (default: fake signatures, no network) or devnet.
import fs from 'node:fs';
import path from 'node:path';
import type { EconomyMessage, EconomyMode, EconomyState, LedgerEntry, WorldEvent, World } from '@terra/shared';
import { REPLAYS_DIR } from '../engine/replays';
import type { WorldRunner } from '../runner';
import { MockBackend } from './mock';
import {
  explorerAddress, explorerTx, SUPPLY, SYMBOL, currencyName,
  type ChainBackend, type Group, type GroupResult,
} from './types';
import { fakeAddress } from './wallets';

export type ChainMessage = EconomyMessage | { type: 'ledger'; entries: LedgerEntry[] };

const RECENT = 50;
const MAX_ROWS = 5000;
const MAX_ATTEMPTS = 3;
const BREAKER_AFTER = 5;
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
  private maintFailures = 0;
  private breakerUntil = 0;
  private settling = false;
  private genesisRunning = false;
  private genesisTimer: ReturnType<typeof setTimeout> | null = null;
  private playback = false;
  private saved: Sidecar | null = null;
  private lastSave = 0;
  private savedCount = -1;

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
  private pending(): number { let n = 0; for (const r of this.rows.values()) if (r.status === 'queued') n++; return n; }
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
    setInterval(() => { void this.tickSettle(); }, this.settleMs).unref();
    setInterval(() => { try { this.flushEconomy(); void this.tickMaintain(); this.maybeSave(); } catch { /* never */ } }, 1000).unref();
  }

  /** A world that already exists when the module starts (devnet loads its libraries lazily). */
  adopt(w: World): void { try { this.onSnapshot(w); } catch (e) { log(`adopt failed: ${msg(e)}`); } }

  private onSnapshot(w: World): void {
    const same = this.world?.id === w.id;
    this.playback = !!this.runner.playback?.();
    this.world = { id: w.id, name: w.name };
    this.year = w.year;
    if (same && !this.playback) return;
    this.rows.clear(); this.attempts.clear(); this.changed.clear();
    this.payments = 0; this.volume = 0; this.savedCount = -1;
    this.saved = this.playback ? this.loadSidecar(w.id) : null;
    if (this.genesisTimer) { clearTimeout(this.genesisTimer); this.genesisTimer = null; }
    this.lastEcon = '';
    if (!this.playback) void this.runGenesis(w);
  }

  private loadSidecar(id: string): Sidecar | null {
    if (!ID_RE.test(id)) return null;
    try {
      const s = JSON.parse(fs.readFileSync(path.join(REPLAYS_DIR, `${id}.ledger.json`), 'utf8')) as Sidecar;
      return Array.isArray(s.rows) ? s : null;
    } catch { return null; }
  }

  private async runGenesis(w: World): Promise<void> {
    if (this.genesisRunning) return;
    this.genesisRunning = true;
    try {
      await this.backend.genesis(w);
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
      else if (ev.type === 'payment') this.onPayment(ev, this.runner.getWorld()?.tick ?? ev.tick);
    }
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
    }
    this.rows.set(id, row);
    if (this.rows.size > MAX_ROWS) {
      for (const k of this.rows.keys()) { if (this.rows.get(k)!.status !== 'queued') { this.rows.delete(k); this.attempts.delete(k); break; } }
    }
    this.touch(row);
  }

  // --- settlement --------------------------------------------------------------------------

  private groups(): Group[] {
    const by = new Map<string, Group>();
    for (const r of this.rows.values()) {
      if (r.status !== 'queued') continue;
      const key = `${r.from}|${r.to}|${r.reason}`;
      const g = by.get(key);
      if (g) { g.amount = round2(g.amount + r.amount); g.rows.push(r); g.note = `${g.rows[0]!.note} +${g.rows.length - 1}`; }
      else by.set(key, { key, from: r.from, to: r.to, reason: r.reason, amount: r.amount, note: r.note, year: r.year, rows: [r] });
    }
    return [...by.values()];
  }

  private async tickSettle(): Promise<void> {
    if (this.settling || this.playback || !this.backend.ready()) return;
    if (Date.now() < this.breakerUntil) return;
    const groups = this.groups().slice(0, this.maxTx);
    if (!groups.length) return;
    this.settling = true;
    try {
      let results: GroupResult[];
      try { results = await this.backend.settle(groups); }
      catch (e) { results = groups.map((g) => ({ group: g, ok: false, error: msg(e) })); }
      for (const r of results) this.apply(r);
      const bad = results.filter((r) => !r.ok);
      if (bad.length && !results.some((r) => r.ok)) {
        this.failures += 1;
        log(`settlement failed (${this.failures} in a row): ${bad[0]!.error ?? 'unknown'}`);
        if (this.failures >= BREAKER_AFTER) {
          this.breakerUntil = Date.now() + BREAKER_MS; this.online = false; this.failures = 0;
          log(`ledger offline, pausing ${BREAKER_MS / 1000} s with ${this.pending()} payments waiting`);
        }
      } else if (results.some((r) => r.ok)) { this.failures = 0; this.online = true; }
    } catch (e) { log(`settlement crashed: ${msg(e)}`); }
    finally { this.settling = false; this.flushEconomy(); }
  }

  private apply(res: GroupResult): void {
    for (const row of res.group.rows) {
      const live = this.rows.get(row.id);
      if (!live) continue;
      if (res.ok) {
        live.status = res.status ?? 'confirmed';
        if (res.signature) { live.signature = res.signature; live.url = this.mode === 'devnet' ? explorerTx(res.signature) : null; }
        else live.url = null;
        this.payments++; this.volume += live.amount;
      } else {
        const n = (this.attempts.get(row.id) ?? 0) + 1;
        this.attempts.set(row.id, n);
        if (res.fatal || n >= MAX_ATTEMPTS) live.status = 'failed';
      }
      this.touch(live);
    }
  }

  private async tickMaintain(): Promise<void> {
    if (!this.backend.maintain || this.playback || !this.backend.ready() || Date.now() < this.breakerUntil) return;
    const w = this.runner.getWorld();
    if (!w) return;
    try {
      await this.backend.maintain({ world: w, targets: this.targets(w), busy: () => this.settling, maxTx: this.maxTx });
      this.maintFailures = 0;
    } catch (e) {
      log(`maintenance failed: ${msg(e)}`);
      if (++this.maintFailures >= BREAKER_AFTER) {
        this.maintFailures = 0; this.breakerUntil = Date.now() + BREAKER_MS; this.online = false;
        log(`true-up offline, pausing ${BREAKER_MS / 1000} s`);
      }
    }
  }

  /** What each nation's on-chain balance should be once the queue settles: the sim's treasury, plus
   *  what it has already paid out (still queued) and minus what it has already been paid. */
  private targets(w: World): Map<number, number> {
    const t = new Map<number, number>();
    for (const c of w.countries) if (c.alive) t.set(c.id, c.treasury);
    for (const r of this.rows.values()) {
      if (r.status !== 'queued') continue;
      if (t.has(r.from)) t.set(r.from, t.get(r.from)! + r.amount);
      if (t.has(r.to)) t.set(r.to, t.get(r.to)! - r.amount);
    }
    return t;
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
      const file: Sidecar = {
        worldId: this.world.id, mode: this.mode, info: this.backend.info(), addresses, totals: this.totals(), rows: [...this.rows.values()],
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
    const pendingOut = new Map<number, number>(); const pendingIn = new Map<number, number>();
    for (const r of this.rows.values()) {
      if (r.status !== 'queued') continue;
      pendingOut.set(r.from, (pendingOut.get(r.from) ?? 0) + r.amount);
      pendingIn.set(r.to, (pendingIn.get(r.to) ?? 0) + r.amount);
    }
    let sumNations = 0;
    const nations = (w?.countries ?? []).flatMap((c) => {
      const a = addr(c.id);
      if (!a) return [];
      const real = this.playback ? null : this.backend.balanceOf(c.id);
      const onChain = round2(real ?? c.treasury + (pendingOut.get(c.id) ?? 0) - (pendingIn.get(c.id) ?? 0));
      sumNations += onChain;
      const sim = round2(c.treasury);
      // On-chain plus payments still queued, against the sim treasury: the chain trails by whatever the sim earned since.
      const drift = round2(onChain - sim - (pendingOut.get(c.id) ?? 0) + (pendingIn.get(c.id) ?? 0));
      return [{ countryId: c.id, address: a, url: link(a), onChain, sim, drift, inSync: Math.abs(drift) <= Math.max(1, Math.abs(sim) * 0.02) }];
    });
    const realCommons = this.playback ? null : this.backend.commonsBalance();
    const t = this.totals();
    return {
      mode: this.mode, cluster: this.mode === 'devnet' ? 'devnet' : 'mock',
      currency: { name: info.name, symbol: info.symbol, mint: info.mint, url: link(info.mint), supply: info.supply, mintAuthority: info.mintAuthority },
      commons: { address: info.commons, url: link(info.commons), balance: round2(realCommons ?? Math.max(0, info.supply - sumNations)) },
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
    const maxTx = Math.floor(num(process.env.SOLANA_MAX_TX_PER_WINDOW, 6, 1));
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
