import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import dotenv from 'dotenv';
import { createApp } from './net/http';
import { attachWs } from './net/ws';
import { MockRunner } from './mock/runner';
import { EngineRunner } from './engine/runner';
import { RunnerHub } from './engine/replayRunner';
import { bindRecorder } from './engine/replays';
import type { LlmMode, WorldRunner } from './runner';
import { forceMockMode, resetRun } from './llm';
import { bindLore } from './story/loreAi';
import { bindTiger } from './tiger';
import { bindChain } from './chain';

// .env lives at the repo root (may be missing).
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });
// Voice off (the desktop app's switch, demo.sh --no-voice): dotenv has just put the key back from
// .env, so drop it again or every voice line still calls ElevenLabs and spends credit.
if (process.env.DEMO_VOICE === '0') delete process.env.ELEVENLABS_API_KEY;

// The world lives in this process: one stray rejection or throw (a failed chain, Gemini or
// ElevenLabs call, a bad control) must not end it mid-demo. Log it and carry on.
process.on('unhandledRejection', (reason) => { console.error('unhandled rejection (server kept running):', reason); });
process.on('uncaughtException', (err) => { console.error('uncaught exception (server kept running):', err); });

const mockFlag = process.argv.includes('--mock') || process.env.MOCK_WORLD === '1';
const mode: LlmMode = mockFlag ? 'mock' : process.env.LLM_MODE === 'live' ? 'live' : 'mock';
const port = Number(process.env.PORT ?? 8787);

// `npm run mock` plays the scripted mock world; `npm run dev` builds real worlds (rows A2, A3).
const live: WorldRunner = mockFlag ? new MockRunner() : new EngineRunner();
if (mockFlag) forceMockMode(true);
// Every run is recorded (row A9); the hub lets a saved run be played in place of the live world.
const recorder = bindRecorder(live);
const runner: WorldRunner = new RunnerHub(live);
bindLore(runner);
bindTiger(runner);
bindChain(runner);
// The engine resets the meter itself before it writes a world's bible (so the bible counts).
if (mockFlag) runner.subscribe({ snapshot: () => resetRun() });
if (mockFlag) void runner.newWorld({ prompt: 'a patchwork world of five young nations', seed: 1337 });

const server = http.createServer(createApp(runner, mode, recorder));
attachWs(server, runner, mode);
server.listen(port, () => {
  console.log(`terra server on :${port} (mode ${mode}${mockFlag ? ', mock world' : ''})`);
});
