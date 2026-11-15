# Gemma running locally for Terra Nova: does it work, and does it still count for the Gemini prize?

Researched 14 Nov 2026, late evening, using WebSearch, WebFetch and the Ollama GitHub releases API. I measured nothing on the laptop. Every speed figure below is an estimate unless it says otherwise.

## Verdict

**Partly viable.**

- **On the hardware:** it is viable. Gemma 4 E4B (QAT, about 6 GB) fits in 12 GB with about 4-5 GB left over. My estimate for one ruler call (2k tokens in, 200 out) is about 3 s, against about 2.5 s on Gemini.
- **For the prize:** local Gemma does not count as using the Gemini API. MLH's own Gemma rules say Gemma has to be used "through the Gemini API" (quotes below).
- **What would work:** a hybrid. Local Gemma takes the high-volume ruler turns. The Gemini API stays on the voice decrees, the world bible, the news broadcast and the painted flags. That keeps the Gemini prize claim intact.
- **What I advise for tomorrow morning:** keep Gemini only for the live demo. Build the local path only if the owner wants "runs offline" in the pitch and someone can test it alongside the globe tonight.

## 1. Which Gemma models exist (Nov 2026)

Gemma 4 came out on 2 Apr 2026 under Apache 2.0 ([Google blog](https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/)). A 12B model followed in Ollama 0.30.3 on 3 Jun 2026 ([Ollama releases](https://github.com/ollama/ollama/releases)). Gemma 3 and 3n are older.

| Model | Params | Context | Input | Weights at Q4_0 (Google) | Ollama QAT tag size | Fits 12 GB with 2-3 GB spare? |
| --- | --- | --- | --- | --- | --- | --- |
| E2B | 2B effective | 128K | text, image, video, audio | 2.9 GB | `gemma4:e2b-it-qat` 4.3 GB | Yes, easily |
| **E4B** | 4B effective | 128K | text, image, video, audio | 4.5 GB | `gemma4:e4b-it-qat` 6.1 GB | **Yes (about 4-5 GB left)** |
| **12B** | 12B dense | 256K (Ollama) | text, image, video, audio | 6.7 GB | `gemma4:12b-it-qat` 7.2 GB | Tight (about 3 GB left); may spill to CPU |
| 26B A4B (MoE) | 26B total, 3.8B active | 256K | text, image, video | 14.4 GB | `gemma4:26b-a4b-it-qat` 16 GB | No |
| 31B | 31B dense | 256K | text, image, video | 17.5 GB | `gemma4:31b-it-qat` 19 GB | No |

Sources:

- [Gemma core docs](https://ai.google.dev/gemma/docs/core): modalities and the memory table. Weights only; the KV cache is extra.
- [Ollama gemma4 tags](https://ollama.com/library/gemma4/tags) and [the gemma4 library page](https://ollama.com/library/gemma4).

The Ollama tag list shows only "Text, Image" for every tag. The model table on the same page lists audio for E2B and E4B.

**Picks**

1. **`gemma4:e4b-it-qat`**: the best fit. It is fast, leaves room for the globe, and its MMLU-Pro (69.4%) is above Gemma 3 27B's (67.6%).
2. **`gemma4:12b-it-qat`**: better reasoning, but about 2x slower and close to the VRAM limit while Chrome runs.

**The installed Ollama is too old for some of this.** The laptop has Ollama 0.24.0 (14 May 2026).

- `gemma4:12b` needs 0.30.3 or later. 0.30.5 fixed a crash on CUDA and Windows.
- The `-qat` tags arrived in 0.30.6.
- The latest version is 0.40.13 (28 Oct 2026).
- Update before pulling. Download sizes are 6-7 GB, so pull tonight, not on the venue wifi.

## 2. Speed on this GPU

Hardware facts:

- The RTX 5070 Ti Laptop has 12 GB of GDDR7 on a 192-bit bus, about **672 GB/s** ([Notebookcheck](https://www.notebookcheck.net/Nvidia-GeForce-RTX-5070-Ti-Laptop-Benchmarks-and-Specs.934945.0.html)).
- The desktop RTX 5070 has the same memory bandwidth. The desktop 5070 Ti has 896 GB/s.

I found no measured Gemma 4 benchmark on this GPU. What exists:

| Source | GPU | Model | Decode tok/s | Measured? |
| --- | --- | --- | --- | --- |
| [willitrunai](https://willitrunai.com/es/can-run/gemma-4-e4b-on-rtx-5070-12gb) | RTX 5070 12 GB (desktop) | E4B Q4_K_M | about 93 | Estimate |
| [modelfit](https://modelfit.io/can-i-run/gemma4-12b-q4-on-rtx-5070-ti/) | RTX 5070 Ti 16 GB (desktop) | 12B Q4_K_M | about 62 | Estimate |
| [insiderllm](https://insiderllm.com/guides/wicked-fast-gemma-4-26b-a4b-vs-qwen-3-6-27b-rtx-3090/) (8 May 2026) | RTX 3090 | 26B-A4B Q4 | 128 | Measured (llama.cpp) |
| [Reddit report](https://redlib.ssps.io/r/LocalLLaMA/comments/1l6xo6e/low_token_per_second_on_rtx5070ti_laptop_with_phi) | 5070 Ti Laptop | Phi-4 (14B) | about 30 | Anecdote |

My estimates for this laptop work from bandwidth. Decode speed is limited by memory bandwidth, and prompt processing by compute. All of these are unverified.

| | E4B QAT | 12B QAT | Gemini (today) |
| --- | --- | --- | --- |
| Prompt processing, 2k tokens | 0.4-0.8 s | 1-2 s | - |
| Decode | 70-90 tok/s | 35-50 tok/s | - |
| **One ruler call (2k in, 200 out)** | **about 3 s (2.5-4)** | **about 6 s (5-8)** | **about 2.5 s** |
| Calls/min, one at a time | about 20 | about 10 | capped at 20 by us |
| Calls/min, `OLLAMA_NUM_PARALLEL=2-4` | maybe 35-50 | maybe 15-20 | - |
| Cold model load | 5-15 s (avoid with `keep_alive: -1` and a warm-up call) | same | - |

Caveats:

- **Turn thinking off.** Gemma 4 thinks by default. Pass `think: false` or a 200-token call becomes a 2,000-token call ([Ollama library page](https://ollama.com/library/gemma4)).
- **If the model spills past VRAM, speed collapses.** Ollama quietly moves layers to the CPU and decode drops to 4-8 tok/s. Check that `ollama ps` shows 100% GPU.
- **The globe and the model share one GPU.** Windows time-slices graphics and CUDA work. Expect frame drops while tokens are being generated. I could not find data on how big the drop is, so it is unverified. Test it with the in-app fps meter.

## 3. Structured JSON locally

- **Ollama native `/api/chat`.** Pass a JSON schema in the `format` field ([docs](https://docs.ollama.com/capabilities/structured-outputs)). The output is constrained to the schema by a grammar, so the result always parses. Also send `think: false`, `options: {temperature, num_predict, num_ctx}` and `keep_alive`. The docs advise putting the schema in the prompt text as well.
- **Gemma 4 fixes in Ollama:** 0.21.1 "Fixed structured outputs for Gemma 4 when `think=false`". 0.20.6, 0.22.1 and 0.32.1 improved tool calling ([releases](https://github.com/ollama/ollama/releases)).
- **OpenAI-compatible `/v1/chat/completions`.** This works with `response_format`. The docs do not show the shape of the request. Use the native API: it needs no SDK, because Node 22 has `fetch`.
- **Our `Schema` type is already plain lowercase JSON Schema**, so we can send it as `format` as it is. `validate()` stays as it is. The constrained output guarantees JSON that parses; enums and required fields should hold. Small models can still fill a field with a weak value, and the existing template fallback covers that.
- **Alternatives:** llama.cpp `llama-server` (`--json-schema` or GBNF grammars, OpenAI-compatible) and LM Studio (`response_format` json_schema). Neither is needed, because Ollama is already installed.
- **Image input in Ollama:** yes, through the `images` array (base64) for all gemma4 tags.
- **Audio input in Ollama:** unconfirmed for NVIDIA. Ollama 0.33.3 (2 Sep 2026) says "gemma4 now supports images and audio **on MLX engine**", which is Apple. 0.40.4 mentions an MLX runner on NVIDIA. I found nothing official saying audio works through CUDA on Windows. **Keep voice decrees on Gemini.**
- **Image generation:** Gemma cannot generate images. Flags stay on Gemini.

## 4. The prize question

**DurHack 2026 MLH prize page** ([mlh.com/events/durhack-2026/prizes](https://www.mlh.com/events/durhack-2026/prizes), read 14 Nov 2026):

> "Best Use of Gemini API" ... "It's time to push the boundaries of what's possible with AI using Google Gemini."

- Its label still reads "Gemini Prize Category Q1 2025 - Q1 2026". The link is to `mlh.link/gemini`.
- No rules say which models qualify.
- **There is no Gemma category at DurHack.** The page lists only Gemini, ElevenLabs and Entire as AI-related prizes.

**MLH does run a separate "Best Use of Gemma 4" category at other events.** It appears in the MLH Hack Days partner module (last reviewed August 2026, [handbook](https://hacktoberfest-handbook.mlh.com/hack-days-partner-modules/partner-challenge-google-gemma.md)):

> "Gemma 4 packs multimodal intelligence into an open-weights model that you can access through the Gemini API."
>
> "Confirm that the winning project actually uses a Gemma model through the Gemini API."

What this means:

- **Local Gemma (Ollama) is not the Gemini API.** Even MLH's own Gemma category asks for Gemma *through the Gemini API*. So local-only Gemma would not support a "Best Use of Gemini API" claim. Judging is not documented, so this is my reading of MLH's wording, not a ruling.
- **Gemma through the Gemini API** (`gemma-4-26b-a4b-it`, `gemma-4-31b-it`, [Gemma on Gemini API docs](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api?hl=en)) *is* a Gemini API call. It is free on the free tier ("Free of charge", [pricing](https://aistudio.google.com/docs/pricing)); rate limits are not stated. Whether judges count "Gemma via the Gemini API" as "using Google Gemini" is **unclear**. The safe claim is still Gemini models doing the visible work.
- **A hybrid keeps the claim.** Voice decrees (audio in), world bible (image in), news broadcast, lore and flags (image out) all stay on Gemini. That is still "Gemini doing real work".
- **The pitch risk:** if we say "the rulers run on Gemma locally", the hot path that judges see most is no longer Gemini.

## 5. Recommended architecture and effort

**Option A: keep Gemini only (recommended for the live demo).** No work, no new risk. The 20 calls/min cap already shapes the game.

**Option B: hybrid behind `LLM_PROVIDER` (only if the owner wants the offline or privacy line).**

- `llmJson()` gains a branch. When `LLM_PROVIDER=ollama` and the purpose is `ruler` (optionally `chant`), it POSTs to `http://localhost:11434/api/chat` with this body:
  - `model: gemma4:e4b-it-qat`
  - `format: opts.schema`
  - `think: false`
  - `stream: false`
  - `keep_alive: -1`
  - `options: {temperature: 0.9, num_predict, num_ctx: 4096}`
  - `images`, if any
- It then parses `message.content`, runs `validate()`, and adds to the meter from `prompt_eval_count` and `eval_count`.
- Every other purpose stays on Gemini.
- On any Ollama error it falls back to Gemini, then to the template.
- No new dependency.
- From WSL, reach the Windows Ollama at `localhost:11434` (mirrored networking) or at the host IP with `OLLAMA_HOST=0.0.0.0` set on Windows. This is unverified on this laptop.

**Option C: Gemma through the Gemini API.** Set `GEMINI_MODEL_RULER=gemma-4-26b-a4b-it`. There are no code changes, and it is free. But three things are unverified: whether `responseSchema` works on Gemma ids, whether `thinkingLevel: MINIMAL` is accepted, and the rate limits. Test one call before relying on it. It lets the pitch say "Gemma 4" while staying on the Gemini API. It does not run offline.

| | Option B (local hybrid) | Option C (Gemma via API) |
| --- | --- | --- |
| Build effort | About 3 h: 1 h code, 0.5 h Ollama update and pull, 1-1.5 h testing with the globe and fps | About 0.5 h: env var and one test call |
| Ruler latency | About 3 s (E4B), estimated | Unknown (not measured) |
| Adds to pitch | "Rulers think on-device: offline, private, zero cost per turn" | "Gemma 4 and Gemini on one API" |
| Risks | fps drops on the shared GPU; VRAM spill; cold load; Ollama version; download size | Unknown schema support and rate limits |
| Gemini prize | Kept (decrees, bible, flags still Gemini) | Kept |

Notes:

- **Polish mode is ON.** A new provider path counts as a new sponsor integration, so it needs the owner's yes.
- **For a live table demo tomorrow, Option B is risky.** The globe is already at 40-60 fps, and adding CUDA work to the same GPU is the biggest unknown.
- **If we build B anyway:**
  - Default it to OFF.
  - Pull the model tonight.
  - Run a 5-minute soak with the globe open and watch the fps meter and `nvidia-smi`.
  - Only switch it on at the demo if fps holds above 40.

## Gaps and unverified points

- **No measured Gemma 4 speed for the RTX 5070 Ti Laptop.** All latency numbers are estimates.
- **The effect of LLM inference on three.js frame rate on one GPU** is unmeasured.
- **Gemma 4 audio input through Ollama on Windows/CUDA** is unconfirmed.
- **Gemma on the Gemini API:** structured-output (`responseSchema`) support and rate limits are unconfirmed.
- **Judging:**
  - The DurHack 2026 Devpost was not read; earlier attempts returned 403.
  - MLH publishes no rule on whether Gemma counts for the Gemini prize.
  - The prize page's date label ("Q1 2025 - Q1 2026") is out of date.
