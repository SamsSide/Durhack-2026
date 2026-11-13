# P1 - Best Use of ElevenLabs (MLH)

Researched 13 Nov 2026 with WebSearch/WebFetch only. Devpost pages for DurHack, LIHacks and HackAI returned 403, so anything about the DurHack Devpost page is unconfirmed.

## 1. What they want

- Prize: wireless earbuds (some events list AirPods; per winning team member). Source: [MLH prizes page](https://www.mlh.com/events/prizes) (label "ElevenLabs Q4 2025 - Q4 2026", so it is active for DurHack).
- MLH brief: "Deploy natural, human-sounding audio with ElevenLabs." Landing link https://mlh.link/elevenlabs (the link redirects to the ElevenLabs docs intro).
- Devpost wording used at other MLH events: "The project uses ElevenLabs voice or audio as a meaningful part of the experience" ([UB Hacking 2026](https://ubhacking2026.devpost.com/), via search snippet). Takeaway: voice must be core to the demo, not a bolt-on read-aloud button.
- What lights up a judge: the demo is spoken, the voice is emotional and fits a character, and the user talks back (agent), or the audio is the product (narration, soundscape). Dead-simple TTS of a text box reads as minimal effort.
- Who judges: MLH's own pages do not say how partner prizes are judged. The [MLH judging guide](https://guide.mlh.com/general-information/judging-and-submissions.md) only covers the organiser's main judging. Assume MLH staff or the on-site MLH rep pick from the Devpost submission and a short demo. Unconfirmed.

## 2. Tech as of Nov 2026

Source: [ElevenLabs models](https://elevenlabs.io/docs/overview/models), [quickstart](https://elevenlabs.io/docs/quickstart), [agents quickstart](https://elevenlabs.io/docs/eleven-agents/quickstart), [API pricing](https://elevenlabs.io/pricing/api).

| Capability | Current model ids |
| --- | --- |
| Text to speech | `eleven_v4` (most emotive, 90+ langs), `eleven_v4_turbo` (~100ms), `eleven_v3`, `eleven_v3_conversational` (~165ms), `eleven_flash_v2_5` (~100ms), `eleven_multilingual_v2` |
| Voice design (text to voice) | `eleven_ttv_v3` |
| Speech to speech | `eleven_multilingual_sts_v2` |
| Speech to text | `scribe_v3`, `scribe_v3_live` (realtime), `scribe_v2_realtime` (~150ms) |
| Voice agents ("Eleven Realtime") | `eleven_realtime_v1_mini` (fast), `eleven_realtime_v1_max` (multi-step) |
| Music | `music_v2_5` (v1 removed 31 Jan 2027) |
| Sound effects | `eleven_text_to_sound_v3` (v2 removed 1 Mar 2027) |

- Agents platform (called ElevenAgents): agent = first message + system prompt + knowledge base + voice + tools. Build via dashboard, API, CLI, or the hosted MCP server. Embed with a widget snippet. Fastest start: `npx -y @elevenlabs/cli@latest onboard init` (signs in via browser, saves key to env file). A coding-agent skill exists: `npx skills add elevenlabs/skills --skill agents`.
- MCP: hosted MCP server lets Claude and other MCP clients create agents.
- Voice cloning: exists on the platform; plan limits not checked. Unconfirmed.
- Auth: API key from dashboard, env var `ELEVENLABS_API_KEY`, header `xi-api-key`.
- Install: Python `pip install elevenlabs python-dotenv`; JS `npm install @elevenlabs/elevenlabs-js dotenv`. Playback may need MPV or ffmpeg.

Python hello world (from the quickstart):

```python
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from elevenlabs.play import play
import os
load_dotenv()
client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
audio = client.text_to_speech.convert(
    text="The first move is what sets everything in motion.",
    voice_id="JBFqnCBsd6RMkjVDRZzb",
    model_id="eleven_v4",
    output_format="mp3_44100_128",
)
play(audio)
```

JS hello world:

```typescript
import { ElevenLabsClient, play } from "@elevenlabs/elevenlabs-js";
import "dotenv/config";
const client = new ElevenLabsClient();
const audio = await client.textToSpeech.convert("JBFqnCBsd6RMkjVDRZzb", {
  text: "The first move is what sets everything in motion.",
  modelId: "eleven_v4",
  outputFormat: "mp3_44100_128",
});
await play(audio);
```

Free tier and promo:
- MLH offer: free 1-month Creator subscription. How: register for an MLH event at mlh.io/events; MLH emails the code the week of the event; the email link goes to ElevenLabs signup. Source: [MLH ElevenLabs partner page](https://www.mlh.com/partners/elevenlabs). Credit amount not stated by MLH. (The brief says the code is also claimed on the mlh.com event prizes page; the prizes page shows a "Claim promo code" button but not the code.)
- Standard Creator is $22/month, $11 first month, 275,000 characters of v4 TTS (about 275 minutes). Source: pricing page. Free-plan credit amount: not shown on the page (unconfirmed). A 2026 dev.to post reports free-tier voice and model restrictions ([Rivalry Roast](https://dev.to/jyotish08/rivalry-roast-you-talk-smack-about-your-team-or-favorite-player-out-loud-and-an-ai-rival-mc5)), so do not plan on the free plan.
- Concurrency: realtime tiers 4 to 40 concurrent calls; plan mapping unconfirmed. Agents minutes are billed separately (about $0.08 per extra minute on the first Speech Engine tier). Watch credit burn when several people test one agent.
- Time to first working call: about 10 minutes once the key exists.
- Gotchas: music commercial use needs Starter+ plans; deprecated models are removed early 2027 (not a hackathon issue); browsers block autoplay until a user click; one account shared by the team means one credit pool.

## 3. Past winners

Direct Devpost "Winner" project pages for this prize could not be retrieved (search returned only prize listings). Confirmed prize listings: TAMUhack 2026, Technica 2025, Hack the Valley X, HackHarvard 2025, UofTHacks 13, DivHacks 2026, UB Hacking 2026, HackSMU VII (all via [search of Devpost](https://th26.devpost.com/), "[MLH] Best Use of ElevenLabs, 1 winner, wireless earbuds"). Winners named elsewhere:

| Project | Event | What / why | Source |
| --- | --- | --- | --- |
| Junction | Penn AI Hackathon, 12 Apr 2026 (ElevenLabs "Best use of ElevenLabs") | Voice handoff after an AI health chatbot decides a patient needs a clinician; routes to the right provider with context. Won for solving a real gap with voice at the centre. | [ElevenLabs blog](https://elevenlabs.io/blog/how-hackathon-teams-are-using-elevenlabs-to-make-care-more-accessible) |
| Maya | AI Tinkerers NYC (ElevenLabs hackathon) | Listed as a Best Use of ElevenLabs winner; details not read. | [entry](https://nyc.aitinkerers.org/hackathons/h_HC6A20KVNpQ/entries/ht_8DKcVq8468w) |
| GibberLink | ElevenLabs London hackathon (global winner) | Two AIs detect each other and switch to a data-over-sound protocol. Shows a gimmick that is memorable on stage. | [ElevenLabs blog](https://elevenlabs.io/blog/announcing-the-winners-of-the-elevenlabs-worldwide-hackathon) |
| Rivalry Roast | DEV Weekend Challenge (entered, win not confirmed) | Speech to Groq to Gemini roast to ElevenLabs voice. Shows the cheap pipeline pattern. | dev.to link above |

No DurHack 2025 winner found. UK MLH winners not found.

## 4. Judging and demo format

- Criteria seen on other events: voice is a meaningful part of the experience (UB Hacking 2026). No official MLH rubric found.
- Demo: live, with sound. Bring a speaker and a backup recording. Show the audio in the first 15 seconds.
- Submission: name ElevenLabs in the Devpost "built with" tags and write one paragraph on which features (agent, voice design, SFX, STT) you used.

## 5. Effort and risk (24h)

- Minimum to qualify: 1 to 2 hours (TTS reading real app output). Weak odds on its own.
- To compete: 4 to 8 hours (a conversational agent with tools, custom or designed voice, SFX/music, interruptions handled well).
- Risks: free-tier restrictions; credits run out in testing; venue noise ruins the live demo; latency with chained STT, LLM, TTS (use the agent platform instead); promo code email timing (code is sent the week of the event, check spam).

## 6. Stackability

| Other prize | Fit |
| --- | --- |
| Gemini API | Strong. Gemini reasons or writes, ElevenLabs speaks. Standard pairing (see Rivalry Roast). |
| Entire | Free: build with Entire's git forge and agents; independent of the app. |
| Solana | Possible: voice-driven wallet or payment confirmations. Often contrived; only if the idea is crypto anyway. |
| Tiger Data | Good: store conversation transcripts and time-series audio metrics in Postgres/Timescale. |
| Vultr | Good: host the backend or a self-hosted component there. |
| MongoDB Atlas | Good: store agent memory and sessions. |
| DEV writing challenge | Free add-on: write up the build. |

## 7. Scores (1-5, 5 is best / cheapest)

- Fit for any idea: 4 (almost any app can have a voice, but it must be central).
- Win chance: 3 (one winner per event, many entrants use it; a strong agent demo helps).
- Value: 3 (earbuds, per team member).
- Effort: 4 (hello world in minutes).

## 8. Do this tonight

- Register for DurHack on mlh.io if not done and log in at mlh.com event prizes to claim the ElevenLabs promo code. If no code appears, watch email (including spam) for MLH's mail. Each teammate who wants a seat/credits may claim their own.
- Create one ElevenLabs account at the signup link from MLH, apply the code, create an API key, and share it via the team secrets, not git.
- Run the hello world once to confirm the Creator plan unlocked `eleven_v4`.
- Try the agent quickstart (`npx -y @elevenlabs/cli@latest onboard init`) and pick a voice.
- No approval waits known. Promo code timing is the only delay.
