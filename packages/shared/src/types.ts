// X1 world types (docs/contracts.md). Source of truth from row A1 on.

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
  warReadiness?: number;                                 // #204 (B11): 0..100, missing means 0; bands 0-19 Peace, 20-49 Watchful, 50-79 Mobilised, 80-100 Total war
  politics?: { axis: number; radicalism: number };       // #204: axis -100 far left..+100 far right, radicalism 0..100; missing means { axis: 0, radicalism: 10 }
}

// Goods (#204, B11): one good per province, derived from terrain and hashString (goodOf in sim/economy.ts), never stored.
export type Good = 'grain' | 'fish' | 'timber' | 'stone' | 'ore' | 'salt' | 'gold' | 'furs' | 'oil' | 'uranium';

// Council (row A29, owner decision on #146: ruler and general only).
export type CouncilRole = 'ruler' | 'general';
export interface CouncilMember { name: string; portraitSeed: number; since: number; memory: string; born?: number } // since = tick; memory = rolling 5-line summary handed to a successor; born = birth year (missing on old replays: never ages)
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
  | 'alliance' | 'betrayal' | 'fall' | 'silence' | 'return' | 'dispute' | 'decree' | 'secession' | 'wonder'
  | 'death' | 'succession';
export interface ChronicleEntry {
  id: string; tick: number; year: number; kind: ChronicleKind; countries: number[]; text: string;
  decree?: DecreeOutcome;                                // owner #288: only on a decree's own line (kind 'decree'), what it did
}

/** Owner #288: the effects a decree can have (row A20). */
export type DecreeEffect = 'plague' | 'famine' | 'storm' | 'meteor' | 'prophet' | 'goldrush' | 'rebellion' | 'flood' | 'none';
/** Owner #288: what a decree did, decided once when it is applied and recorded in its chronicle entry. */
export interface DecreeOutcome {
  effect: DecreeEffect;
  severity: number;                                      // 0 to 0.8, from the words ("half the population dies" 0.5, "a mild fever" 0.1)
  target: { countryId: number | null; tiles: number[] }; // the nation struck and the provinces actually hit (for the camera and the visual)
  result: string;                                        // one human line with real numbers: "Plague in Hatfield: 41,000 dead", "The world shrugs."
}

/** Owner #288: one beat of a news bulletin's picture: where to look while the anchor speaks of it. */
export interface NewsFocus {
  countryId: number | null; tile: number; atSecond: number; caption: string;
  /** Owner #317: set on a beat about a war: the battle the picture shows, for the war-report strap. */
  battle?: NewsBattle;
}
/** Owner #317: a war beat's battle. `tile` is the newest clash between the two (or their front when none
 *  was fought yet). Strengths are unit strength (the web turns them into soldiers): `strength` each
 *  side's armies and fleets now, `losses` what each side lost on that tile, when the server saw it. */
export interface NewsBattle {
  tile: number; attackerId: number; defenderId: number;
  strength?: { attacker: number; defender: number };
  losses?: { attacker: number; defender: number };
}

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
  devastation?: number[];                                // #204 (B11): tile id to 0..100, parallel to owner; missing means all 0; folded in applyEvent
  countries: Country[];
  structures: Structure[];
  units: Unit[];
  relations: Relation[];
  chronicle: ChronicleEntry[];                           // oldest first; a recent window (world.ts CHRONICLE_KEEP)
  agents: AgentStatus[];
}

/** Row A27 (X1): why money moved between two nations. */
export type PaymentReason = 'trade' | 'reparations' | 'plunder' | 'seizure' | 'war_chest' | 'subsidy';

export type Base = { id: string; tick: number; actor: number | 'world' | 'decree'; lamport: number };
export type WorldEvent = Base & (
  | { type: 'tick'; year: number }
  | { type: 'tile_claimed'; tile: number; owner: number; from: number; cause: 'expand' | 'conquest' | 'dispute' | 'collapse' }
  | { type: 'structure_built'; structure: Structure }
  | { type: 'structure_upgraded'; structureId: string; kind: StructureKind }
  | { type: 'structure_destroyed'; structureId: string }
  | { type: 'unit_spawned'; unit: Unit }
  | { type: 'unit_moved'; unitId: string; from: number; to: number; arriveTick: number }
  | { type: 'unit_attrition'; unitId: string; loss: number; terrain: Terrain }
  | { type: 'wonder_started'; countryId: number; structureId: string; tile: number; wonder: WonderKind; name: string }
  | { type: 'wonder_built'; countryId: number; structureId: string }
  | { type: 'unit_removed'; unitId: string; reason: 'battle' | 'disband' | 'collapse' }
  | { type: 'council_changed'; countryId: number; role: CouncilRole; member: CouncilMember | null; cause: 'founded' | 'death' | 'assassination' | 'disconnect' | 'succession' | 'coup' | 'restored' | 'old_age' }
  | { type: 'council_status'; countryId: number; role: CouncilRole; state: CouncilState }
  | { type: 'battle'; tile: number; attacker: number; defender: number; attackerUnit: string; winner: number; losses: { attacker: number; defender: number } }
  | { type: 'relation_changed'; a: number; b: number; stance: Stance; reason: string }
  | { type: 'country_updated'; countryId: number; patch: Partial<Country> }
  | { type: 'country_fell'; countryId: number; conqueror?: number }
  | { type: 'country_founded'; country: Country; regionId?: number }    // a secession, or a nation created later; its tiles follow as tile_claimed
  | { type: 'region_updated'; regionId: number; patch: Partial<Pick<Region, 'name' | 'flag' | 'unrest'>> }
  | { type: 'chronicle'; entry: ChronicleEntry }
  | { type: 'payment'; from: number; to: number; amount: number; reason: PaymentReason; note: string } // coins, 2 decimals; actor is the payer (plunder: the attacker)
);

// --- Row A27 (X2): the Solana mirror of the economy, server to client ---------------------------
export type LedgerStatus = 'queued' | 'sent' | 'confirmed' | 'failed' | 'simulated';
export interface LedgerEntry {
  id: string; eventIds: string[]; tick: number; year: number;
  from: number; to: number; amount: number; reason: PaymentReason; note: string;
  status: LedgerStatus;
  signature?: string;                                    // from `sent` on
  url?: string | null;                                   // Explorer link; null in mock mode
}
export interface LedgerMessage { type: 'ledger'; entries: LedgerEntry[] }
export type EconomyMode = 'off' | 'mock' | 'devnet';
export interface EconomyMessage {
  type: 'economy'; mode: EconomyMode; online: boolean; pending: number;
  payments: number; volume: number; feesSol: number;
}
/** X3 `GET /api/economy`. */
export interface EconomyState {
  mode: EconomyMode; cluster: string;
  currency: { name: string; symbol: string; mint: string; url: string | null; supply: number; mintAuthority: string | null };
  commons: { address: string; url: string | null; balance: number };
  /** `ledger`: genesis float + confirmed payments in - out (+ Commons advances); `drift` = onChain - ledger; `sim` is the treasury, for information. */
  nations: { countryId: number; address: string; url: string | null; onChain: number; ledger?: number; sim: number; drift?: number; inSync: boolean }[];
  totals: { payments: number; volume: number; transactions: number; feesSol: number };
  recent: LedgerEntry[];
}

// --- Row A31 (X2 Prepare): a world made ready for a demo while it waits paused, server to client ---
export type PrepareItemKind = 'lore' | 'narration' | 'chant' | 'anthem' | 'ruler';
export type PrepareItemStatus = 'pending' | 'working' | 'ready' | 'failed';
export interface PrepareItem { kind: PrepareItemKind; countryId: number; status: PrepareItemStatus }
/** At most twice a second while it runs, once more with `done: true`; a late connection gets the latest. */
export interface PrepareMessage {
  type: 'prepare'; worldId: string; done: boolean; ready: number; total: number; items: PrepareItem[];
}

