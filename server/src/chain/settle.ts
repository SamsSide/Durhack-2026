// Row A27: the devnet settler. The chain is an exact ledger of money moving between nations;
// income and spending stay in the sim, so the only transactions ever sent are genesis and payments.
// Every window the module nets the queue per (payer, payee) and hands the groups here; each group
// becomes one version 1 transaction (an optional Commons advance, then a memo and a transfer signed
// by the paying nation's own wallet; the Commons pays the fee).
//
// Built to survive the public devnet RPC (100 requests per 10 s per IP, 40 per method):
// - a fixed compute-unit limit and no priority fee, so nothing is simulated before sending;
// - sends go out one at a time; confirmation is HTTP polling (one batched getSignatureStatuses
//   every 2 s while anything is in flight), never WebSocket subscriptions;
// - a 429 or a network error backs off exponentially (Retry-After honoured) and nothing is lost:
//   a signed transaction keeps its signature until it is confirmed, fails on chain, or provably can
//   no longer land (its blockhash expired and the signature is unknown), so nothing is paid twice;
// - balances are read every 30 s with one getMultipleAccounts call.
// Nothing here is awaited by the tick loop; the caller catches everything.
import {
  appendTransactionMessageInstructions, createClient, generateKeyPairSigner, sequentialInstructionPlan, createTransactionMessage, devnet, flattenTransactionPlan,
  flattenTransactionPlanResult, getBase64EncodedWireTransaction, getSignatureFromTransaction, isSolanaError, pipe,
  setTransactionMessageComputeUnitLimit, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash,
  setTransactionMessageLoadedAccountsDataSizeLimit, signTransactionMessageWithSigners, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR,
  type Address, type Base64EncodedWireTransaction, type Blockhash, type Instruction, type InstructionPlan, type Signature,
} from '@solana/kit';
import { solanaRpc } from '@solana/kit-plugin-rpc';
import { signer } from '@solana/kit-plugin-signer';
import { extension, getCreateTokenInstructionPlan, getTransferCheckedInstruction, token2022Program } from '@solana-program/token-2022';
import { getAddMemoInstruction } from '@solana-program/memo';
import type { World } from '@terra/shared';
import { runGenesis, type GenesisResult } from './genesis';
import {
  DECIMALS, type ChainBackend, type ChainInfo, type Group, type GroupResult, type Outcome,
} from './types';
import { loadWallets, type Wallets } from './wallets';

const LAMPORTS_PER_SOL = 1_000_000_000;
const FEE_LAMPORTS_PER_TX = 10_000;     // two signatures at 5,000; no priority fee
const MIN_COMMONS_SOL = 0.05;
const CU_PER_TRANSFER = 40_000;         // one memo plus one TransferChecked, with room to spare
const LOADED_BYTES = 16 * 1024 * 1024;  // v1 budgets zero bytes when unset; Token-2022 alone is far below this
const MEMO_MAX = 190;                   // bytes, plain ASCII
const BLOCKHASH_REUSE_MS = 20_000;      // a blockhash lives about 60 to 90 s; reuse it only well inside that
const REDELIVER_MS = 40_000;            // past this, an undelivered transaction waits for its expiry check
const MAX_DELIVERIES = 3;
const EXPIRY_CHECK_AFTER_MS = 60_000;
const EXPIRY_CHECK_EVERY_MS = 10_000;
const READ_MS = 30_000;
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS = 60_000;
const RECENT_MOVES = 500;

const log = (s: string) => console.log(`chain: ${s}`);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);
const round2 = (n: number) => Math.round(n * 100) / 100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const toUnits = (coins: number) => BigInt(Math.round(coins * 10 ** DECIMALS));
const safeJson = (v: unknown) => { try { return JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? String(x) : x)); } catch { return String(v); } };

export function makeClient(wallets: Wallets) {
  const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || 'https://api.devnet.solana.com';
  // SOLANA_WS_URL is still accepted in .env but unused: confirmation is HTTP polling, so no socket is
  // ever opened. The signer goes in before the RPC plugin, or the RPC bundle has no payer.
  return createClient()
    .use(signer(wallets.commons))
    .use(solanaRpc({ rpcUrl: devnet(rpcUrl) }))
    .use(token2022Program());
}
export type ChainClient = ReturnType<typeof makeClient>;

/** Rate limits, 5xx and network trouble are transient: back off and try again. Returns the wait, or null. */
function transientWait(e: unknown, attempt: number): number | null {
  let retryAfter = 0;
  if (isSolanaError(e, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR)) {
    const { statusCode, headers } = e.context;
    if (statusCode !== 429 && statusCode !== 408 && statusCode < 500) return null;
    const raw = headers?.get?.('retry-after');
    if (raw) {
      const secs = Number(raw);
      retryAfter = Number.isFinite(secs) ? secs * 1000 : Math.max(0, Date.parse(raw) - Date.now());
    }
  } else if (!(e instanceof TypeError) && !/fetch failed|network|socket|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|timed? ?out/i.test(msg(e))) {
    return null;
  }
  return Math.min(BACKOFF_MAX_MS, Math.max(retryAfter, BACKOFF_BASE_MS * 2 ** Math.min(attempt, 5)));
}

/** The memo for a netted group (`TN <id> y<year> <payer> pays <payee> <amount> TNC, <reason>: <note>`): its first row id (so two identical payments never share a
 *  signature), the year, any advance, then every distinct reason and note. Under 200 bytes. */
export function memoFor(g: Pick<Group, 'rows' | 'year' | 'advance' | 'fromName' | 'toName' | 'amount'>): string {
  const parts: string[] = [];
  for (const r of g.rows) { const p = `${r.reason}: ${r.note}`; if (!parts.includes(p)) parts.push(p); }
  const head = `TN ${g.rows[0]?.id ?? '?'}${g.rows.length > 1 ? ` x${g.rows.length}` : ''} y${g.year}`;
  const adv = g.advance > 0 ? ` adv ${g.advance}` : '';
  const who = g.fromName && g.toName ? ` ${g.fromName} pays ${g.toName} ${g.amount} TNC,` : '';
  let s = `${head}${adv}${who} ${parts.join('; ')}`.replace(/[^\x20-\x7e]/g, '?');
  if (s.length > MEMO_MAX) s = s.slice(0, MEMO_MAX - 1) + '~';
  return s;
}
const advanceMemo = (g: Group) => `TN ${g.rows[0]?.id ?? '?'} advance ${g.advance} from the Commons to cover a ${g.reason} payment`.slice(0, MEMO_MAX);

interface Flight {
  group: Group;
  signature: Signature;
  wire: Base64EncodedWireTransaction;
  lastValidBlockHeight: bigint;
  signedAt: number;
  delivered: boolean;
  deliveries: number;
}
type Who = 'commons' | number;

export class DevnetBackend implements ChainBackend {
  readonly mode = 'devnet' as const;
  private wallets: Wallets | null = null;
  private client: ChainClient | null = null;
  private gen: GenesisResult | null = null;
  private txs = 0;
  private lamports = 0;
  private bal = new Map<number, number>();
  private commonsBal = 0;
  private readSlot = 0n;
  private moves: { slot: bigint; moves: [Who, number][] }[] = [];
  private lastRead = 0;
  private reading = false;
  private flights = new Map<string, Flight>();
  private bh: { blockhash: Blockhash; lastValidBlockHeight: bigint; at: number } | null = null;
  private backoffUntil = 0;
  private backoffN = 0;
  private lastExpiryCheck = 0;

  ready(): boolean { return this.gen !== null; }
  info(): ChainInfo | null { return this.gen?.info ?? null; }
  addressOf(id: number): string | null { return this.wallets?.walletOf(id)?.address ?? null; }
  floats() { return { nations: new Map(this.gen?.minted ?? []), commons: this.gen?.commonsMinted ?? 0 }; }
  canMove(id: number): boolean { return this.tokenOf(id) !== null; }
  needsAccount(id: number): boolean { return !!this.wallets?.walletOf(id) && this.tokenOf(id) === null; }
  balanceOf(id: number): number | null { return this.bal.get(id) ?? null; }
  commonsBalance(): number | null { return this.gen ? this.commonsBal : null; }
  stats() { return { transactions: this.txs, feesSol: this.lamports / LAMPORTS_PER_SOL }; }
  backingOff(): boolean { return Date.now() < this.backoffUntil; }

  // --- RPC with backoff ----------------------------------------------------------------------

  /** One RPC call. Refuses while backing off; a transient failure sets the next backoff. */
  private async call<T>(what: string, fn: () => Promise<T>): Promise<T> {
    if (this.backingOff()) throw new Error(`backing off (${Math.ceil((this.backoffUntil - Date.now()) / 1000)} s)`);
    try {
      const v = await fn();
      this.backoffN = 0;
      return v;
    } catch (e) {
      const wait = transientWait(e, this.backoffN);
      if (wait !== null) {
        this.backoffN++;
        this.backoffUntil = Date.now() + wait;
        log(`${what}: ${msg(e).split('\n')[0]}; backing off ${Math.round(wait / 1000)} s`);
      }
      throw e;
    }
  }

  // --- genesis -------------------------------------------------------------------------------

  /** Plans a genesis step, then signs, sends and confirms each transaction in order (by polling). */
  private async sendPlan(plan: InstructionPlan): Promise<number> {
    const client = this.client!;
    const singles = flattenTransactionPlan(await client.planTransactions(plan));
    for (const single of singles) {
      // Signed one at a time, so each estimate sees the accounts the previous transaction created.
      const signed = await client.signTransaction(single.message);
      const sig = signed.context.signature;
      if (!sig) throw new Error('genesis transaction was not signed');
      await this.sendAndWait(signed.context.transactionBase64, sig);
      this.txs++;
      this.lamports += FEE_LAMPORTS_PER_TX;
    }
    return singles.length;
  }

  private async sendAndWait(wire: Base64EncodedWireTransaction, sig: Signature): Promise<void> {
    const rpc = this.client!.rpc;
    const deadline = Date.now() + 90_000;
    let sent = false; let attempt = 0;
    while (Date.now() < deadline) {
      try {
        if (!sent) { await rpc.sendTransaction(wire, { encoding: 'base64', skipPreflight: true }).send(); sent = true; }
        await sleep(2000);
        const { value } = await rpc.getSignatureStatuses([sig]).send();
        const st = value[0];
        if (st?.err) throw Object.assign(new Error(`genesis transaction ${sig} failed: ${safeJson(st.err)}`), { final: true });
        if (st && st.confirmationStatus !== 'processed') return;
        attempt = 0;
      } catch (e) {
        if ((e as { final?: boolean }).final) throw e;
        const wait = transientWait(e, attempt++);
        if (wait === null) throw e;
        await sleep(wait);
      }
    }
    throw new Error(`genesis transaction ${sig} not confirmed in 90 s`);
  }

  async genesis(world: World): Promise<void> {
    this.gen = null;
    this.flights.clear(); this.moves = []; this.bh = null;
    this.wallets = await loadWallets();
    this.client = makeClient(this.wallets);
    const { value } = await this.client.rpc.getBalance(this.wallets.commons.address).send();
    if (Number(value) / LAMPORTS_PER_SOL < MIN_COMMONS_SOL) {
      throw new Error(`the Commons wallet ${this.wallets.commons.address} has too little devnet SOL; fund it at https://faucet.solana.com (a human does this)`);
    }
    this.bal.clear();
    this.txs = 0;
    this.lamports = 0;
    const res = await runGenesis(this.client, this.wallets, world, (p) => this.sendPlan(p));
    for (const [id, coins] of res.minted) this.bal.set(id, coins);
    this.commonsBal = res.commonsMinted;
    this.readSlot = 0n;
    this.gen = res;
    this.lastRead = Date.now();
  }

  /** A nation founded after genesis: a Token-2022 account for its wallet, the Commons paying fee and
   *  rent, in its own transaction with the memo `TN open <name>`, confirmed by polling. */
  async openAccount(id: number, name: string): Promise<boolean> {
    const wallet = this.wallets?.walletOf(id);
    if (!wallet || !this.gen || !this.client) return false;
    if (this.tokenOf(id)) return true;
    const token = await generateKeyPairSigner();
    const label = `TN open ${name}`.replace(/[^\x20-\x7e]/g, '?').slice(0, MEMO_MAX);
    await this.sendPlan(sequentialInstructionPlan([
      getAddMemoInstruction({ memo: label }),
      await getCreateTokenInstructionPlan(this.client, {
        payer: this.wallets!.commons, newToken: token, mint: this.gen.mint.address, owner: wallet,
        extensions: [extension('MemoTransfer', { requireIncomingTransferMemos: true })],
      }),
    ]));
    this.gen.tokenOf.set(wallet.address, token.address);
    if (!this.bal.has(id)) this.bal.set(id, 0);
    return true;
  }

  // --- payments ------------------------------------------------------------------------------

  private tokenOf(who: Who): Address | null {
    const w = who === 'commons' ? this.wallets?.commons : this.wallets?.walletOf(who);
    return w ? this.gen?.tokenOf.get(w.address) ?? null : null;
  }

  /** The memo and the transfer, in the order the memo-transfer extension needs. */
  private transferIx(from: Who, to: Who, coins: number, memo: string): Instruction[] | null {
    const gen = this.gen!; const wallets = this.wallets!;
    const src = from === 'commons' ? wallets.commons : wallets.walletOf(from);
    const source = this.tokenOf(from); const destination = this.tokenOf(to);
    if (!src || !source || !destination) return null;
    return [
      getAddMemoInstruction({ memo }),
      getTransferCheckedInstruction({
        source, mint: gen.mint.address, destination, authority: src, amount: toUnits(coins), decimals: DECIMALS,
      }),
    ];
  }

  private async blockhash() {
    if (this.bh && Date.now() - this.bh.at < BLOCKHASH_REUSE_MS) return this.bh;
    const { value } = await this.call('blockhash', () => this.client!.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send());
    this.bh = { blockhash: value.blockhash, lastValidBlockHeight: value.lastValidBlockHeight, at: Date.now() };
    return this.bh;
  }

  private async sign(g: Group): Promise<Flight> {
    const ixs: Instruction[] = [];
    if (g.advance > 0) {
      const adv = this.transferIx('commons', g.from, g.advance, advanceMemo(g));
      if (!adv) throw new Error('no Commons token account');
      ixs.push(...adv);
    }
    const pay = this.transferIx(g.from, g.to, g.amount, memoFor(g));
    if (!pay) throw new Error('no token account');
    ixs.push(...pay);
    const bh = await this.blockhash();
    const message = pipe(
      createTransactionMessage({ version: 1 }),
      (m) => setTransactionMessageFeePayerSigner(this.wallets!.commons, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, m),
      (m) => setTransactionMessageComputeUnitLimit(CU_PER_TRANSFER * (g.advance > 0 ? 2 : 1), m),
      (m) => setTransactionMessageLoadedAccountsDataSizeLimit(LOADED_BYTES, m),
      (m) => appendTransactionMessageInstructions(ixs, m),
    );
    const tx = await signTransactionMessageWithSigners(message);
    return {
      group: g, signature: getSignatureFromTransaction(tx), wire: getBase64EncodedWireTransaction(tx),
      lastValidBlockHeight: bh.lastValidBlockHeight, signedAt: Date.now(), delivered: false, deliveries: 0,
    };
  }

  private async deliver(f: Flight): Promise<void> {
    f.deliveries++;
    await this.call('send', () => this.client!.rpc.sendTransaction(f.wire, { encoding: 'base64', skipPreflight: true }).send());
    f.delivered = true;
  }

  async settle(groups: Group[], maxTx: number): Promise<GroupResult[]> {
    if (!this.gen) throw new Error('genesis not finished');
    const out: GroupResult[] = [];
    let budget = maxTx;
    // 1. Signed transactions whose send failed go again first, unchanged (same signature, same
    //    blockhash, while it is still young), so a payment that did reach the network is never doubled.
    for (const f of this.flights.values()) {
      if (budget <= 0 || this.backingOff()) return out;
      if (f.delivered || f.deliveries >= MAX_DELIVERIES || Date.now() - f.signedAt > REDELIVER_MS) continue;
      budget--;
      try { await this.deliver(f); out.push({ group: f.group, ok: true, status: 'sent', signature: f.signature }); }
      catch (e) { out.push({ group: f.group, ok: false, status: 'sent', signature: f.signature, error: msg(e) }); return out; }
    }
    // 2. New groups, one send at a time.
    for (const g of groups) {
      if (budget <= 0 || this.backingOff()) break;
      if (!this.canMove(g.from) || !this.canMove(g.to)) { out.push({ group: g, ok: true, status: 'confirmed' }); continue; } // no wallet: nothing moves
      let f: Flight;
      try { f = await this.sign(g); }
      catch (e) { out.push({ group: g, ok: false, error: msg(e) }); break; } // not signed: its rows stay queued
      this.flights.set(f.signature, f);
      budget--;
      try { await this.deliver(f); out.push({ group: g, ok: true, status: 'sent', signature: f.signature }); }
      catch (e) { out.push({ group: g, ok: false, status: 'sent', signature: f.signature, error: msg(e) }); break; }
    }
    return out;
  }

  private movesOf(g: Group): [Who, number][] {
    const m: [Who, number][] = [];
    if (g.advance > 0) m.push(['commons', -g.advance], [g.from, g.advance]);
    m.push([g.from, -g.amount], [g.to, g.amount]);
    return m;
  }
  private bump(who: Who, delta: number): void {
    if (who === 'commons') this.commonsBal = round2(this.commonsBal + delta);
    else this.bal.set(who, round2((this.bal.get(who) ?? 0) + delta));
  }
  /** A landed transfer moves the balances we hold, unless the last read already saw it. */
  private landed(f: Flight, slot: bigint): void {
    this.txs++; this.lamports += FEE_LAMPORTS_PER_TX;
    const moves = this.movesOf(f.group);
    this.moves.push({ slot, moves });
    if (this.moves.length > RECENT_MOVES) this.moves.shift();
    if (slot > this.readSlot) for (const [who, d] of moves) this.bump(who, d);
  }

  async poll(): Promise<Outcome[]> {
    if (!this.gen || !this.flights.size || this.backingOff()) return [];
    const rpc = this.client!.rpc;
    const list = [...this.flights.values()].slice(0, 256);
    const { value } = await this.call('status', () => rpc.getSignatureStatuses(list.map((f) => f.signature)).send());
    const out: Outcome[] = [];
    const waiting: Flight[] = [];
    list.forEach((f, i) => {
      const st = value[i];
      if (st?.err) {
        this.flights.delete(f.signature); this.txs++; this.lamports += FEE_LAMPORTS_PER_TX;
        out.push({ groupId: f.group.id, status: 'failed', error: safeJson(st.err).slice(0, 200) });
      } else if (st && st.confirmationStatus !== 'processed') {
        this.flights.delete(f.signature); this.landed(f, st.slot);
        out.push({ groupId: f.group.id, status: 'confirmed' });
      } else if (!st && Date.now() - f.signedAt > EXPIRY_CHECK_AFTER_MS) waiting.push(f);
    });
    // Old and still unknown: if its blockhash has expired it can never land, so check the full
    // history once more and only then let its rows be sent again.
    if (waiting.length && Date.now() - this.lastExpiryCheck >= EXPIRY_CHECK_EVERY_MS) {
      this.lastExpiryCheck = Date.now();
      const height = await this.call('height', () => rpc.getBlockHeight({ commitment: 'confirmed' }).send());
      const expired = waiting.filter((f) => f.lastValidBlockHeight < height);
      if (expired.length) {
        const { value: hist } = await this.call('history', () =>
          rpc.getSignatureStatuses(expired.map((f) => f.signature), { searchTransactionHistory: true }).send());
        expired.forEach((f, i) => {
          const st = hist[i];
          if (!st) { this.flights.delete(f.signature); out.push({ groupId: f.group.id, status: 'requeue' }); }
          else if (st.err) {
            this.flights.delete(f.signature); this.txs++; this.lamports += FEE_LAMPORTS_PER_TX;
            out.push({ groupId: f.group.id, status: 'failed', error: safeJson(st.err).slice(0, 200) });
          } else if (st.confirmationStatus !== 'processed') {
            this.flights.delete(f.signature); this.landed(f, st.slot);
            out.push({ groupId: f.group.id, status: 'confirmed' });
          }
        });
      }
    }
    return out;
  }

  // --- balances ------------------------------------------------------------------------------

  async maintain(world: World): Promise<void> {
    if (!this.gen || this.reading || this.backingOff() || Date.now() - this.lastRead < READ_MS) return;
    this.lastRead = Date.now();
    this.reading = true;
    try { await this.readBalances(world); } finally { this.reading = false; }
  }

  /** Every token account in one getMultipleAccounts call; transfers that landed after the read's
   *  slot are added back on top, so a read never undoes a confirmation it did not see. */
  private async readBalances(world: World): Promise<void> {
    const owners: Who[] = ['commons'];
    for (const c of world.countries) if (this.tokenOf(c.id)) owners.push(c.id);
    const addrs = owners.map((o) => this.tokenOf(o)!);
    const { context, value } = await this.call('read', () =>
      this.client!.rpc.getMultipleAccounts(addrs, { encoding: 'base64', commitment: 'confirmed' }).send());
    owners.forEach((o, i) => {
      const acc = value[i];
      if (!acc) return;
      const bytes = Buffer.from(acc.data[0], 'base64');
      if (bytes.length < 72) return;
      const coins = Number(bytes.readBigUInt64LE(64)) / 10 ** DECIMALS; // mint 32, owner 32, then the amount
      if (o === 'commons') this.commonsBal = coins; else this.bal.set(o, coins);
    });
    this.readSlot = context.slot;
    this.moves = this.moves.filter((m) => m.slot > context.slot);
    for (const m of this.moves) for (const [who, d] of m.moves) this.bump(who, d);
  }
}
