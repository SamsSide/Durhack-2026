// Row A27: the pieces the chain module shares between its files.
import type { EconomyMode, LedgerEntry, PaymentReason, World } from '@terra/shared';

export const SYMBOL = 'TNC';
export const DECIMALS = 2;
export const SUPPLY = 1_000_000;           // coins, fixed at genesis (mint authority is revoked)
export const MAX_NATION_WALLETS = 12;      // nation-00.json .. nation-11.json

/** Payments with the same payer, payee and reason in one window are netted into one transfer. */
export interface Group {
  key: string; from: number; to: number; reason: PaymentReason; amount: number; note: string; year: number;
  rows: LedgerEntry[];
}
export interface GroupResult {
  group: Group;
  ok: boolean;
  status?: 'sent' | 'confirmed' | 'simulated';
  signature?: string;
  /** Permanent failure (do not retry): the transaction was rejected, not just unreachable. */
  fatal?: boolean;
  error?: string;
}

export interface ChainInfo {
  name: string; symbol: string; mint: string; supply: number; mintAuthority: string | null; commons: string;
}

export interface MaintainInput {
  world: World;
  /** Per nation: sim treasury the chain should show once the queue has settled. */
  targets: Map<number, number>;
  busy: () => boolean;
}

/** What the mock and the devnet settlers both offer. All methods may throw; the caller catches. */
export interface ChainBackend {
  readonly mode: Exclude<EconomyMode, 'off'>;
  genesis(world: World): Promise<void>;
  ready(): boolean;
  info(): ChainInfo | null;
  /** The wallet address that owns the nation's token account, or null when it has no wallet. */
  addressOf(countryId: number): string | null;
  /** The balance the chain holds for a nation (null: use the sim's numbers, the mock). */
  balanceOf(countryId: number): number | null;
  commonsBalance(): number | null;
  settle(groups: Group[]): Promise<GroupResult[]>;
  maintain?(input: MaintainInput): Promise<void>;
  stats(): { transactions: number; feesSol: number };
}

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const explorerAddress = (a: string) => `https://explorer.solana.com/address/${a}?cluster=devnet`;
export const currencyName = (w: { name: string }) => `${w.name.replace(/^The\s+/i, '').trim() || 'Terra Nova'} Crown`;
