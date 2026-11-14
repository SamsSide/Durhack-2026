// The one Gemini client for the server: structured JSON calls, a call/token meter and the budget caps.
// Rows A5 (ruler decisions), A13 (lore) and later rows all call llmJson(); on any failure it throws
// and the caller falls back to its template or autopilot.
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export type LlmMode = 'mock' | 'live';

export class LlmUnavailable extends Error {
  constructor(message: string) { super(message); this.name = 'LlmUnavailable'; }
}

/** A tiny JSON schema: used both to ask Gemini for the shape and to validate what comes back. */
export type Schema =
  | { type: 'string' | 'number' | 'integer' | 'boolean'; enum?: string[]; description?: string }
  | { type: 'array'; items: Schema; minItems?: number; maxItems?: number; description?: string }
  | { type: 'object'; properties: Record<string, Schema>; required?: string[]; description?: string };

export interface LlmJsonOptions {
  model: string;
  system: string;
  prompt: string;
  schema: Schema;
  maxOutputTokens: number;
  /** For logs and the meter, e.g. 'lore' or 'ruler'. */
  purpose: string;
  /** Optional inline images (base64, no data: prefix) sent with the prompt (multimodal input). */
  images?: { data: string; mimeType: string }[];
}

export interface Budget {
  type: 'budget';
  calls: number; tokensIn: number; tokensOut: number; callsPerMin: number; capped: boolean; mode: LlmMode;
}

const envNum = (name: string, def: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : def;
};
export const DEFAULT_MODEL_LORE = 'gemini-3.5-flash';
export const DEFAULT_MODEL_RULER = 'gemini-3.5-flash-lite';

export const loreModel = () => process.env.GEMINI_MODEL_LORE || DEFAULT_MODEL_LORE;
export const rulerModel = () => process.env.GEMINI_MODEL_RULER || DEFAULT_MODEL_RULER;
export const bibleModel = () => process.env.GEMINI_MODEL_BIBLE || process.env.GEMINI_MODEL_RULER || DEFAULT_MODEL_RULER;
export const llmMode = (): LlmMode => (process.env.LLM_MODE === 'live' ? 'live' : 'mock');

let forcedMock = false;
/** index.ts calls this for --mock so the flag beats the environment. */
export function forceMockMode(on: boolean): void { forcedMock = on; }
const mode = (): LlmMode => (forcedMock ? 'mock' : llmMode());
/** The mode in force right now (--mock beats the environment). */
export const currentMode = mode;

// --- meter -------------------------------------------------------------------
let calls = 0, tokensIn = 0, tokensOut = 0;
let recent: number[] = []; // call start times in the last 60 s

const prune = (now: number) => { recent = recent.filter((t) => now - t < 60_000); };
const isCapped = (now = Date.now()) => {
  prune(now);
  return recent.length >= envNum('LLM_MAX_CALLS_PER_MIN', 20)
    || tokensIn + tokensOut >= envNum('LLM_MAX_TOKENS_PER_RUN', 400_000);
};

export function getBudget(): Budget {
  const now = Date.now();
  prune(now);
  return { type: 'budget', calls, tokensIn, tokensOut, callsPerMin: recent.length, capped: isCapped(now), mode: mode() };
}

/** Painted-flag image calls this run (counted separately from the text meter). */
let imageCalls = 0;
export const imageCallCount = () => imageCalls;
export function noteImageCall(): void { imageCalls++; calls++; recent.push(Date.now()); }

/** A new world starts a fresh budget. */
export function resetRun(): void { imageCalls = 0; calls = 0; tokensIn = 0; tokensOut = 0; recent = []; }

// --- validation --------------------------------------------------------------
export function validate<T>(value: unknown, schema: Schema, path = 'value'): T {
  const fail = (why: string): never => { throw new Error(`bad ${path}: ${why}`); };
  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') fail('expected string');
      if (schema.enum && !schema.enum.includes(value as string)) fail(`not one of ${schema.enum.join('|')}`);
      return value as T;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) fail('expected number');
      return value as T;
    case 'integer':
      if (!Number.isInteger(value)) fail('expected integer');
      return value as T;
    case 'boolean':
      if (typeof value !== 'boolean') fail('expected boolean');
      return value as T;
    case 'array': {
      if (!Array.isArray(value)) fail('expected array');
      const arr = value as unknown[];
      if (schema.minItems !== undefined && arr.length < schema.minItems) fail(`fewer than ${schema.minItems} items`);
      if (schema.maxItems !== undefined && arr.length > schema.maxItems) fail(`more than ${schema.maxItems} items`);
      return arr.map((v, i) => validate(v, schema.items, `${path}[${i}]`)) as T;
    }
    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) fail('expected object');
      const obj = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [k, s] of Object.entries(schema.properties)) {
        if (obj[k] === undefined || obj[k] === null) {
          if (schema.required?.includes(k)) fail(`missing ${k}`);
          continue;
        }
        out[k] = validate(obj[k], s, `${path}.${k}`);
      }
      return out as T;
    }
  }
}

/** Our schema to the Gemini response schema (upper-case type names). */
function toGemini(s: Schema): Record<string, unknown> {
  const out: Record<string, unknown> = { type: s.type.toUpperCase() };
  if (s.description) out.description = s.description;
  if (s.type === 'string' && s.enum) out.enum = s.enum;
  if (s.type === 'array') { out.items = toGemini(s.items); if (s.minItems !== undefined) out.minItems = s.minItems; if (s.maxItems !== undefined) out.maxItems = s.maxItems; }
  if (s.type === 'object') {
    out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGemini(v)]));
    if (s.required) out.required = s.required;
  }
  return out;
}

// --- the call ----------------------------------------------------------------
let client: GoogleGenAI | null = null;

export async function llmJson<T>(opts: LlmJsonOptions): Promise<T> {
  if (mode() !== 'live') throw new LlmUnavailable('LLM_MODE is mock');
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new LlmUnavailable('GEMINI_API_KEY is not set');
  if (isCapped()) throw new LlmUnavailable('budget cap reached');
  client ??= new GoogleGenAI({ apiKey: key });

  calls++;
  recent.push(Date.now());
  const started = Date.now();
  try {
    const res = await client.models.generateContent({
      model: opts.model,
      contents: opts.images?.length
        ? [{ role: 'user', parts: [...opts.images.map((i) => ({ inlineData: { data: i.data, mimeType: i.mimeType } })), { text: opts.prompt }] }]
        : opts.prompt,
      config: {
        systemInstruction: opts.system,
        responseMimeType: 'application/json',
        responseSchema: toGemini(opts.schema) as never,
        maxOutputTokens: opts.maxOutputTokens,
        temperature: 0.9,
        // Thinking eats the output budget and adds seconds; structured lore and decisions need none.
        thinkingConfig: /gemini-2\.5/.test(opts.model) ? { thinkingBudget: 0 } : { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    });
    tokensIn += res.usageMetadata?.promptTokenCount ?? 0;
    tokensOut += (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0);
    const text = res.text;
    if (!text) throw new Error('empty response');
    return validate<T>(JSON.parse(text), opts.schema);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`llm ${opts.purpose} failed after ${Date.now() - started} ms: ${msg.slice(0, 200)}`);
    throw e instanceof LlmUnavailable ? e : new LlmUnavailable(`${opts.purpose}: ${msg.slice(0, 200)}`);
  }
}
