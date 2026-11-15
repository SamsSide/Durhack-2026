// LLM provider check: for the current env, one ruler-shaped call per selected route.
// Prints `PASS provider model ms` or `FAIL reason` per route; exits 1 if any route fails.
// Needs GEMINI_API_KEY (and a running Ollama for the ollama routes). Uses ~1 tiny call per route.
// Run from the repo root:  LLM_PROVIDER=hybrid npx tsx server/scripts/check-llm.ts
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { llmJson, llmProvider, modelForRoute, routeFor, rulerModel, loreModel, type Schema } from '../src/llm';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });
process.env.LLM_MODE = 'live';

const schema: Schema = {
  type: 'object', required: ['focus', 'stance', 'say'],
  properties: {
    focus: { type: 'string', enum: ['expand', 'develop', 'fortify', 'attack'] },
    stance: { type: 'string', enum: ['war', 'hostile', 'neutral', 'trade', 'alliance'] },
    say: { type: 'string', description: 'One short sentence, in character.' },
  },
};
const digest = {
  id: 3, name: 'Karthal', era: 'medieval', year: 412, provinces: 18, gold: 240,
  neighbours: [
    { id: 1, name: 'Ormand', stance: 'neutral', strength: 12, grievance: 0 },
    { id: 2, name: 'Velis', stance: 'hostile', strength: 20, grievance: 3 },
  ],
};
const ask = (purpose: string, model: string) => llmJson<{ focus: string; stance: string; say: string }>({
  model, purpose, schema, maxOutputTokens: 220,
  system: 'You are the ruler of a fictional nation. Reply with one decision as JSON only.',
  prompt: `Digest (JSON):\n${JSON.stringify(digest)}\nDecide for ${digest.name} now.`,
});

const provider = llmProvider();
// One purpose per distinct route: `ruler` always, plus `lore` in hybrid (it stays on Gemini).
const purposes = provider === 'hybrid' ? ['ruler', 'lore'] : ['ruler'];
let failed = false;
console.log(`LLM_PROVIDER=${provider}`);
for (const purpose of purposes) {
  const route = routeFor(purpose);
  const geminiModel = purpose === 'ruler' ? rulerModel() : loreModel();
  const model = modelForRoute(route, geminiModel);
  const t = Date.now();
  try {
    const out = await ask(purpose, geminiModel);
    console.log(`PASS ${route} ${model} ${Date.now() - t} ms (purpose ${purpose}: ${out.focus}/${out.stance})`);
  } catch (e) {
    failed = true;
    console.log(`FAIL ${route} ${model} (purpose ${purpose}): ${e instanceof Error ? e.message : String(e)}`);
  }
}
process.exit(failed ? 1 : 0);
