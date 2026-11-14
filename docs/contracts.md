# Contracts

*Every interface one lane gives another. Owner-edited (changes go through a `needs-owner`
issue naming every lane affected). Code against these exactly; mock them until CP1.*

Contracts are numbered X1 to X7 (not C, so they are not confused with lane c's rows).
The TypeScript in `packages/shared/src/` is the source of truth once row A1 is merged; if this
file and the code disagree, the code wins and the owner fixes this file.

## Shared files

| File | Owning lane | Others |
| --- | --- | --- |
| root `package.json`, `package-lock.json`, `tsconfig.base.json` | a | new dependency: `needs-owner` issue |
| `packages/shared/**` | a | ask lane a via `agent-request` |
| `server/**` (engine, agents, and the story routes in `server/src/story/`) | a | ask lane a via `agent-request` |
| `web/package.json`, `web/vite.config.ts`, `web/src/main.tsx`, `web/src/App.tsx` | b | lane c exports components from `web/src/ui/index.ts`; lane b places them in `App.tsx` and in the hologram (X5) |
| `web/src/audio/**` (X6), `web/src/theme/**` and `docs/design/**` (X7) | a | lanes b and c read them |
| `web/src/state/**` (the store, X5) | b | lane c reads it; changes via `agent-request` |
| `web/public/models/**` (X4) | a | lane b reads it |
| `.env.example`, `check.sh`, `CLAUDE.md` | owner | `needs-owner` |

## Environment variables

Real values go in `.env` at the repo root (git-ignored). The owner's keys file is
`~/.config/durhack/keys.env`; teammates get the values from the owner in person, never in chat.

| Name | Used by | What |
| --- | --- | --- |
| `GEMINI_API_KEY` | lane a | Gemini API key |
| `ELEVENLABS_API_KEY` | lane a | ElevenLabs key |
| `ELEVEN_MODEL` | lane a | ElevenLabs text-to-speech model, default `eleven_multilingual_v2` |
| `ELEVEN_MAX_CHARS_PER_RUN` | lane a | Default 20000; 30000 on the Starter plan (about 40k characters a month). Above it, narration and chants return 503 |
| `ELEVEN_CHANT_MODEL` | lane a | War chant voice model, default `eleven_v3` (uses the `[shouting]` audio tag) |
| `TEAM_VOICES` | lane a | Optional `Name:voiceId,...`; default the team's cloned voices Sam, Justin and Denis (news anchors in turn, three nations' narration and chants, the decree herald) |
| `ELEVEN_MUSIC_MODEL` | lane a | Anthem music model, default `music_v1` (composition plan with sung lyrics) |
| `ANTHEM_MAX_PER_RUN` | lane a | Default 8. Anthems generated per world; above it the anthem route returns 503 |
| `BROADCAST_MAX_PER_RUN` | lane a | Default 12. News bulletins written by Gemini per world; above it, template bulletins and no audio |
| `LLM_MODE` | lane a | `mock` (default: canned answers, no API calls) or `live` |
| `GEMINI_MODEL_RULER` | lane a | Model id for ruler decisions: `gemini-3.5-flash-lite` |
| `GEMINI_MODEL_LORE` | lane a | Model id for lore: `gemini-3.5-flash` |
| `GEMINI_MODEL_BIBLE` | lane a | Model id for the world bible at creation: `gemini-3.5-flash-lite` (about 5 s; flash takes about 28 s) |
| `GEMINI_MODEL_BIBLE_IMAGE` | lane a | Optional model for the bible when a picture is given; default the bible model (flash-lite reads images in about 7 s, flash takes about 23 s) |
| `GEMINI_MODEL_VOICE` | lane a | Optional model for spoken decrees; default the ruler model (flash-lite hears a clip in about 1.3 s) |
| `LLM_MAX_CALLS_PER_MIN` | lane a | Default 20. Above it, nations fall to autopilot |
| `LLM_MAX_TOKENS_PER_RUN` | lane a | Default 400000. Above it, every nation is on autopilot |
| `GEMINI_MODEL_IMAGE` | lane a | Image model id for painted flags; empty turns painted flags off |
| `IMAGE_MAX_PER_RUN` | lane a | Default 12. Painted flags per world |
| `PORT` | lane a | Server port, default 8787 |
| `TIGER_DATABASE_URL` | lane a | Optional, row A11 |
| `SOLANA_MODE` | lane a | `off`, `mock` (default: fake signatures, no network) or `devnet` (row A27) |
| `SOLANA_RPC_URL` | lane a | Default `https://api.devnet.solana.com` |
| `SOLANA_WS_URL` | lane a | Accepted but unused: confirmation is HTTP polling |
| `SOLANA_KEYS_DIR` | lane a | Keypair JSON files, default `~/.config/durhack/solana`; never in the repo |
| `SOLANA_SETTLE_MS` | lane a | Settlement window, default 5000 |
| `SOLANA_MAX_TX_PER_WINDOW` | lane a | Default 4, sent one at a time; overflow nets into the next window |
| `SOLANA_FLOAT` | lane a | Coins each nation gets from the Commons at genesis, default 10000 |

## X1 · World types and `applyEvent` (lane a gives to lanes b and c)

- **Kind:** TypeScript package `@terra/shared`, imported by `server` and `web`.
- **Signature:**

```ts
export type Vec3 = [number, number, number];            // on the unit sphere, y is up
export type Terrain = 'ocean' | 'coast' | 'plains' | 'forest' | 'desert' | 'hills' | 'mountain' | 'ice';

export interface Tile {                                  // one province; static after generation
  id: number;                                            // index into World.tiles
  center: Vec3;
  boundary: Vec3[];                                      // an irregular convex polygon: 3 or more corners, in order, counter-clockwise seen from outside
  region: number;                                        // index into World.regions, -1 for ocean
  neighbors: number[];                                   // tile ids
  terrain: Terrain;
  elevation: number;                                     // 0 to 1
}

export type FlagLayout = 'plain' | 'horizontal2' | 'horizontal3' | 'vertical2' | 'vertical3'
  | 'cross' | 'saltire' | 'canton' | 'diagonal' | 'border';
export type FlagEmblem = 'none' | 'star' | 'sun' | 'moon' | 'tree' | 'tower' | 'wave' | 'mountain'
  | 'sword' | 'gear' | 'eye' | 'crown' | 'anchor' | 'flame' | 'wheat' | 'skull';
export interface FlagSpec { layout: FlagLayout; colors: string[]; emblem: FlagEmblem; emblemColor: string } // 2 to 4 colours

export interface Region {                                // a fixed group of neighbouring provinces
  id: number;                                            // index into World.regions
  name: string;                                          // '' until first settled, then named in its owner's culture
  tiles: number[];
  capitalTile: number;
  flag: FlagSpec;
  unrest: number;                                        // 0 to 1; high unrest can end in secession
}

export type BuildingStyle = 'medieval' | 'classical' | 'desert' | 'east_asian' | 'mesoamerican' | 'scrap'
  | 'norse' | 'south_asian' | 'sahel' | 'industrial'
  | 'soviet_bloc' | 'western_modern' | 'egyptian' | 'highland' | 'arcology';

export interface Country {
  id: number;                                            // index into World.countries; new nations are appended
  flag: FlagSpec;
  parent: number | null;                                 // the nation it broke away from, if any
  name: string;                                          // "The Ashen Concord"
  adjective: string;                                     // "Ashen"
  color: string;                                         // "#c8553d"
  capitalTile: number;
  leader: string;
  government: string;                                    // "merchant republic"
  ideology: string;                                      // one sentence
  culture: string[];                                     // 3 to 5 short traits
  foundingMyth: string;                                  // one or two sentences
  temperament: { aggression: number; expansion: number; trade: number; faith: number }; // each 0 to 1
  anthemPrompt: string;                                  // for the music model
  buildingStyle?: BuildingStyle;                         // its architecture (X4 styles); missing means 'medieval'
  nomadic?: boolean;                                     // herders and horse lords: camps as yurts
  techAge?: TechAge;                                     // its weapons and ships; advances over time (missing means 'ancient')
  voiceStyle: string;                                    // for narration voice choice
  alive: boolean;
  population: number;
  treasury: number;
  council?: Council;                                     // row A29; missing on old replays
}

// Council (row A29, owner decision on #146: ruler and general only).
export type CouncilRole = 'ruler' | 'general';
export interface CouncilMember { name: string; portraitSeed: number; since: number; memory: string } // since = tick; memory = rolling 5-line summary handed to a successor
export type CouncilState = 'active' | 'covering' | 'vacant' | 'cut';
export interface Council {
  ruler: CouncilMember | null; general: CouncilMember | null;
  state: Record<CouncilRole, CouncilState>;
}

export type StructureKind = 'camp' | 'village' | 'town' | 'city' | 'capital'
  | 'farm' | 'port' | 'fort' | 'temple' | 'factory' | 'ruin' | 'wonder';
export interface Structure {
  id: string; tile: number; owner: number; kind: StructureKind; builtTick: number;
  wonder?: WonderKind; name?: string; complete?: boolean;   // only when kind is 'wonder' (row A30); complete false while it is being built
}
export type WonderKind = 'great_wall' | 'mausoleum' | 'pyramid' | 'colossus' | 'cathedral'
  | 'palace_of_soviets' | 'skyscraper' | 'space_elevator';

export type UnitKind = 'army' | 'fleet' | 'settler' | 'trader';   // trader: a merchant ship crossing the ocean between trading nations
export type TechAge = 'ancient' | 'medieval' | 'gunpowder' | 'industrial' | 'modern' | 'future' | 'stellar';
export interface Unit { id: string; owner: number; kind: UnitKind; tile: number; strength: number; target?: number }

export type Stance = 'war' | 'hostile' | 'neutral' | 'trade' | 'alliance';
export interface Relation { a: number; b: number; stance: Stance; since: number; grievance: number } // a < b

export type ChronicleKind = 'founding' | 'proclamation' | 'growth' | 'war' | 'battle' | 'peace'
  | 'alliance' | 'betrayal' | 'fall' | 'silence' | 'return' | 'dispute' | 'decree' | 'secession'
  | 'death' | 'succession' | 'wonder';
export interface ChronicleEntry { id: string; tick: number; year: number; kind: ChronicleKind; countries: number[]; text: string }

export interface AgentStatus {
  countryId: number;
  link: 'up' | 'cut';
  ruler: 'llm' | 'autopilot';
  deleted: boolean;
  lastHeardTick: number;                                 // last tick the others heard from it
  pendingEvents: number;                                 // queued while cut
}

export interface World {
  id: string; seed: number; prompt: string; name: string; era: string;
  tick: number; year: number; speed: number; paused: boolean;
  tiles: Tile[];
  regions: Region[];
  owner: number[];                                       // tile id to country id, -1 is unclaimed
  countries: Country[];
  structures: Structure[];
  units: Unit[];
  relations: Relation[];
  chronicle: ChronicleEntry[];                           // oldest first
  agents: AgentStatus[];
}

type Base = { id: string; tick: number; actor: number | 'world' | 'decree'; lamport: number };
export type WorldEvent = Base & (
  | { type: 'tick'; year: number }
  | { type: 'tile_claimed'; tile: number; owner: number; from: number; cause: 'expand' | 'conquest' | 'dispute' | 'collapse' }
  | { type: 'structure_built'; structure: Structure }
  | { type: 'structure_upgraded'; structureId: string; kind: StructureKind }
  | { type: 'structure_destroyed'; structureId: string }
  | { type: 'unit_spawned'; unit: Unit }
  | { type: 'unit_moved'; unitId: string; from: number; to: number; arriveTick: number }
  | { type: 'unit_removed'; unitId: string; reason: 'battle' | 'disband' | 'collapse' }
  | { type: 'unit_attrition'; unitId: string; loss: number; terrain: Terrain }   // strength lost to hunger, cold and thirst in hostile land; applyEvent subtracts loss
  | { type: 'payment'; from: number; to: number; amount: number; reason: PaymentReason; note: string }  // row A27; see below
  | { type: 'council_changed'; countryId: number; role: CouncilRole; member: CouncilMember | null; cause: 'founded' | 'death' | 'assassination' | 'disconnect' | 'succession' | 'coup' | 'restored' }
  | { type: 'council_status'; countryId: number; role: CouncilRole; state: CouncilState }
  | { type: 'wonder_started'; countryId: number; structureId: string; tile: number; wonder: WonderKind; name: string }
  | { type: 'wonder_built'; countryId: number; structureId: string }
  | { type: 'battle'; tile: number; attacker: number; defender: number; attackerUnit: string; winner: number; losses: { attacker: number; defender: number } }
  | { type: 'relation_changed'; a: number; b: number; stance: Stance; reason: string }
  | { type: 'country_updated'; countryId: number; patch: Partial<Country> }
  | { type: 'country_fell'; countryId: number; conqueror?: number }
  | { type: 'country_founded'; country: Country; regionId?: number }    // a secession, or a nation created later; its tiles follow as tile_claimed
  | { type: 'region_updated'; regionId: number; patch: Partial<Pick<Region, 'name' | 'flag' | 'unrest'>> }
  | { type: 'chronicle'; entry: ChronicleEntry }
);

export function applyEvent(world: World, event: WorldEvent): void;   // mutates; the only way a World changes
export function countryTiles(world: World, countryId: number): number[];
export function borderEdges(world: World, countryId: number): [Vec3, Vec3][]; // edges between this country and anything else
export function relationOf(world: World, a: number, b: number): Relation;
export function regionOwner(world: World, regionId: number): number;   // the owner of its capital tile
export function flagSvg(spec: FlagSpec, width?: number, height?: number): string; // a complete <svg> string, default 90 x 60

// Terrain effects (owner decision on #135): the one table the sim, the rulers and the globe all read.
export type TerrainEffect = {
  defence: number;     // defender strength x (1 + defence); a fort multiplies on top
  supply: number;      // 0..1; an army's upkeep on this tile is divided by supply
  attrition: number;   // share of strength an army loses per year on this tile when it is outside its own land
  move: number;        // years a land unit takes to enter this tile (arriveTick = tick + move)
  income: number;      // treasury per year per owned province (was TILE_INCOME)
  pop: number;         // population cap per owned province (was TILE_POP)
  yields: string[];    // display labels, e.g. ['stone', 'forts']
};
export const TERRAIN_EFFECTS: Record<Terrain, TerrainEffect>;
export const LANDING_PENALTY: number;  // 0.2: an army attacking from the sea fights at (1 - 0.2)

// Payments (row A27, owner decision 14 Nov 19:20; design in docs/research/solana-economy.md).
export type PaymentReason = 'trade' | 'reparations' | 'plunder' | 'seizure' | 'war_chest' | 'subsidy' | 'pooled';
```

- **`payment`:** `from` and `to` are country ids; `amount` in coins with 2 decimals; `note` is a
  short phrase for the ledger ("Treaty of Hatfield", "the sack of Elvet"). `applyEvent` moves
  `amount` from `countries[from].treasury` to `countries[to].treasury`, clamped at the payer's
  balance. The actor is the payer, except `plunder`, which is derived in `settleMove` with the
  attacker as actor. Payments in a tick are applied after income and spending, so a treasury
  never goes negative mid-tick. `trade`: dues every 10 years per trade pact; `reparations`: in a
  peace treaty; `plunder`: a sacked city; `seizure`: a captured capital's treasury; `war_chest`:
  an ally paying into a war; `subsidy`: a strong nation paying a weak friend; `pooled`: nations
  that join forces and move together pay into one leader's fund.

- **Council (row A29):** every nation has a ruler and a general, each its own agent. The ruler
  sets focus and stance (today's ruler, the only one calling Gemini every turn); the general picks
  war targets and moves armies (rules, plus a Gemini call only for declaring or ending a war).
  A general can fall when an army he leads loses a big battle, either member can be assassinated
  (rare, more likely in war), a decree or the `kill` control can kill one, and `cut_member` cuts
  one off. Then the other **covers** (`council_status` `covering`; armies fight at 0.85 while the
  ruler covers the general; the general holds the course while covering the ruler). After 8 ticks
  a **successor** is named (`council_changed` cause `succession`) and inherits the predecessor's
  `memory`; a ruler's successor follows the government (heir, election or coup). `council_changed`
  for the ruler also sets `Country.leader`. Chronicle kinds `death` and `succession` tell it
  ("General Varo fell at Ashford; Captain Ilse takes command with his last orders.").
  `mockEvents()` emits one death, one cover and one succession.
- **Wonders (row A30, owner decision on #147):** a nation with a surplus treasury and no war
  starts at most one wonder at a time, about 2 to 4 per world. `wonder_started` adds a `wonder`
  structure with `complete: false`; `wonder_built` (about 40 ticks later) sets `complete: true`.
  Kind by style: `great_wall` (east_asian, highland), `mausoleum` (south_asian, desert, sahel),
  `pyramid` (egyptian, mesoamerican), `colossus` (classical; on a coast tile), `cathedral`
  (medieval, norse), `palace_of_soviets` (soviet_bloc), `skyscraper` (western_modern, industrial,
  scrap), `space_elevator` (arcology, or any nation in the future or stellar age). The name is
  written in the nation's voice (Gemini in live mode, templates in mock). A finished wonder gives
  a small bonus from `WONDER_BONUS: Record<WonderKind, { income: number; defence: number; unrest: number }>`
  in `@terra/shared` (income share, defence share for the whole nation, unrest change per year);
  lane b shows it in the tooltip. A captured wonder changes hands; a razed one is a `ruin`.

| Terrain | defence | supply | attrition | move | yields |
| --- | --- | --- | --- | --- | --- |
| ocean | 0 | 1 | 0 | 1 | fish, trade |
| coast | 0 (landings -20%) | 1 | 0 | 1 | trade, ports |
| plains | 0 | 1 | 0 | 1 | food, growth |
| forest | 0.25 | 0.8 | 0 | 2 | wood |
| hills | 0.4 | 0.7 | 0.01 | 2 | stone, forts |
| mountain | 0.75 | 0.5 | 0.03 | 3 | ore, mines |
| desert | 0.1 | 0.5 | 0.04 | 2 | gold, salt |
| ice | 0.2 | 0.4 | 0.05 | 3 | almost nothing |

Income and pop keep today's values (coast 0.9/900, plains 0.9/900, forest 0.55/500, hills
0.6/500, desert 0.25/250, mountain 0.35/150, ice 0.1/80, ocean 0/0). Fleets ignore move,
supply and attrition. Lane b's terrain map mode, legend, tooltip and battle defence badge read
this table from `@terra/shared`.

- **Provinces, not hexagons.** The land is irregular provinces (a spherical Voronoi diagram of
  jittered points, about 500 cells). Every cell is convex, so it can be drawn as a triangle fan
  from its centre. The name `Tile` is kept in the code; read it as "province".
- **Mock:** `packages/shared/src/mock.ts` exports `mockWorld(): World` (about 300 provinces,
  regions, 5 countries with flags) and `mockEvents(world): Generator<WorldEvent>` (growth, one
  war, one secession, one fall).
- **Real by:** CP0 for the types and mock (row A1); CP1 for real generation (row A2).
- **Status:** agreed

## X2 · Live stream and controls (lane a gives to lanes b and c)

- **Kind:** WebSocket at `ws://localhost:8787/ws` (in dev the web app uses `/ws` through the
  Vite proxy). JSON text frames.
- **Server to client:**

```json
{ "type": "snapshot", "world": { "...": "a full World (X1)" } }
{ "type": "events", "events": [ { "id": "e-1042", "tick": 88, "actor": 2, "lamport": 311, "type": "tile_claimed", "tile": 417, "owner": 2, "from": -1, "cause": "expand" } ] }
{ "type": "agents", "agents": [ { "countryId": 2, "link": "cut", "ruler": "autopilot", "deleted": false, "lastHeardTick": 80, "pendingEvents": 14 } ] }
{ "type": "budget", "calls": 212, "tokensIn": 61200, "tokensOut": 18800, "callsPerMin": 14, "capped": false, "mode": "mock" }
{ "type": "belief", "countryId": 2, "owner": [ -1, 2, 2, 0 ] }
{ "type": "none" }
{ "type": "ledger", "entries": [ { "id": "p-1042", "eventIds": ["e-1042"], "tick": 352, "year": 1052, "from": 2, "to": 0, "amount": 120, "reason": "reparations", "note": "Treaty of Hatfield", "status": "confirmed", "signature": "5Kx...", "url": "https://explorer.solana.com/tx/5Kx...?cluster=devnet" } ] }
{ "type": "economy", "mode": "devnet", "online": true, "pending": 3, "payments": 1284, "volume": 18230.5, "feesSol": 0.0061 }
```

- **`ledger` and `economy` (row A27):** every `payment` event becomes a ledger row. `status` is
  `queued`, `sent`, `confirmed`, `failed` or `simulated` (mock mode); a row is sent again each time
  its status changes, so the client keeps the latest by `id`. `signature` and `url` are present
  from `sent` on (mock: fake values, `url` null). `economy` goes out when it changes, at most once a
  second. Neither is sent with `SOLANA_MODE=off`. Replays send `ledger` rows with the saved
  signatures and send nothing to the chain.

  A `snapshot` is sent on connect and whenever a new world is created. `events` arrive in
  batches, about four a second; apply each with `applyEvent`. `none` means no world exists yet.
  `belief` answers a `belief` request: the tile ownership as that nation's own replica sees it.

- **Client to server:**

```json
{ "type": "control", "action": "cut", "countryId": 2 }
{ "type": "control", "action": "restore", "countryId": 2 }
{ "type": "control", "action": "silence", "countryId": 2 }
{ "type": "control", "action": "wake", "countryId": 2 }
{ "type": "control", "action": "delete", "countryId": 2 }
{ "type": "control", "action": "blackout", "value": true }
{ "type": "control", "action": "speed", "value": 4 }
{ "type": "control", "action": "pacing", "value": "auto" }
{ "type": "control", "action": "pause", "value": true }
{ "type": "control", "action": "decree", "text": "A plague sweeps the southern coast" }
{ "type": "control", "action": "kill", "countryId": 2, "role": "general" }
{ "type": "control", "action": "cut_member", "countryId": 2, "role": "general" }
{ "type": "control", "action": "restore_member", "countryId": 2, "role": "general" }
{ "type": "belief", "countryId": 2 }
```

  `speed` is any number from 0.1 to 64 (a multiplier on the base rate of two years a second): 0.1
  is one year every five seconds, 1 is the old normal, 64 is a century in under a second. The
  server clamps it. `pacing` is `"manual"` (the default: the chosen speed holds) or `"auto"` (the
  director: the chosen speed is a ceiling; after a big moment, such as a war declared, a battle for
  a capital, a secession, a fall, a decree, a cut or a restore, the world slows to at most 1 for
  about eight seconds, then eases back up). The server reports the effective speed in a new
  `{ "type": "clock", "speed": 4, "target": 8, "pacing": "auto", "paused": false }` message
  whenever it changes. `blackout` cuts or restores every link at once.

- **Errors:** an unknown message gets `{ "type": "error", "message": "..." }`; the socket stays open.
- **Mock:** `npm run mock` starts the real server with `mockWorld()` and `mockEvents()` and
  accepts every control (cut and delete change the `agents` list; nothing else is simulated).
  The mock stays in the repo for good: it is how lanes b and c build and test without waiting
  for the engine, and it costs no API calls.
- **Real by:** CP0 mock (A1); CP1 real events (A3); CP1.5 real controls (A7).
- **Status:** agreed

## X3 · HTTP routes (lane a gives to the web app)

- **Kind:** HTTP on port 8787; in dev the web app calls `/api/...` through the Vite proxy.

| Route | Giver | Request | Response |
| --- | --- | --- | --- |
| `GET /api/health` | a | none | `{ "ok": true, "mode": "mock", "world": "w-3f9a" }` |
| `POST /api/world` | a | `{ "prompt": "a drowned post-apocalyptic world", "nations": 6, "era": "post-apocalyptic", "seaLevel": 0.55, "aggression": 0.5, "seed": 12345, "imageBase64": null }` (only `prompt` is required; `imageBase64` is an optional picture (JPEG, PNG or WebP, raw base64 or a data URL, under 4 MB decoded) that Gemini reads for mood, palette, setting and sea level, row A17; anything else gets `400 { "error": "unsupported image" }`) | `{ "worldId": "w-3f9a" }`, then a `snapshot` on the socket. In live mode it answers after about 7 s (Gemini writes the world bible); the Create screen shows a loading state meanwhile |
| `GET /api/replays` | a | none | `[ { "id": "demo-1", "name": "The Drowned Age", "events": 5210 } ]` |
| `POST /api/replays/:id/play` | a | none | `{ "worldId": "w-3f9a" }`, then a `snapshot`; events replay with no API calls |
| `GET /api/world/log` | a | none | `{ "initial": { "...": "the World at tick 0" }, "events": [ ] }`: the whole run, for the timeline scrubber |
| `GET /api/country/:id/lore` | a | none | see below |
| `GET /api/country/:id/narration` | a | none | `audio/mpeg`: the lore `summary` and `history` spoken |
| `GET /api/country/:id/anthem` | a | none | `audio/mpeg`, about 30 seconds, sung to `anthemLyrics` |
| `GET /api/country/:id/chant` | a | none | `audio/mpeg`, 5 to 10 seconds: that nation's war chant |
| `GET /api/country/:id/flag` | a | none | `image/png`: an AI-painted version of the nation's flag, made on first request and cached. `503` when image generation is off or capped; the interface then keeps the drawn flag |
| `GET /api/region/:id/lore` | a | none | `{ "regionId": 4, "name": "The Salt Marches", "owner": 2, "summary": "...", "history": "..." }` |
| `GET /api/stats/territory?worldId=` | a | none (`worldId` optional, default current world) | `{ "worldId": "w-3f9a", "series": [ { "countryId": 0, "name": "...", "color": "#c8553d", "points": [ { "tick": 10, "year": 1010, "tiles": 12 } ] } ] }` from Tiger Data (row A11); `503 { "error": "stats unavailable" }` without a database |
| `GET /api/stats/summary` | a | none | `{ "events": 5210, "worlds": 3, "eventsPerType": { "tile_claimed": 900 } }`; `503` without a database |
| `POST /api/decree/voice` | a | `{ "audioBase64": "...", "mimeType": "audio/webm" }` (a spoken decree, up to about 15 s) | `{ "transcript": "a plague sweeps the southern coast", "decree": { "text": "A plague sweeps the southern coast", "effect": "plague", "target": { "countryId": 2 } } }`; the decree is applied at once (a `decree` chronicle entry, plus its effect from row A20). Gemini hears the audio directly. `400 { "error": "unsupported audio" }` (webm/opus, ogg, mp3, wav up to about 2 MB) or `{ "error": "no speech heard" }`; `503 { "error": "voice unavailable" }` when Gemini fails; mock mode returns a canned decree. Typed decrees (X2 `decree`) get the same effects |
| `POST /api/broadcast` | a | `{ "imageBase64": "...", "mimeType": "image/jpeg" }` (a capture of the globe, about 1280 x 720) | `{ "id": "b-7", "tick": 210, "year": 1210, "headline": "War on the Salt Marches", "anchor": "Sam", "script": "Good evening. ...", "audio": "/api/broadcast/b-7/audio" }`: Gemini looks at the image and the recent chronicle and writes a 20 to 30 s news bulletin. Gemini takes about 15 to 20 s with the image (show a "preparing bulletin" state). Over `BROADCAST_MAX_PER_RUN` or the LLM cap, or on any failure, it returns a template bulletin from the chronicle instead (never 503); mock mode does the same. `404` with no world, `400` without an image |
| `GET /api/broadcast/:id/audio` | a | none | `audio/mpeg`: "Terra Nova News." and the bulletin read by a newsreader voice (ElevenLabs), cached; `503 { "error": "voice unavailable" }` over the cap or on failure; mock: a bundled sample |
| `GET /api/decree/:entryId/herald` | a | none (`entryId` is the id of a `decree` chronicle entry) | `audio/mpeg`: the decree read out by the royal herald (one of the team's voices), cached; `503 { "error": "voice unavailable" }`; mock: a bundled sample. The X6 module plays it automatically when a decree entry arrives |
| `GET /api/economy` | a | none | `{ "mode": "devnet", "cluster": "devnet", "currency": { "name": "Drowned Age Crown", "symbol": "TNC", "mint": "Ab1...", "url": "https://explorer.solana.com/address/Ab1...?cluster=devnet", "supply": 1000000, "mintAuthority": null }, "commons": { "address": "Co1...", "url": "...", "balance": 812000 }, "nations": [ { "countryId": 2, "address": "Na2...", "url": "...", "onChain": 10120, "ledger": 10120, "drift": 0, "sim": 151.2, "inSync": true } ], "totals": { "payments": 1284, "volume": 18230.5, "transactions": 402, "feesSol": 0.0061 }, "recent": [ "the last 50 ledger rows, as in X2" ] }` (row A27). The chain records every coin that moves between nations while income and spending stay in the sim: `ledger` is the nation's genesis float (10,000) plus confirmed payments in, minus confirmed payments out, plus any Commons advance; `drift` is `onChain - ledger`; `inSync` is `|drift| <= 0.01` (a nation with a payment still in flight counts as in sync); `sim` is the treasury, for information. Mock mode answers at once with fake addresses and `simulated` rows; `503 { "error": "economy off" }` with `SOLANA_MODE=off` |

  Lore response:

```json
{
  "countryId": 2,
  "asOfTick": 120,
  "summary": "Two sentences on who they are now.",
  "culture": "A short paragraph: customs, faith, food, what they are proud of.",
  "politics": "A short paragraph: who rules, the ideology, the factions.",
  "history": "A short paragraph built from this nation's real chronicle entries.",
  "anthemLyrics": [ "Four to eight short lines", "written from the founding myth and the real chronicle:", "its wars, its losses, its allies." ],
  "relations": [ { "with": 0, "stance": "war", "story": "One or two sentences on what happened between them." } ]
}
```

  Lore is cached per nation and refreshed only if more than 60 ticks old and the nation is
  clicked again. Narration, anthem and chant are cached on disk in `server/.cache/` by content
  hash. The anthem is generated from the lyrics and the nation's `anthemPrompt`, so it is tied
  to that nation's history; it is regenerated only when the lyrics change. The chant is made
  once per nation from its culture and `voiceStyle`.

- **Errors:** `404 { "error": "no such country" }`; `503 { "error": "voice unavailable" }` when
  ElevenLabs fails (the panel then shows the text only).
- **Mock:** with `LLM_MODE=mock`, lore is built from templates and the chronicle, and the three
  audio routes return a bundled sample file from `server/src/story/samples/`.
- **Mock by:** CP0: row A1 ships a mock of every route in this table.
- **Real by:** CP1 (`POST /api/world` A2, lore A13); CP1.5 (narration A14, anthem A15, chant A16); CP2 (replays and log A9).
- **Status:** agreed

## X4 · 3D model manifest (lane a gives to lane b)

- **Kind:** files in `web/public/models/`: one `.glb` per model and `manifest.json`.
- **Format:**

```json
{
  "version": 1,
  "models": {
    "camp": { "file": "camp.glb", "footprint": 0.6 },
    "village": { "file": "village.glb", "footprint": 0.8 },
    "town": { "file": "town.glb", "footprint": 0.9 },
    "city": { "file": "city.glb", "footprint": 1.0 },
    "capital": { "file": "capital.glb", "footprint": 1.0 },
    "farm": { "file": "farm.glb", "footprint": 0.8 },
    "port": { "file": "port.glb", "footprint": 0.8 },
    "fort": { "file": "fort.glb", "footprint": 0.7 },
    "temple": { "file": "temple.glb", "footprint": 0.7 },
    "factory": { "file": "factory.glb", "footprint": 0.8 },
    "ruin": { "file": "ruin.glb", "footprint": 0.8 },
    "army": { "file": "army.glb", "footprint": 0.5 },
    "fleet": { "file": "fleet.glb", "footprint": 0.5 },
    "settler": { "file": "settler.glb", "footprint": 0.4 },
    "tree": { "file": "tree.glb", "footprint": 0.3 }
  }
}
```

  **Technology ages (owner decision, 14 Nov):** the manifest also has
  `"ages": { "<age>": { "army": {...}, "fleet": {...}, "trader": {...} } }` for the five ages:
  ancient (spearmen and archers; a galley; a trade galley), medieval (knights and crossbows; a
  longship or cog; a merchant cog), gunpowder (musketeers and a cannon; a galleon; a merchant
  galleon), industrial (riflemen and artillery; an ironclad; a steamer), modern (a tank; a
  destroyer; a container ship), and from 14 Nov two further ages so history keeps going past
  the present: future (a drone swarm and a hover tank; a railgun stealth cruiser; an autonomous
  maglev or hydrofoil freighter) and stellar (walker mechs; a starship; an orbital freighter).
  Buildings: a nation in the future or stellar age builds in the `arcology` style (domes,
  arcology towers, spires, a space elevator for the stellar capital) whatever its culture style:
  lane b picks `styles.arcology[kind]` when `techAge` is `future` or `stellar`, else the culture
  style. A stellar nation also gets satellites circling the globe above its capital (lane b; no
  model needed beyond a small `satellite` key in `models`). Lane b draws `ages[countries[unit.owner].techAge][unit.kind]`, then
  `models[kind]`, then the cone. A nation's age advances during the run (a `country_updated` with
  `techAge` and a chronicle line), so every unit it owns changes look at once.

  **Building styles (owner decision #91):** the manifest also has
  `"styles": { "<style>": { "<kind>": { "file": "<style>/<kind>.glb", "footprint": n } } }` for six
  styles (`medieval`, `classical`, `desert`, `east_asian`, `mesoamerican`, `scrap`, and from #118
  `soviet_bloc`, `western_modern`, `egyptian`, `highland`, and the age style `arcology`) and five kinds
  (`capital`, `city`, `town`, `temple`, `fort`). Lane b picks `styles[country.buildingStyle][kind]`,
  then `styles[STYLE_FALLBACK[style]][kind]` (`norse` to medieval, `south_asian` and `sahel` to
  desert, `industrial` to scrap; exported from `@terra/shared`), then `models[kind]`, then the box.
  Every other kind stays shared. Gemini picks each nation's style in the world bible (at most two
  nations per style); `mockWorld()` gives its nations five different styles.

  Keys are every `StructureKind` and `UnitKind` plus `tree`. Each model: +Y up, origin at the
  centre of its base, fits a 1 x 1 x 1 box, under 1,500 triangles, flat-shaded vertex colours or
  plain materials, no textures. One material named `team` is recoloured by lane b to the
  nation's colour. `footprint` is the share of a tile's width the model should fill.

  **Wonders (row A30):** `"wonders": { "<WonderKind>": { "file": "wonders/<kind>.glb", "footprint": n } }`,
  one model per `WonderKind`, built larger than a capital (lane b draws it at about 2 tiles wide),
  under 3,000 triangles, with a `team` part. `great_wall` is one wall segment with a tower that
  lane b repeats along the nation's border edges.

  **Effect anchors (owner decision 14 Nov):** unit models (`ages.*.*`, `models.army`, `models.fleet`,
  `models.trader`, `models.satellite`) may hold empty nodes (no mesh) named `fx_thruster`,
  `fx_wake`, `fx_exhaust`, `fx_contrail`, `fx_dust` (a suffix like `fx_thruster.001` is allowed for
  several). Each sits where the effect starts, in the model's local space; its local -Z points the
  way the effect streams out (backwards for flames, wakes and trails, up for smoke). Lane b attaches
  its effects there: afterburner and thruster flames (orange-blue flicker, brighter while moving),
  white V-wakes and foam behind ships under way, exhaust smoke for industrial and later units, dust
  behind marching armies, white contrails behind jets and satellites. Models without anchors get no
  effect. Escorts: the modern army has a jet fighter flying above the tank (`fx_thruster`,
  `fx_contrail`); the future army has two rocket bikes (our own design) instead of drones.

- **Mock:** until the files exist lane b draws a coloured box (structures) or cone (units) for
  any key missing from the manifest. That fallback stays in for good.
- **Real by:** CP1 (row A8).
- **Status:** agreed

## X5 · Browser store and interface slots (written by lane a in the seed, owned by lane b)

- **Kind:** `zustand` store in `web/src/state/world.ts`.
- **Signature:**

```ts
export interface WorldStore {
  world: World | null;                       // the replica; replaced on snapshot, mutated by applyEvent
  version: number;                           // bumps on every applied batch; subscribe to this to re-render
  agents: AgentStatus[];
  budget: { calls: number; tokensIn: number; tokensOut: number; callsPerMin: number; capped: boolean; mode: 'mock' | 'live' } | null;
  connected: boolean;
  selectedCountryId: number | null;
  selectedTileId: number | null;
  selectedRegionId: number | null;           // set with the tile when zoomed in close; null when zoomed out
  beliefOf: number | null;                   // when set, the globe draws that nation's beliefs
  mapMode: 'political' | 'terrain' | 'diplomacy' | 'strength';  // diplomacy colours every nation by its stance to the selected one
  setMapMode(mode: WorldStore['mapMode']): void;
  select(countryId: number | null, tileId?: number | null): void;
  showBelief(countryId: number | null): void;
  flyTo(countryId: number): void;            // camera moves to that nation's capital
  send(message: object): void;               // any X2 client message
  recentEvents: WorldEvent[];                // the last 200, newest last, for tickers and effects
}
export const useWorld: UseBoundStore<StoreApi<WorldStore>>;
```

- **The nation card:** selecting a nation makes lane b slide lane c's `NationCard` component
  (`web/src/ui/index.ts`, props `{ countryId: number }`, plain DOM, 380 px wide, colours from X7)
  in, docked to the right side of the screen. No hologram (dropped by the owner on 14 Nov). The
  `.holo` class and `--holo-*` variables stay defined but are no longer used.
- **Map labels:** nation and region names on the globe are billboarded: they always face the
  camera, stay upright and readable from any angle and zoom (lane b).
- **Interface components (lane c gives to lane b):** `web/src/ui/index.ts` exports
  `CreateScreen` (no props), `NationCard` (`{ countryId: number; regionId?: number | null }`),
  `Chronicle` (no props), `NetworkPanel` (no props), `DecreeBox` (no props) and `TokenMeter` (no props). The decree box and token meter sit in the top-bar area per the design (lane b places them).
- **News broadcast (row A21):** lane c exports `NewsBroadcast` (no props) from `web/src/ui/index.ts`: a "Terra Nova News" lower-third (headline, scrolling script, an on-air light) that, every 2 minutes while the world runs and on a button in the top bar, calls `captureGlobe()`, posts the image to `POST /api/broadcast`, and plays the result with `audio.playBroadcast`. Lane b exports `captureGlobe(): Promise<{ imageBase64: string; mimeType: 'image/jpeg' }>` from `web/src/globe/capture.ts` (the canvas needs `preserveDrawingBuffer`, or capture right after a render) and places `NewsBroadcast`.
- **Spoken decrees (row A20):** lane c adds a hold-to-speak mic button to `DecreeBox` (MediaRecorder, webm/opus, up to 15 s) that posts to `POST /api/decree/voice` and shows the transcript.
- **Image prompt (row A17):** lane c adds an optional picture drop zone to `CreateScreen`, sent as `imageBase64` in `POST /api/world`. The seed ships a working placeholder for
  each, already placed in `App.tsx`, so the names and props never change.
- **Mock:** none needed: the seed (row A1) ships the real store, working against
  `npm run mock`. Lane a writes it; lane b owns it from then on.
- **Real by:** CP0 (row A1).
- **Status:** agreed

## X6 · Sound (lane a gives to lanes b and c)

- **Kind:** module `web/src/audio/index.ts`.
- **Signature:**

```ts
export type AudioState = 'idle' | 'loading' | 'narration' | 'anthem' | 'broadcast';
export const audio: {
  playNarration(countryId: number): Promise<void>;   // fetches X3 narration, ducks everything else
  playAnthem(countryId: number): Promise<void>;
  playBroadcast(audioUrl: string): Promise<void>;     // a news bulletin (row A21); ducks chants, stops narration and anthem
  stop(): void;
  setMuted(muted: boolean): void;
  getState(): { state: AudioState; countryId: number | null; muted: boolean };
  subscribe(listener: () => void): () => void;       // for React's useSyncExternalStore
};
```

  Decrees are heard automatically too: when a `decree` chronicle entry arrives (the decree's own
  line, not its consequence), the module plays `/api/decree/:entryId/herald`, ducking chants.

  War sound is automatic: the module watches `recentEvents` in the store (X5) and, when a war
  is declared or a battle is fought, plays the chants of the nations involved (X3 chant), louder
  when one of them is selected. Lanes b and c do not call anything for it.

- **Mock:** in mock mode the server returns bundled samples, so the module behaves the same.
  Until row A14 merges, lane c codes against a stub with the same signature that only changes
  state (shipped in A1).
- **Real by:** CP1.5 (rows A14 to A16).
- **Status:** agreed

## X7 · Design (lane a gives to lanes b and c)

- **Kind:** files. `web/src/theme/tokens.css` (CSS variables: colours, fonts, spacing, radii,
  the hologram tint and glow, now unused) and `docs/design/` (a screenshot of each designed screen and the
  Figma link in `docs/design/README.md`).
- **Screens designed:** the Create screen, the nation card (docked), the chronicle ticker and
  timeline, the network panel, the top bar with map modes and speed.
- **Rule:** components use the variables, never hard-coded colours, so a redesign is one file.
- **Mock:** row A1 ships a first `tokens.css` with a dark default so lane c can start at once;
  the designed version (row A12) replaces the values without renaming the variables.
- **Real by:** Sat 18:00 (row A12).
- **Status:** agreed
