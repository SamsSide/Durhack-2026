// Row A27: the mock chain. No network, no keys: addresses and signatures only look real.
import type { World } from '@terra/shared';
import { currencyName, SUPPLY, SYMBOL, type ChainBackend, type ChainInfo, type Group, type GroupResult } from './types';
import { fakeAddress, fakeSignature } from './wallets';

const MOCK_FEE_SOL = 0.00001; // pretend each transfer costs two signatures

export class MockBackend implements ChainBackend {
  readonly mode = 'mock' as const;
  private worldId = 'none';
  private chainInfo: ChainInfo | null = null;
  private txs = 0;

  async genesis(world: World): Promise<void> {
    this.worldId = world.id;
    this.txs = 0;
    this.chainInfo = {
      name: currencyName(world), symbol: SYMBOL, mint: fakeAddress(`${world.id}:mint`), supply: SUPPLY,
      mintAuthority: null, commons: fakeAddress(`${world.id}:commons`),
    };
  }
  ready(): boolean { return this.chainInfo !== null; }
  info(): ChainInfo | null { return this.chainInfo; }
  addressOf(countryId: number): string | null { return fakeAddress(`${this.worldId}:nation:${countryId}`); }
  balanceOf(): number | null { return null; }
  commonsBalance(): number | null { return null; }

  async settle(groups: Group[]): Promise<GroupResult[]> {
    return groups.map((group) => {
      this.txs++;
      return { group, ok: true, status: 'simulated' as const, signature: fakeSignature() };
    });
  }

  stats() { return { transactions: this.txs, feesSol: this.txs * MOCK_FEE_SOL }; }
}
