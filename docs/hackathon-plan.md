# DurHack 2026 — Terra Nova

*Owner-edited. How the project works lives in `documentation.md`; what's next lives in `roadmap.md`.*

> **Status: kickoff, 14 Nov 2026, 14:30.** Idea chosen by the owner (idea 2, "Worldbuilders",
> in `prizes/matrix.md`). Software only, no hardware.

## 1. The idea

Type one line ("a drowned post-apocalyptic world") and watch a living 3D planet build itself.
Every nation on it is ruled by its own independent AI. The nations settle, build towns, form
ideologies, trade, betray each other and go to war, live, on a globe you can spin, zoom and
click. No central brain runs the world: cut a nation off, silence its ruler or delete it
altogether and the world keeps building; bring it back and its history merges in.

One sentence for judges: **a new world, composed live by AIs that keep working together when
they cannot talk to each other.**

## 2. The demo (2 minutes)

1. A judge gives a prompt. We pick six nations and press Create. A planet forms; six nations are
   named and placed, each with a leader, an ideology and a founding myth. (15 seconds)
2. Time runs at speed. Borders spread province by province, camps become villages become
   cities, low-poly buildings pop up, every nation flies its own flag. A chronicle ticker tells the story as it happens.
3. Zoom into a nation and click it. Its border lights up and a hologram rises from its capital
   showing its culture, politics and its history with its neighbours. A voice narrates it; its
   anthem plays, with words written from what has actually happened to it.
4. A war breaks out. Armies march, volleys fly, tiles change colour, and each side's war chant
   is heard. Switch the map to diplomacy mode to see who stands with whom.
5. **The moment:** open the network panel and cut the link to one nation in the middle of the
   war. It carries on building from what it last knew; a "what it believes" view shows its map
   drifting from the truth; its neighbours notice the silence. Delete a second nation outright:
   its neighbours carve it up. Restore the link: the missing years merge in, the border disputes
   are settled on screen, and the chronicle records "the Silence".
6. Close on the token meter ("this whole world cost N tokens") and the build history in Entire.

Backup plan if live fails: every run is an event log, so a saved run replays exactly, offline,
with no API calls (`row A9`). Narration and anthems for the saved world are cached on disk.

## 3. Prizes we're going for

| Prize | Why we qualify | What it needs from us | Lane / row | Submission field |
| --- | --- | --- | --- | --- |
| Main track (theme: Composition) | A world, its history and its music composed live from parts by several authors | Polish; a "what we learned" section | all / C5 | Main submission |
| Neptune North: Actors work better together | It is their "teams of AI agents" example: common goal, independent decisions, progress when cut off, merge on return | The cut, silence, delete and restore demo; a section headed with their four criteria | a / A4, A7; b / B6; c / C4 | Tick the challenge; show at their stand |
| Marshall Wace: New Worlds | Literally a new world nobody has seen | Open the pitch with "New Worlds"; visit their stand early | c / C5 | Tick the challenge |
| MLH Best Use of ElevenLabs | Narrated histories, an anthem written from each nation's history, and war chants when fighting starts | Voice is a core part, not a button | a / A14, A15, A16 | MLH prize tick |
| MLH Best Use of Gemini API | Gemini rules every nation and writes the lore | Name the models and the token budget | a / A5, A13 | MLH prize tick |
| MLH Best Use of Entire | Built with agents across three laptops with sessions recorded | Session push on; token numbers on a slide | owner / O2 | MLH prize tick |
| MLH Best Use of Tiger Data (stretch) | The event log is a time series | Hypertable and one live chart | a / A11 | MLH prize tick |
| Waterstons (weak fit) | Connects language models, a simulation, voice and music | One honest line | c / C5 | Tick the challenge |

Not targeted: Arduino/RS and P&G sensors (hardware), SGX FX, Accenture, P&G receipts, QRT.
Full research: `prizes/matrix.md`.

## 4. Architecture

```mermaid
flowchart LR
  subgraph WEB["Browser (Vite, React, three.js)"]
    GEN["Create screen (lane c)"]
    GLOBE["3D globe (lane b)"]
    PANELS["Nation card, chronicle, network controls (lane c)"]
    AUDIO["Sound: narration, anthem, war chants (lane a)"]
    STORE["World replica store (lane b)"]
  end
  subgraph SRV["Node server"]
    API["HTTP and WebSocket (lane a)"]
    BUS["Message bus with switchable links (lane a)"]
    AG1["Nation agent 1: own replica, rules, ruler"]
    AG2["Nation agent 2"]
    AGN["Nation agent N"]
    STORY["Lore, narration, anthem, chant routes (lane a)"]
  end
  SHARED["packages/shared: types, hex sphere, applyEvent, rules (lane a)"]
  GEM["Gemini API"]
  EL["ElevenLabs API"]
  GEN -->|X3 POST /api/world| API
  API -->|X2 events over /ws| STORE
  STORE --> GLOBE
  STORE --> PANELS
  PANELS -->|X2 control messages| API
  PANELS -->|X3 lore| STORY
  PANELS -->|X6| AUDIO
  AUDIO -->|X3 narration, anthem, chant| STORY
  API --- BUS
  BUS --- AG1 & AG2 & AGN
  AG1 & AG2 & AGN -->|ruler decisions| GEM
  STORY --> GEM
  STORY --> EL
  SHARED -.-> WEB
  SHARED -.-> SRV
```

**How the world works (read this before building anything).**

- **The world is an event log.** Nothing is changed in place; every change is an event
  (`tile_claimed`, `structure_built`, `unit_moved`, `battle`, `relation_changed`, `chronicle`
  and so on). `applyEvent(world, event)` in `packages/shared` is the only code that changes a
  world, and the server and the browser both use it. A saved log replays a run exactly.
- **Rules, not the LLM, move the world.** A deterministic simulation ticks once per half second
  (one tick is one year). Growth, claiming land, building, marching and battles are plain code.
  This is what makes it cheap, fast and able to run with no LLM at all.
- **Each nation is an independent agent.** It keeps its own copy of the world (its beliefs),
  decides only for itself, and publishes its events on a message bus. There is no world
  controller. A battle is settled by a pure function of both sides' strength and a seeded hash,
  so every agent computes the same result without a referee.
- **The ruler is an LLM, called rarely.** Every 30 to 45 seconds, or when something big happens,
  a nation sends Gemini a digest of under 400 tokens and gets back under 150 tokens of JSON: a
  focus (expand, develop, fortify, attack), changes of stance towards neighbours, and one
  sentence of proclamation for the chronicle. Between calls the rules carry out the focus.
- **Resilience is three switches per nation.**
  - *Cut link:* the agent keeps running but nothing gets in or out. It acts on stale beliefs and
    queues its events. On restore, both sides exchange what the other missed; clashing claims
    on a tile are settled by a deterministic rule and written into the chronicle as a dispute.
  - *Silence ruler:* no LLM calls. The nation runs on autopilot (its last focus, then a simple
    policy from its temperament). Hitting the token budget triggers the same path.
  - *Delete:* the agent is removed. Neighbours stop hearing its heartbeat, treat its land as
    unclaimed ruins and carve it up.
- **The browser is an observer.** It holds a replica fed by events, renders it, and sends
  control messages. It can also show one nation's beliefs instead of the truth.

**Token budget (Gemini).** Six to eight nations at two ruler calls a minute plus one chronicle
call is about 17 requests and 9,000 tokens a minute, inside the free tier's listed 200 requests
and 50,000 tokens a minute; the daily cap of 10,000 requests is about nine hours of running.
So: `LLM_MODE=mock` is the default for all development and tests, live mode is for demos, a
meter shows calls and tokens, and a hard cap drops every nation to autopilot. Lore is generated
only when a nation is first clicked, and cached. If the free tier turns out tighter than listed
(row A5 checks), the owner has agreed to pay a small amount: a flash-lite model at this volume
is well under five pounds for the weekend.

**Sound (ElevenLabs).** Three kinds, all generated on first need and cached on disk by content
hash. *Narration:* a voice chosen from the nation's `voiceStyle` reads its lore. *Anthem:*
Gemini writes four to eight lines of lyrics from the nation's founding myth and its real
chronicle (its wars, losses and allies), and the music model sings them in the nation's style,
so no two anthems are alike and each one is tied to that nation's history. *War chants:* one
short chant per nation, played automatically when it declares war or fights a battle. The demo
world's audio is generated once and kept.

**Look and feel.** The style is an old atlas: parchment panels, serif type, ink borders, the
planet as a painted political map. The interface is designed in Figma by the owner (contract
X7) and built by lane c from that design. Selecting a nation projects its card above its
capital in a beam of light (the hologram), styled as a lit parchment page to match. From grand-strategy map games such as Age of History we
take the genre's conventions, not its art: the planet is a political map first, with map modes
(political, terrain, diplomacy relative to the selected nation, army strength), army strength
numbers on the map, wars fought tile by tile, peace treaties that hand over land, and a
timeline you can drag back through (stretch, row B9).

- **Stack:** TypeScript everywhere. Node 22, npm workspaces. `packages/shared` (types, hex
  sphere via `hexasphere.js`, `applyEvent`, rules), `server` (Express, `ws`, `@google/genai`),
  `web` (Vite, React, three.js with `@react-three/fiber` and `drei`, `zustand`).
- **Run:** `npm install`, then `npm run dev` (server on 8787, web on 5173). `npm run mock` runs
  the server with a scripted world and no API calls.
- **Hosting for the demo:** the owner's laptop only. It runs and is shown on one device; the
  nations are cut off with software switches (the multi-laptop idea, row A10, is cut).
- **External services:** Gemini (`GEMINI_API_KEY`), ElevenLabs (`ELEVENLABS_API_KEY`), optional
  Tiger Data (`TIGER_DATABASE_URL`).
- **Assets and design:** low-poly GLB models made with headless Blender (row A8) and the
  interface design in Figma (row A12), both on the owner's laptop, which has those tools.

**The map.** The land is about 500 irregular provinces on a globe (a spherical Voronoi diagram),
not hexagons, so it reads as a political map. Provinces are grouped into fixed regions. A
nation names each region when it first settles it, and every region has a flag and a main
town. A region whose unrest climbs (far from the capital, recently conquered, at odds with the
ruler's ideology) can break away and become a new nation with its own AI ruler: a new actor
joining the world mid-run.

**Flags.** Gemini gives every nation and region a flag as a small specification (layout, two to
four colours, an emblem). It is drawn at once as a crisp vector flag, for free, and works in
mock mode. Clicking a nation asks for an AI-painted version in the background, which replaces
the drawn one when it arrives (paid, capped per world).

**Pacing.** At normal speed a world goes from first settlements to empires at war in about
three minutes, so a judge sees the whole arc in one visit. Speed and pause are on the top bar.

**The viewer** watches, clicks, issues decrees and uses the network switches. They do not
command a nation.

**Money.** The owner will spend up to 25 pounds over the weekend on Gemini and ElevenLabs.
Caps in the code (`LLM_MAX_TOKENS_PER_RUN`, `IMAGE_MAX_PER_RUN`) and mock mode by default keep
it well under that.

**Inputs.** The Create screen takes: a text prompt (required), preset chips (post-apocalyptic,
bronze age, floating archipelago, ice world, and so on), number of nations (3 to 10), an era
dropdown, sea level, and an aggression slider. While the world runs, a "decree" box lets the
judge drop an event on it (a plague, a meteor, a prophet). Stretch: an image as input, read by
Gemini for mood and palette (row A17).

## 5. Lanes

| Lane | Person | Owns (paths) | Delivers |
| --- | --- | --- | --- |
| a · World, story and sound | @SamsSide | `packages/shared/`, `server/`, `assets/`, `web/public/models/`, `web/src/audio/`, `web/src/theme/`, `docs/design/`, root config | Everything behind the screen: the world, the agents, Gemini, war, resilience, lore, narration, anthems, war chants, replays; plus the Blender models and the Figma design |
| b · The globe | @CutGrass88 | `web/` except `web/src/ui/`, `web/src/audio/`, `web/src/theme/` and `web/public/models/` | The 3D planet, camera, borders, map modes, buildings, war animation, status visuals, the hologram, performance |
| c · Interface | @Justin-CODING-PY | `web/src/ui/` | Four screens built from the owner's design against the mock (Create screen, nation card, chronicle, network panel) and the submission |

The split follows each person's agent budget: lane a has by far the most (18 live rows), lane b
a middling amount (9 rows), lane c the least (5 small rows, none of them touching the server).

## 6. Schedule

Everyone stays up overnight. After the seed, no lane waits on another: see `roadmap.md`.

Hacking ends Sunday 12:00 (confirmed by the owner).

| Time | Checkpoint | Means |
| --- | --- | --- |
| 30 minutes after the go | CP0 | The seed (A1) on `main`; every lane building against the mock, nobody waiting |
| Sat 21:00 | CP1 | First end-to-end on `main`: a prompt makes a world, nations grow live on the globe, a click opens a panel |
| Sun 02:00 | CP1.5 | Wars animate; cut, silence, delete and restore work; real lore, narration and anthem |
| Sun 08:00 | CP2 | Feature freeze: fixes, polish, the saved demo world, docs |
| Sun 10:30 | CP3 | Demo rehearsed three times, submitted |
| Sun 12:00 onwards | Judging | Table demo; sponsor stands |

## 7. Risks and cuts

| Risk | If it happens |
| --- | --- |
| The globe is slow with 500 provinces, buildings and units | Instanced meshes from the start; fewer provinces; buildings only when zoomed in |
| Irregular provinces take longer than hexagons | Every province is convex (triangle fan), buildings sit at the province centre, armies move centre to centre; if the Voronoi step fails by Sat 18:00, fall back to hexagons behind the same `Tile` type |
| Secession makes the simulation unstable | Limit it to one breakaway at a time and a cooldown; cut it and keep regions as names and flags |
| Reconciliation after a cut is buggy | Keep cut simple: queue and replay with last-writer-wins on tiles; the dispute story is a stretch |
| Gemini rate limits or bad JSON | Autopilot on any failure (same path as silence); JSON schema output; mock mode |
| ElevenLabs credits or music access | Cache everything; narration first, anthem second; anthem falls back to a short generated tone piece |
| An AI world generator looks generic, others build one too | The resilience demo and the live wars are the difference; rehearse step 5 most |
| Blender assets take too long | Kenney-style CC0 packs or coloured primitive shapes; the manifest (X4) stays the same |

Cut order if behind: image input (A17), Tiger Data (A11), painted flags, the timeline
scrubber (B9), secession (regions stay as names and flags), army strength and terrain map modes, beliefs view, war chants, anthem, decree
box, fleets, atmosphere polish. Never cut: prompt to world, live growth, the click
hologram with voice, one war, cut and restore.
