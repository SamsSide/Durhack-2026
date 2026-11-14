// Row A27: wallets. Real keypairs come from SOLANA_KEYS_DIR (written by scripts/solana-keys.ts,
// never in the repo); the mock mode makes up addresses and signatures that only look like base58.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { KeyPairSigner } from '@solana/kit';
import { MAX_NATION_WALLETS } from './types';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = '';
  while (n > 0n) { out = ALPHABET[Number(n % 58n)]! + out; n /= 58n; }
  for (const b of bytes) { if (b === 0) out = '1' + out; else break; }
  return out;
}

/** A stable fake address (32 bytes) for a label, so the mock shows the same wallet every time. */
export function fakeAddress(label: string): string {
  return base58(crypto.createHash('sha256').update(`terra-nova-mock:${label}`).digest());
}
/** A fake transaction signature (64 bytes, 87 or 88 characters). */
export function fakeSignature(): string { return base58(crypto.randomBytes(64)); }

export function keysDir(): string {
  const raw = process.env.SOLANA_KEYS_DIR?.trim();
  if (!raw) return path.join(os.homedir(), '.config', 'durhack', 'solana');
  return raw.startsWith('~') ? path.join(os.homedir(), raw.slice(1)) : raw;
}

export const nationKeyFile = (id: number) => `nation-${String(id).padStart(2, '0')}.json`;

export interface Wallets {
  commons: KeyPairSigner;
  /** By country id; nations beyond MAX_NATION_WALLETS (or with no key file) have none. */
  nations: Map<number, KeyPairSigner>;
  walletOf(countryId: number): KeyPairSigner | null;
}

/** Loads commons.json and nation-NN.json. Throws with a plain message when commons.json is missing. */
export async function loadWallets(dir = keysDir()): Promise<Wallets> {
  const { createKeyPairSignerFromBytes } = await import('@solana/kit');
  const read = async (file: string): Promise<KeyPairSigner | null> => {
    const p = path.join(dir, file);
    if (!fs.existsSync(p)) return null;
    const bytes = JSON.parse(fs.readFileSync(p, 'utf8')) as number[];
    return createKeyPairSignerFromBytes(Uint8Array.from(bytes));
  };
  const commons = await read('commons.json');
  if (!commons) throw new Error(`no commons.json in ${dir}; run: npx tsx scripts/solana-keys.ts`);
  const nations = new Map<number, KeyPairSigner>();
  for (let id = 0; id < MAX_NATION_WALLETS; id++) {
    const s = await read(nationKeyFile(id));
    if (s) nations.set(id, s);
  }
  return { commons, nations, walletOf: (id) => nations.get(id) ?? null };
}
