# P2 - Best Use of Gemini API (MLH)

Researched 13 Nov 2026 with WebSearch/WebFetch only. Devpost pages for DurHack, HackAI and UB Hacking returned 403. Anything about the DurHack Devpost listing is unconfirmed.

## 1. What they want

- Prize: MLH swag kits. Source: [MLH prizes page](https://www.mlh.com/events/prizes). The listing states no promo code for this category.
- Date risk: the MLH prizes page labels this category "Q1 2025 - Q1 2026". That is before today. The brief says DurHack 2026 offers it, so check the DurHack Devpost prize list tomorrow. Gemini prizes still appear on 2026 events (HackAI 2026, HackBeanpot 2026, UB Hacking 2026, TAMUhack 2026).
- MLH brief: push the boundaries of AI with Gemini (personalised advice chatbot, research paper summaries, creative content). Landing link https://mlh.link/gemini (redirects to Google Cloud / AI Studio).
- Devpost wording at other events: Gemini "has to do real work in the project, not just appear in the stack" ([UB Hacking 2026](https://ubhacking2026.devpost.com/), via search); Google's own events weigh "creativity, technical execution, Gemini API use, impact, presentation" ([Build with Gemini](https://build-with-gemini-0.devpost.com/)); "effective and meaningful use of the Gemini API, creativity and innovation, technical implementation" on a Devpost listing. Another event required submissions to say how Gemini was used ([Code with Gemini API](https://code-api.devpost.com/)).
- Judge appeal: multimodal input (camera, voice, PDFs), Live API, grounding, structured output and function calling doing visible work.
- Who judges: MLH does not document it. Assume MLH rep or staff from the Devpost text. Unconfirmed.

## 2. Tech as of Nov 2026

Sources: [model list](https://aistudio.google.com/docs/models), [get started](https://aistudio.google.com/docs/get-started), [Live API](https://aistudio.google.com/docs/live), [pricing](https://aistudio.google.com/docs/pricing). The ai.google.dev docs now redirect to aistudio.google.com/docs.

| Use | Model ids (per model page) |
| --- | --- |
| Text, newest | `gemini-4-carbon`, `gemini-4-argon`, `gemini-4-hydrogen` (used in the quickstart; stability not labelled) |
| Text, stable | `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite` |
| Live voice | `gemini-3.8-live`, `gemini-3.8-live-extended-thinking`; transcription `gemini-3.5-transcribe-live`; translation `gemini-3.5-live-translate-preview` |
| Image | `gemini-nano-banana-2.1`, `gemini-3.1-flash-image`, `gemini-3-pro-image` (Imagen 4 shut down) |
| Video | `gemini-omni-1.2-flash`, `gemini-omni-1.1-flash` |
| TTS | `gemini-3.8-flash-tts`, `gemini-3.8-flash-lite-tts` |
| Embeddings | `gemini-embedding-2` |
| Agents | `deep-research-preview-04-2026`, `antigravity-preview-09-2026` (passed as `agent`) |

- Gone or going: `gemini-2.0-flash`, `gemini-3-pro-preview` shut down; `gemini-2.5-flash` and `gemini-2.5-pro` reroute on 1 Dec 2026. Old tutorials using 2.x ids will break.
- The quickstart uses a new `interactions.create()` call, not the older `generate_content`. Whether `generate_content` still works: unconfirmed; check the docs tomorrow.
- Live API: stateful WebSocket; input 16-bit PCM 16kHz plus JPEG at up to 1 fps; output PCM 24kHz; barge-in, tool use, transcription, affective dialog, 70 languages. Use ephemeral tokens for browser-direct connections. Session limits not found.
- Grounding, function calling and structured output: listed as supported by the main text model in the quickstart; Google Search grounding specifics not read (unconfirmed).
- Auth: key from https://aistudio.google.com/apikey, env var `GEMINI_API_KEY`.
- Install: Python `pip install -U google-genai`; JS `npm install @google/genai`.

Hello world (from the quickstart; exact call shape per the docs page, which described it in prose):

```python
from google import genai
client = genai.Client()   # reads GEMINI_API_KEY
resp = client.interactions.create(
    model="gemini-4-hydrogen",
    input="Explain how AI works in a few words.",
)
print(resp.output_text)
```

```typescript
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({});
const resp = await ai.interactions.create({
  model: "gemini-4-hydrogen",
  input: "Explain how AI works in a few words.",
});
console.log(resp.output_text);
```

Verify the argument names against the quickstart before relying on them; I paraphrased from a summary.

Free tier ([pricing page](https://aistudio.google.com/docs/pricing)):
- Free: Gemini 4 Hydrogen, 3.8 Flash, 3.8 Live (all variants), 3.5 Live Translate, 3.5 Transcribe Live, 3.8 Flash TTS. Free-tier prompts may be used to improve Google products.
- Paid only: all image models (Nano Banana 2.1 about $0.034 per 1K image). Video (Omni) is "not supported" on the free tier per the rate-limits page.
- Free limits listed for one model only: 200 requests/min, 50,000 tokens/min, 10,000 requests/day. Other models: unconfirmed. Free access needs an active project; some projects need verification.
- MLH promo: none listed. The Gemini category has no code.
- Time to first call: about 5 minutes.
- Gotchas: image and video generation need billing; use free text/live/TTS for the core of the demo; do not paste private data on the free tier; rate limits during a 24h crunch with a whole team on one key.
- MLH also runs an "Intro to Google AI Studio" workshop at the event (from the brief; not independently confirmed).

## 3. Past winners

No named winner project pages were retrievable. Searches returned prize listings only.

| Item | Detail | Source |
| --- | --- | --- |
| Fall Hacks 2026 | Self-reported Best Use of Gemini API by a solo builder (LinkedIn, not official) | [Ca Lau](https://ca.linkedin.com/in/ca-lau) |
| Google Gemini API Developer Competition 2024 | Not MLH. Best Overall App: Jayu, Best Game App: Pen Apple. Shows what Google itself likes: full products with clear use cases. | [Google blog](https://developers.googleblog.com/announcing-the-winners-of-the-gemini-api-developer-competition/) |
| Rivalry Roast | Entered Best Use of Google AI at DEV Weekend Challenge (win not confirmed). Gemini wrote comebacks in a voice pipeline. | [dev.to](https://dev.to/jyotish08/rivalry-roast-you-talk-smack-about-your-team-or-favorite-player-out-loud-and-an-ai-rival-mc5) |
| DEV "Built with Google Gemini" challenge (MLH-presented) winners | Writing challenge, not a hack prize | [dev.to](https://dev.to/devteam/congrats-to-the-built-with-google-gemini-writing-challenge-winners-5ej6) |

Events listing the prize in 2026: UB Hacking, TAMUhack, HackRPI, HackPrinceton Spring, HackAI. No DurHack 2025 or UK winner found. Gap.

## 4. Judging and demo format

- Criteria (other events): meaningful Gemini use, creativity, technical execution, impact, presentation.
- Demo: show the Gemini feature doing something visible (live camera, voice, long document in, structured output out). Explain in the Devpost text which model ids and features.

## 5. Effort and risk (24h)

- Minimum to qualify: 1 hour (one real Gemini call driving a core feature).
- To compete: 4 to 6 hours (multimodal or Live API, function calling, grounding).
- Risks: this is the most crowded MLH prize and the reward is swag, so it is a side effect, not a goal; the MLH listing date may mean the category is gone (check Devpost tomorrow); model names churn, so copy ids from the docs page, not memory; free-tier rate limits and data use.

## 6. Stackability

| Other prize | Fit |
| --- | --- |
| ElevenLabs | Strong: Gemini thinks, ElevenLabs speaks. |
| Entire | Free; independent. |
| Solana | Possible if idea is on-chain; Gemini as an explainer or agent. |
| Tiger Data | Good: Postgres/Timescale for data Gemini analyses; embeddings with pgvector style use. Unconfirmed product detail. |
| Vultr | Good: host backend; GPU not needed since Gemini is hosted. |
| MongoDB Atlas | Good: vector search with `gemini-embedding-2`, session memory. |
| DEV writing challenge | Free add-on; DEV has run Gemini-themed challenges with MLH. |

## 7. Scores (1-5, 5 is best / cheapest)

- Fit for any idea: 5 (any app can use an LLM).
- Win chance: 3 (crowded, but only needs real use).
- Value: 1 (swag kit).
- Effort: 5.

## 8. Do this tonight

- Create a Google AI Studio API key at https://aistudio.google.com/apikey (Google account only, no approval wait). Store as `GEMINI_API_KEY`.
- Run the hello world with `gemini-4-hydrogen` and confirm it works on the free tier. Then try `gemini-3.8-live` once.
- No promo code for this prize. Do not enable billing unless the team wants image or video generation.
- Tomorrow: read the DurHack Devpost prize text to confirm Gemini is on offer and any extra criteria; attend the MLH Intro to Google AI Studio workshop if useful.
