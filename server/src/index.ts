import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import dotenv from 'dotenv';
import { createApp } from './net/http';
import { attachWs } from './net/ws';
import { MockRunner } from './mock/runner';
import type { LlmMode } from './runner';

// .env lives at the repo root (may be missing).
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

const mockFlag = process.argv.includes('--mock') || process.env.MOCK_WORLD === '1';
const mode: LlmMode = mockFlag ? 'mock' : process.env.LLM_MODE === 'live' ? 'live' : 'mock';
const port = Number(process.env.PORT ?? 8787);

// Seed: only the mock runner exists. The real engine (rows A3, A7) will implement WorldRunner.
const runner = new MockRunner();
if (mockFlag) runner.newWorld({ prompt: 'a patchwork world of five young nations', seed: 1337 });

const server = http.createServer(createApp(runner, mode));
attachWs(server, runner, mode);
server.listen(port, () => {
  console.log(`terra server on :${port} (mode ${mode}${mockFlag ? ', mock world' : ''})`);
});
