import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import dotenv from 'dotenv';
import { createApp } from './net/http';
import { attachWs } from './net/ws';
import { MockRunner } from './mock/runner';
import { EngineRunner } from './engine/runner';
import type { LlmMode, WorldRunner } from './runner';
import { forceMockMode, resetRun } from './llm';
import { bindLore } from './story/loreAi';

// .env lives at the repo root (may be missing).
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

const mockFlag = process.argv.includes('--mock') || process.env.MOCK_WORLD === '1';
const mode: LlmMode = mockFlag ? 'mock' : process.env.LLM_MODE === 'live' ? 'live' : 'mock';
const port = Number(process.env.PORT ?? 8787);

// `npm run mock` plays the scripted mock world; `npm run dev` builds real worlds (rows A2, A3).
const runner: WorldRunner = mockFlag ? new MockRunner() : new EngineRunner();
if (mockFlag) forceMockMode(true);
bindLore(runner);
// The engine resets the meter itself before it writes a world's bible (so the bible counts).
if (mockFlag) runner.subscribe({ snapshot: () => resetRun() });
if (mockFlag) void runner.newWorld({ prompt: 'a patchwork world of five young nations', seed: 1337 });

const server = http.createServer(createApp(runner, mode));
attachWs(server, runner, mode);
server.listen(port, () => {
  console.log(`terra server on :${port} (mode ${mode}${mockFlag ? ', mock world' : ''})`);
});
