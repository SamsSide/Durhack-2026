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
| `LLM_MODE` | lane a | `mock` (default: canned answers, no API calls) or `live` |
| `GEMINI_MODEL_RULER` | lane a | Model id for ruler decisions (a flash-lite model) |
| `GEMINI_MODEL_LORE` | lane a | Model id for the world bible and lore (a flash model) |
| `LLM_MAX_CALLS_PER_MIN` | lane a | Default 20. Above it, nations fall to autopilot |
| `LLM_MAX_TOKENS_PER_RUN` | lane a | Default 400000. Above it, every nation is on autopilot |
| `GEMINI_MODEL_IMAGE` | lane a | Image model id for painted flags; empty turns painted flags off |
| `IMAGE_MAX_PER_RUN` | lane a | Default 12. Painted flags per world |
| `PORT` | lane a | Server port, default 8787 |
| `TIGER_DATABASE_URL` | lane a | Optional, row A11 |

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
  voiceStyle: string;                                    // for narration voice choice
  alive: boolean;
  population: number;
  treasury: number;
}

export type StructureKind = 'camp' | 'village' | 'town' | 'city' | 'capital'
  | 'farm' | 'port' | 'fort' | 'temple' | 'factory' | 'ruin';
export interface Structure { id: string; tile: number; owner: number; kind: StructureKind; builtTick: number }

export type UnitKind = 'army' | 'fleet' | 'settler';
export interface Unit { id: string; owner: number; kind: UnitKind; tile: number; strength: number; target?: number }

export type Stance = 'war' | 'hostile' | 'neutral' | 'trade' | 'alliance';
export interface Relation { a: number; b: number; stance: Stance; since: number; grievance: number } // a < b

export type ChronicleKind = 'founding' | 'proclamation' | 'growth' | 'war' | 'battle' | 'peace'
  | 'alliance' | 'betrayal' | 'fall' | 'silence' | 'return' | 'dispute' | 'decree';
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
```

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
```

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
{ "type": "control", "action": "pause", "value": true }
{ "type": "control", "action": "decree", "text": "A plague sweeps the southern coast" }
{ "type": "belief", "countryId": 2 }
```

  `speed` is 1, 2, 4 or 8. `blackout` cuts or restores every link at once.

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
| `POST /api/world` | a | `{ "prompt": "a drowned post-apocalyptic world", "nations": 6, "era": "post-apocalyptic", "seaLevel": 0.55, "aggression": 0.5, "seed": 12345, "imageBase64": null }` (only `prompt` is required) | `{ "worldId": "w-3f9a" }`, then a `snapshot` on the socket |
| `GET /api/replays` | a | none | `[ { "id": "demo-1", "name": "The Drowned Age", "events": 5210 } ]` |
| `POST /api/replays/:id/play` | a | none | `{ "worldId": "w-3f9a" }`, then a `snapshot`; events replay with no API calls |
| `GET /api/world/log` | a | none | `{ "initial": { "...": "the World at tick 0" }, "events": [ ] }`: the whole run, for the timeline scrubber |
| `GET /api/country/:id/lore` | a | none | see below |
| `GET /api/country/:id/narration` | a | none | `audio/mpeg`: the lore `summary` and `history` spoken |
| `GET /api/country/:id/anthem` | a | none | `audio/mpeg`, about 30 seconds, sung to `anthemLyrics` |
| `GET /api/country/:id/chant` | a | none | `audio/mpeg`, 5 to 10 seconds: that nation's war chant |
| `GET /api/country/:id/flag` | a | none | `image/png`: an AI-painted version of the nation's flag, made on first request and cached. `503` when image generation is off or capped; the interface then keeps the drawn flag |
| `GET /api/region/:id/lore` | a | none | `{ "regionId": 4, "name": "The Salt Marches", "owner": 2, "summary": "...", "history": "..." }` |

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

  Keys are every `StructureKind` and `UnitKind` plus `tree`. Each model: +Y up, origin at the
  centre of its base, fits a 1 x 1 x 1 box, under 1,500 triangles, flat-shaded vertex colours or
  plain materials, no textures. One material named `team` is recoloured by lane b to the
  nation's colour. `footprint` is the share of a tile's width the model should fill.

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

- **The hologram:** selecting a nation makes lane b project a hologram above its capital (a
  light beam, scan lines, flicker). Inside it lane b mounts lane c's `NationCard` component
  (`web/src/ui/index.ts`, props `{ countryId: number }`, plain DOM, 380 px wide, transparent
  background, colours from X7). On a narrow screen the same card docks to the side instead.
- **Interface components (lane c gives to lane b):** `web/src/ui/index.ts` exports
  `CreateScreen` (no props), `NationCard` (`{ countryId: number; regionId?: number | null }`),
  `Chronicle` (no props) and `NetworkPanel` (no props). The seed ships a working placeholder for
  each, already placed in `App.tsx`, so the names and props never change.
- **Mock:** none needed: the seed (row A1) ships the real store, working against
  `npm run mock`. Lane a writes it; lane b owns it from then on.
- **Real by:** CP0 (row A1).
- **Status:** agreed

## X6 · Sound (lane a gives to lanes b and c)

- **Kind:** module `web/src/audio/index.ts`.
- **Signature:**

```ts
export type AudioState = 'idle' | 'loading' | 'narration' | 'anthem';
export const audio: {
  playNarration(countryId: number): Promise<void>;   // fetches X3 narration, ducks everything else
  playAnthem(countryId: number): Promise<void>;
  stop(): void;
  setMuted(muted: boolean): void;
  getState(): { state: AudioState; countryId: number | null; muted: boolean };
  subscribe(listener: () => void): () => void;       // for React's useSyncExternalStore
};
```

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
  the hologram tint and glow) and `docs/design/` (a screenshot of each designed screen and the
  Figma link in `docs/design/README.md`).
- **Screens designed:** the Create screen, the hologram nation card, the chronicle ticker and
  timeline, the network panel, the top bar with map modes and speed.
- **Rule:** components use the variables, never hard-coded colours, so a redesign is one file.
- **Mock:** row A1 ships a first `tokens.css` with a dark default so lane c can start at once;
  the designed version (row A12) replaces the values without renaming the variables.
- **Real by:** Sat 18:00 (row A12).
- **Status:** agreed
