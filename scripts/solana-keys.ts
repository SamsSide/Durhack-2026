// Row A27: writes the Solana keypairs for the economy mirror: commons.json and nation-00.json to
// nation-11.json, standard 64-byte JSON (the Solana CLI reads them too), mode 0600, into
// SOLANA_KEYS_DIR (default ~/.config/durhack/solana, outside the repo). It never overwrites a file,
// so it is safe to run again. It does not touch the network and never prints a secret key.
//
//   npx tsx scripts/solana-keys.ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateKeyPairSigner, writeKeyPairSigner } from '@solana/kit';

const raw = process.env.SOLANA_KEYS_DIR?.trim();
const dir = !raw ? path.join(os.homedir(), '.config', 'durhack', 'solana') : raw.startsWith('~') ? path.join(os.homedir(), raw.slice(1)) : raw;
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

const files = ['commons.json', ...Array.from({ length: 12 }, (_, i) => `nation-${String(i).padStart(2, '0')}.json`)];
let made = 0;
for (const f of files) {
  const p = path.join(dir, f);
  if (fs.existsSync(p)) { console.log(`keep   ${f} (already exists)`); continue; }
  await writeKeyPairSigner(await generateKeyPairSigner(true), p);
  fs.chmodSync(p, 0o600);
  console.log(`wrote  ${f}`);
  made++;
}

// The Commons address is the only one a human needs: it pays every fee and all rent.
const { createKeyPairSignerFromBytes } = await import('@solana/kit');
const bytes = Uint8Array.from(JSON.parse(fs.readFileSync(path.join(dir, 'commons.json'), 'utf8')) as number[]);
const commons = await createKeyPairSignerFromBytes(bytes);
console.log(`\n${made} key file(s) written in ${dir}`);
console.log(`Commons address: ${commons.address}`);
console.log('Fund it at https://faucet.solana.com (a human does this); about 0.1 devnet SOL is plenty for a world.');
console.log('Set SOLANA_MODE=devnet in .env when it is funded. Never commit or paste these key files.');
