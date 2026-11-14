# Contracts

*Every interface one lane gives another. Owner-edited (changes go through a `needs-owner`
issue naming every lane affected). Code against these exactly; mock them until CP1.*

Contracts are numbered X1 to X5 (not C, so they are not confused with lane c's rows).
The TypeScript in `packages/shared/src/` is the source of truth once row A1 is merged; if this
file and the code disagree, the code wins and the owner fixes this file.

## Shared files

| File | Owning lane | Others |
| --- | --- | --- |
| root `package.json`, `package-lock.json`, `tsconfig.base.json` | a | new dependency: `needs-owner` issue |
| `packages/shared/**` | a | ask lane a via `agent-request` |
| `server/package.json`, `server/src/index.ts` (mounts every router) | a | lane c exports a router from `server/src/story/index.ts`; lane a mounts it |
| `web/package.json`, `web/vite.config.ts`, `web/src/main.tsx`, `web/src/App.tsx` | b | lane c exports components from `web/src/ui/index.ts`; lane b places them in `App.tsx` |
| `web/src/state/**` (the store, X5) | b | lane c reads it; changes via `agent-request` |
| `web/public/models/**` (X4) | a | lane b reads it |
| `.env.example`, `check.sh`, `CLAUDE.md` | owner | `needs-owner` |

## Environment variables

Real values go in `.env` at the repo root (git-ignored). The owner's keys file is
`~/.config/durhack/keys.env`; teammates get the values from the owner in person, never in chat.

| Name | Used by | What |
| --- | --- | --- |
| `GEMINI_API_KEY` | lanes a, c | Gemini API key |
| `ELEVENLABS_API_KEY` | lane c | ElevenLabs key |
| `LLM_MODE` | lanes a, c | `mock` (default: canned answers, no API calls) or `live` |
| `GEMINI_MODEL_RULER` | lane a | Model id for ruler decisions (a flash-lite model) |
| `GEMINI_MODEL_LORE` | lanes a, c | Model id for the world bible and lore (a flash model) |
| `LLM_MAX_CALLS_PER_MIN` | lane a | Default 20. Above it, nations fall to autopilot |
| `LLM_MAX_TOKENS_PER_RUN` | lane a | Default 400000. Above it, every nation is on autopilot |
| `PORT` | lane a | Server port, default 8787 |
| `TIGER_DATABASE_URL` | lane a | Optional, row A11 |

## X1 · World types and `applyEvent` (lane a gives to lanes b and c)

- **Kind:** TypeScript package `@terra/shared`, imported by `server` and `web`.
- **Signature:**

```ts
export type Vec3 = [number, number, number];            // on the unit sphere, y is up
export type Terrain = 'ocean' | 'coast' | 'plains' | 'forest' | 'desert' | 'hills' | 'mountain' | 'ice';

export interface Tile {                                  // static after generation
  id: number;                                            // index into World.tiles
  center: Vec3;
  boundary: Vec3[];                                      // 5 or 6 corners, in order
  neighbors: number[];                                   // tile ids
  terrain: Terrain;
  elevation: number;                                     // 0 to 1
}

export interface Country {
  id: number;                                            // index into World.countries
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
  | { type: 'chronicle'; entry: ChronicleEntry }
);

export function applyEvent(world: World, event: WorldEvent): void;   // mutates; the only way a World changes
export function countryTiles(world: World, countryId: number): number[];
export function borderEdges(world: World, countryId: number): [Vec3, Vec3][]; // edges between this country and anything else
export function relationOf(world: World, a: number, b: number): Relation;
```

- **Mock:** `packages/shared/src/mock.ts` exports `mockWorld(): World` (about 600 tiles, 5
  countries) and `mockEvents(world): Generator<WorldEvent>` (growth, one war, one fall).
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
- **Real by:** CP0 mock (A1); CP1 real events (A3); CP1.5 real controls (A7).
- **Status:** agreed

## X3 · HTTP routes (lanes a and c give to the web app)

- **Kind:** HTTP on port 8787; in dev the web app calls `/api/...` through the Vite proxy.

| Route | Giver | Request | Response |
| --- | --- | --- | --- |
| `GET /api/health` | a | none | `{ "ok": true, "mode": "mock", "world": "w-3f9a" }` |
| `POST /api/world` | a | `{ "prompt": "a drowned post-apocalyptic world", "nations": 6, "era": "post-apocalyptic", "seaLevel": 0.55, "aggression": 0.5, "seed": 12345, "imageBase64": null }` (only `prompt` is required) | `{ "worldId": "w-3f9a" }`, then a `snapshot` on the socket |
| `GET /api/replays` | a | none | `[ { "id": "demo-1", "name": "The Drowned Age", "events": 5210 } ]` |
| `POST /api/replays/:id/play` | a | none | `{ "worldId": "w-3f9a" }`, then a `snapshot`; events replay with no API calls |
| `GET /api/country/:id/lore` | c | none | see below |
| `GET /api/country/:id/narration` | c | none | `audio/mpeg`: the lore `summary` and `history` spoken |
| `GET /api/country/:id/anthem` | c | none | `audio/mpeg`, about 30 seconds |

  Lore response:

```json
{
  "countryId": 2,
  "asOfTick": 120,
  "summary": "Two sentences on who they are now.",
  "culture": "A short paragraph: customs, faith, food, what they are proud of.",
  "politics": "A short paragraph: who rules, the ideology, the factions.",
  "history": "A short paragraph built from this nation's real chronicle entries.",
  "relations": [ { "with": 0, "stance": "war", "story": "One or two sentences on what happened between them." } ]
}
```

  Lore is cached per nation and refreshed only if more than 60 ticks old and the nation is
  clicked again. Narration and anthem are cached on disk in `server/.cache/` by content hash.

- **Errors:** `404 { "error": "no such country" }`; `503 { "error": "voice unavailable" }` when
  ElevenLabs fails (the panel then shows the text only).
- **How lane c reads the world on the server:** lane a exports `getWorld(): World | null` from
  `server/src/engine/index.ts`. Lane c never changes the world.
- **Mock:** with `LLM_MODE=mock`, lore is built from templates and the chronicle, and the two
  audio routes return a bundled sample file from `server/src/story/samples/`.
- **Real by:** CP1 (`POST /api/world` A2, lore C3); CP1.5 (narration C4, anthem C5, replays A9).
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

## X5 · Browser store (lane b gives to lane c)

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
  beliefOf: number | null;                   // when set, the globe draws that nation's beliefs
  select(countryId: number | null, tileId?: number | null): void;
  showBelief(countryId: number | null): void;
  flyTo(countryId: number): void;            // camera moves to that nation's capital
  send(message: object): void;               // any X2 client message
  recentEvents: WorldEvent[];                // the last 200, newest last, for tickers and effects
}
export const useWorld: UseBoundStore<StoreApi<WorldStore>>;
```

- **Mock:** lane b ships the store first (row B1), connected to `npm run mock`.
- **Real by:** CP0 plus one hour (row B1).
- **Status:** agreed
