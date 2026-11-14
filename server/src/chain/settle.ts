// Row A27: the devnet settler. Every window the module nets the queue and hands the groups here;
// each group becomes one transaction, a memo followed by a transfer, signed by the paying nation's
// own wallet (the Commons wallet pays the fee). Every 15 s a true-up keeps the chain's balances
// equal to the sim's treasuries, every 30 s the real balances are read back.
// Nothing here is awaited by the tick loop; the caller catches everything.
import {
  createClient, devnet, flattenTransactionPlanResult, nonDivisibleSequentialInstructionPlan,
  type Address, type InstructionPlan, type Instruction,
} from '@solana/kit';
import { solanaRpc } from '@solana/kit-plugin-rpc';
import { signer } from '@solana/kit-plugin-signer';
import { getTransferCheckedInstruction, token2022Program } from '@solana-program/token-2022';
import { getAddMemoInstruction } from '@solana-program/memo';
import type { World } from '@terra/shared';
import { runGenesis, type GenesisResult } from './genesis';
import {
  DECIMALS, SUPPLY, type ChainBackend, type ChainInfo, type Group, type GroupResult, type MaintainInput,
} from './types';
import { loadWallets, type Wallets } from './wallets';

const LAMPORTS_PER_SOL = 1_000_000_000;
const FEE_LAMPORTS_PER_TX = 10_000;    // an estimate: two signatures at 5,000
const MIN_COMMONS_SOL = 0.05;
const TRUE_UP_MS = 15_000;
const READ_MS = 30_000;
const TRUE_UP_GAP = 1;                 // coins
const MAX_TRUE_UPS = 3;                // per pass, so it never eats the payment budget

export function makeClient(wallets: Wallets) {
  const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || 'https://api.devnet.solana.com';
  const wsUrl = process.env.SOLANA_WS_URL?.trim() || 'wss://api.devnet.solana.com';
  // The signer goes in before the RPC plugin, or the RPC bundle has no payer.
  return createClient()
    .use(signer(wallets.commons))
    .use(solanaRpc({ rpcUrl: devnet(rpcUrl), rpcSubscriptionsUrl: devnet(wsUrl) }))
    .use(token2022Program());
}
export type ChainClient = ReturnType<typeof makeClient>;

const toUnits = (coins: number) => BigInt(Math.round(coins * 10 ** DECIMALS));
const round2 = (n: number) => Math.round(n * 100) / 100;

/** A memo under about 80 bytes, plain text. */
export function memoFor(g: { reason: string; note: string; year: number }): string {
  let s = `TN ${g.reason}: ${g.note} y${g.year}`.replace(/[^\x20-\x7e]/g, '?');
  if (s.length > 80) s = s.slice(0, 79) + '~';
  return s;
}

export class DevnetBackend implements ChainBackend {
  readonly mode = 'devnet' as const;
  private wallets: Wallets | null = null;
  private client: ChainClient | null = null;
  private gen: GenesisResult | null = null;
  private txs = 0;
  private lamports = 0;
  private bal = new Map<number, number>();
  private commonsBal = 0;
  private lastTrueUp = 0;
  private lastRead = 0;
  private maintaining = false;

  ready(): boolean { return this.gen !== null; }
  info(): ChainInfo | null { return this.gen?.info ?? null; }
  addressOf(id: number): string | null { return this.wallets?.walletOf(id)?.address ?? null; }
  balanceOf(id: number): number | null { return this.bal.get(id) ?? null; }
  commonsBalance(): number | null { return this.gen ? this.commonsBal : null; }
  stats() { return { transactions: this.txs, feesSol: this.lamports / LAMPORTS_PER_SOL }; }

  /** Sends a plan, waits for confirmation and returns how many transactions landed. Throws on any failure. */
  private async send(plan: InstructionPlan): Promise<number> {
    const result = await this.client!.sendTransactions(plan);
    const singles = flattenTransactionPlanResult(result);
    let n = 0;
    for (const r of singles) {
      if (r.status === 'failed') throw r.error;
      if (r.status !== 'successful') throw new Error('transaction was cancelled');
      n++;
    }
    this.txs += n;
    this.lamports += n * FEE_LAMPORTS_PER_TX;
    return n;
  }

  async genesis(world: World): Promise<void> {
    this.gen = null;
    this.wallets = await loadWallets();
    this.client = makeClient(this.wallets);
    const { value } = await this.client.rpc.getBalance(this.wallets.commons.address).send();
    if (Number(value) / LAMPORTS_PER_SOL < MIN_COMMONS_SOL) {
      throw new Error(`the Commons wallet ${this.wallets.commons.address} has too little devnet SOL; fund it at https://faucet.solana.com (a human does this)`);
    }
    this.bal.clear();
    this.txs = 0;
    this.lamports = 0;
    const res = await runGenesis(this.client, this.wallets, world, (p) => this.send(p));
    for (const [id, coins] of res.minted) this.bal.set(id, coins);
    this.commonsBal = res.commonsMinted;
    this.gen = res;
    this.lastTrueUp = this.lastRead = Date.now();
  }

  private tokenOfNation(id: number): Address | null {
    const w = this.wallets?.walletOf(id);
    return w ? this.gen?.tokenOf.get(w.address) ?? null : null;
  }

  /** The memo and the transfer, in the order the memo-transfer extension needs. */
  private transferIx(from: 'commons' | number, to: 'commons' | number, coins: number, memo: string): Instruction[] | null {
    const gen = this.gen!; const wallets = this.wallets!;
    const src = from === 'commons' ? wallets.commons : wallets.walletOf(from);
    const dst = to === 'commons' ? wallets.commons : wallets.walletOf(to);
    if (!src || !dst) return null;
    const source = gen.tokenOf.get(src.address); const destination = gen.tokenOf.get(dst.address);
    if (!source || !destination) return null;
    return [
      getAddMemoInstruction({ memo }),
      getTransferCheckedInstruction({
        source, mint: gen.mint.address, destination, authority: src, amount: toUnits(coins), decimals: DECIMALS,
      }),
    ];
  }

  async settle(groups: Group[]): Promise<GroupResult[]> {
    if (!this.gen) throw new Error('genesis not finished');
    const out: GroupResult[] = [];
    for (const g of groups) {
      const ixs = this.transferIx(g.from, g.to, g.amount, memoFor(g));
      if (!ixs) { out.push({ group: g, ok: true, status: 'confirmed', signature: undefined }); continue; } // no wallet: nothing to move
      try {
        // A payer whose on-chain balance lags the sim is topped up from the Commons first.
        const have = this.bal.get(g.from) ?? 0;
        if (have < g.amount) {
          const need = round2(g.amount - have + 1);
          const top = this.transferIx('commons', g.from, need, `TN advance for ${g.reason}`);
          if (top) { await this.send(nonDivisibleSequentialInstructionPlan(top)); this.bump('commons', -need); this.bump(g.from, need); }
        }
        const result = await this.client!.sendTransactions(nonDivisibleSequentialInstructionPlan(ixs));
        const single = flattenTransactionPlanResult(result)[0];
        if (!single || single.status !== 'successful') {
          const err = single && 'error' in single ? (single.error as Error) : new Error('transaction not confirmed');
          throw err;
        }
        this.txs++; this.lamports += FEE_LAMPORTS_PER_TX;
        this.bump(g.from, -g.amount); this.bump(g.to, g.amount);
        out.push({ group: g, ok: true, status: 'confirmed', signature: single.context.signature });
      } catch (e) {
        out.push({ group: g, ok: false, error: e instanceof Error ? e.message : String(e) });
        if (out.filter((r) => !r.ok).length >= 2) break; // the RPC is struggling: stop and let the breaker count it
      }
    }
    return out;
  }

  private bump(who: 'commons' | number, delta: number): void {
    if (who === 'commons') this.commonsBal = round2(this.commonsBal + delta);
    else this.bal.set(who, round2((this.bal.get(who) ?? 0) + delta));
  }

  async maintain(input: MaintainInput): Promise<void> {
    if (!this.gen || this.maintaining || input.busy()) return;
    const now = Date.now();
    this.maintaining = true;
    try {
      if (now - this.lastRead >= READ_MS) {
        this.lastRead = now;
        await this.readBalances(input.world);
      }
      if (now - this.lastTrueUp >= TRUE_UP_MS) {
        this.lastTrueUp = now;
        let done = 0;
        for (const [id, target] of input.targets) {
          if (done >= MAX_TRUE_UPS) break;
          if (!this.tokenOfNation(id)) continue;
          const gap = round2(target - (this.bal.get(id) ?? 0));
          if (Math.abs(gap) <= TRUE_UP_GAP) continue;
          // Income comes from the Commons; spending goes back to it.
          const ixs = gap > 0
            ? this.transferIx('commons', id, gap, 'TN sync: income')
            : this.transferIx(id, 'commons', -gap, 'TN sync: spending');
          if (!ixs) continue;
          await this.send(nonDivisibleSequentialInstructionPlan(ixs));
          this.bump('commons', -gap); this.bump(id, gap);
          done++;
        }
      }
    } finally { this.maintaining = false; }
  }

  private async readBalances(world: World): Promise<void> {
    const gen = this.gen!; const rpc = this.client!.rpc;
    const read = async (tokenAccount: Address): Promise<number> => {
      const { value } = await rpc.getTokenAccountBalance(tokenAccount).send();
      return Number(value.amount) / 10 ** DECIMALS;
    };
    this.commonsBal = await read(gen.tokenOf.get(this.wallets!.commons.address)!);
    for (const c of world.countries) {
      const t = this.tokenOfNation(c.id);
      if (t) this.bal.set(c.id, await read(t));
    }
    void SUPPLY;
  }
}
