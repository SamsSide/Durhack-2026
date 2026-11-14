// Row A27: the pieces the chain module shares between its files.
import type { EconomyMode, LedgerEntry, PaymentReason, World } from '@terra/shared';

export const SYMBOL = 'TNC';
export const DECIMALS = 2;
export const SUPPLY = 1_000_000;           // coins, fixed at genesis (mint authority is revoked)
export const MAX_NATION_WALLETS = 12;      // nation-00.json .. nation-11.json
/** What genesis gives each nation from the Commons, so payments rarely run short (SOLANA_FLOAT). */
export const DEFAULT_FLOAT = 10_000;

/** Payments from one payer to one payee in one window are netted into one transfer. */
export interface Group {
  id: string;
  from: number; to: number;
  /** The first row's reason; `reasons` lists every distinct one. */
  reason: PaymentReason; reasons: PaymentReason[];
  amount: number; note: string; year: number;
  /** Coins the Commons advances the payer first, in the same transaction (0: none). */
  advance: number;
  /** Display names for the memo, without a leading "The" (filled in by the module). */
  fromName?: string; toName?: string;
  rows: LedgerEntry[];
}
export interface GroupResult {
  group: Group;
  /** False when the send itself failed (rate limit, network); counts towards backoff and the breaker. */
  ok: boolean;
  /** `sent`: signed and handed to the RPC, waiting for confirmation by polling. `confirmed` with no
   *  signature: nothing moved (a nation without a wallet). `simulated`: the mock. */
  status?: 'sent' | 'confirmed' | 'simulated';
  signature?: string;
  error?: string;
}
/** What polling learned about a group that was sent. */
export interface Outcome {
  groupId: string;
  /** `confirmed`: landed. `failed`: landed with an error (nothing moved). `requeue`: provably never
   *  landed and can no longer land (its blockhash expired), so its rows may be sent again. */
  status: 'confirmed' | 'failed' | 'requeue';
  error?: string;
}

export interface ChainInfo {
  name: string; symbol: string; mint: string; supply: number; mintAuthority: string | null; commons: string;
}

/** What the mock and the devnet settlers both offer. All methods may throw; the caller catches. */
export interface ChainBackend {
  readonly mode: Exclude<EconomyMode, 'off'>;
  genesis(world: World): Promise<void>;
  ready(): boolean;
  info(): ChainInfo | null;
  /** The wallet address that owns the nation's token account, or null when it has no wallet. */
  addressOf(countryId: number): string | null;
  /** What genesis put in each nation's account and in the Commons (the ledger starts here). */
  floats(): { nations: Map<number, number>; commons: number };
  /** True when a payment from or to this nation can actually move on chain. */
  canMove(countryId: number): boolean;
  /** Opens the token account of a nation founded after genesis (the Commons pays the rent) and
   *  resolves true once it is confirmed, false when the nation has no wallet or it failed. */
  openAccount?(countryId: number, name: string): Promise<boolean>;
  /** True when this nation has a wallet but no token account yet, so payments to or from it wait. */
  needsAccount?(countryId: number): boolean;
  /** The balance last read from the chain (null: none, use the ledger; the mock). */
  balanceOf(countryId: number): number | null;
  commonsBalance(): number | null;
  /** Sends what it can of the groups; never waits for confirmation. */
  settle(groups: Group[], maxTx: number): Promise<GroupResult[]>;
  /** Checks sent groups (devnet: one batched getSignatureStatuses). */
  poll?(): Promise<Outcome[]>;
  /** Periodic upkeep (devnet: the balance read every 30 s). */
  maintain?(world: World): Promise<void>;
  /** True while the RPC asked us to back off (429, network): skip this window, it is not a failure. */
  backingOff?(): boolean;
  stats(): { transactions: number; feesSol: number };
}

/** A nation's name as the memo shows it. */
export const plainName = (n: string) => n.replace(/^The\s+/i, '').trim() || n;

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const explorerAddress = (a: string) => `https://explorer.solana.com/address/${a}?cluster=devnet`;
export const currencyName = (w: { name: string }) => `${w.name.replace(/^The\s+/i, '').trim() || 'Terra Nova'} Crown`;

export const floatSize = () => {
  const n = Number(process.env.SOLANA_FLOAT);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : DEFAULT_FLOAT;
};
