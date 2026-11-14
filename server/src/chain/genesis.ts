// Row A27: devnet genesis, once per world. A Token-2022 mint with on-chain name and symbol and no
// mint authority afterwards, one token account per nation and one for the Commons (each requires a
// memo on incoming transfers), the fixed supply minted to the Commons and the starting treasuries
// to the nations. Kit 8 plugin client throughout; no web3.js.
import {
  generateKeyPairSigner, nonDivisibleSequentialInstructionPlan, sequentialInstructionPlan,
  type Address, type Instruction, type InstructionPlan, type KeyPairSigner,
} from '@solana/kit';
import {
  AuthorityType, extension, getCreateMintInstructionPlan, getCreateTokenInstructionPlan,
  getMintToCheckedInstruction, getSetAuthorityInstruction,
} from '@solana-program/token-2022';
import type { World } from '@terra/shared';
import { currencyName, DECIMALS, SUPPLY, SYMBOL, type ChainInfo } from './types';
import type { Wallets } from './wallets';
import type { ChainClient } from './settle';

export interface GenesisResult {
  info: ChainInfo;
  mint: KeyPairSigner;
  /** Token account address by owner wallet address (the Commons included). */
  tokenOf: Map<string, Address>;
  /** What each nation was minted, in coins. */
  minted: Map<number, number>;
  commonsMinted: number;
  transactions: number;
}

const toUnits = (coins: number) => BigInt(Math.round(coins * 10 ** DECIMALS));

export async function runGenesis(
  client: ChainClient, wallets: Wallets, world: World,
  send: (plan: InstructionPlan) => Promise<number>,
): Promise<GenesisResult> {
  const commons = wallets.commons;
  const mint = await generateKeyPairSigner();
  let transactions = 0;

  // 1. The mint, with its name and symbol on chain.
  transactions += await send(await getCreateMintInstructionPlan(client, {
    payer: commons,
    newMint: mint,
    decimals: DECIMALS,
    mintAuthority: commons,
    freezeAuthority: null,
    extensions: [
      extension('MetadataPointer', { authority: commons.address, metadataAddress: mint.address }),
      extension('TokenMetadata', {
        updateAuthority: commons.address, mint: mint.address, name: currencyName(world), symbol: SYMBOL,
        uri: '', additionalMetadata: new Map([['world', world.id]]),
      }),
    ],
  }));

  // 2. A token account for the Commons and for every nation that has a wallet; each one demands a
  //    memo on every incoming transfer (the chain refuses an unexplained payment).
  const owners: { key: string; signer: KeyPairSigner }[] = [{ key: commons.address, signer: commons }];
  for (const c of world.countries) {
    const w = wallets.walletOf(c.id);
    if (w) owners.push({ key: w.address, signer: w });
  }
  const tokenOf = new Map<string, Address>();
  const plans: InstructionPlan[] = [];
  for (const o of owners) {
    const token = await generateKeyPairSigner();
    tokenOf.set(o.key, token.address);
    plans.push(await getCreateTokenInstructionPlan(client, {
      payer: commons,
      newToken: token,
      mint: mint.address,
      owner: o.signer,
      extensions: [extension('MemoTransfer', { requireIncomingTransferMemos: true })],
    }));
  }
  transactions += await send(sequentialInstructionPlan(plans));

  // 3. Mint the whole supply: starting treasuries to the nations, the rest to the Commons.
  const minted = new Map<number, number>();
  let toNations = 0;
  const mints: Instruction[] = [];
  for (const c of world.countries) {
    const w = wallets.walletOf(c.id);
    if (!w || !c.alive || c.treasury <= 0) continue;
    const coins = Math.round(c.treasury * 100) / 100;
    minted.set(c.id, coins);
    toNations += coins;
    mints.push(getMintToCheckedInstruction({
      mint: mint.address, token: tokenOf.get(w.address)!, mintAuthority: commons, amount: toUnits(coins), decimals: DECIMALS,
    }));
  }
  const commonsMinted = Math.max(0, SUPPLY - toNations);
  mints.push(getMintToCheckedInstruction({
    mint: mint.address, token: tokenOf.get(commons.address)!, mintAuthority: commons, amount: toUnits(commonsMinted), decimals: DECIMALS,
  }));
  transactions += await send(sequentialInstructionPlan(mints));

  // 4. Nobody can print money any more: revoke the mint authority.
  transactions += await send(nonDivisibleSequentialInstructionPlan([
    getSetAuthorityInstruction({
      owned: mint.address, owner: commons, authorityType: AuthorityType.MintTokens, newAuthority: null,
    }),
  ]));

  return {
    info: { name: currencyName(world), symbol: SYMBOL, mint: mint.address, supply: SUPPLY, mintAuthority: null, commons: commons.address },
    mint, tokenOf, minted, commonsMinted, transactions,
  };
}
