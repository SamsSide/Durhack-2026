// Row A27: the mock chain. No network, no keys: addresses and signatures only look real. Genesis
// gives every living nation the same float as devnet would, so the ledger reads the same way.
import type { World } from '@terra/shared';
import {
  currencyName, floatSize, SUPPLY, SYMBOL, type ChainBackend, type ChainInfo, type Group, type GroupResult,
} from './types';
import { fakeAddress, fakeSignature } from './wallets';

const MOCK_FEE_SOL = 0.00001; // pretend each transfer costs two signatures

export class MockBackend implements ChainBackend {
  readonly mode = 'mock' as const;
  private worldId = 'none';
  private chainInfo: ChainInfo | null = null;
  private txs = 0;
  private minted = new Map<number, number>();
  private commonsMinted = SUPPLY;

  async genesis(world: World): Promise<void> {
    this.worldId = world.id;
    this.txs = 0;
    this.minted.clear();
    const float = floatSize();
    let toNations = 0;
    for (const c of world.countries) {
      if (!c.alive || toNations + float > SUPPLY) continue;
      this.minted.set(c.id, float);
      toNations += float;
    }
    this.commonsMinted = SUPPLY - toNations;
    this.chainInfo = {
      name: currencyName(world), symbol: SYMBOL, mint: fakeAddress(`${world.id}:mint`), supply: SUPPLY,
      mintAuthority: null, commons: fakeAddress(`${world.id}:commons`),
    };
  }
  ready(): boolean { return this.chainInfo !== null; }
  info(): ChainInfo | null { return this.chainInfo; }
  addressOf(countryId: number): string | null { return fakeAddress(`${this.worldId}:nation:${countryId}`); }
  floats() { return { nations: new Map(this.minted), commons: this.commonsMinted }; }
  canMove(): boolean { return true; }
  /** Every founded nation can move at once; the fake address needs no account. */
  async openAccount(): Promise<boolean> { return true; }
  needsAccount(): boolean { return false; }
  balanceOf(): number | null { return null; }
  commonsBalance(): number | null { return null; }

  async settle(groups: Group[], maxTx: number): Promise<GroupResult[]> {
    return groups.slice(0, maxTx).map((group) => {
      this.txs++;
      return { group, ok: true, status: 'simulated' as const, signature: fakeSignature() };
    });
  }

  stats() { return { transactions: this.txs, feesSol: this.txs * MOCK_FEE_SOL }; }
}
