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
}

export type StructureKind = 'camp' | 'village' | 'town' | 'city' | 'capital'
  | 'farm' | 'port' | 'fort' | 'temple' | 'factory' | 'ruin';
export interface Structure { id: string; tile: number; owner: number; kind: StructureKind; builtTick: number }

export type UnitKind = 'army' | 'fleet' | 'settler' | 'trader';   // trader: a merchant ship crossing the ocean between trading nations
export type TechAge = 'ancient' | 'medieval' | 'gunpowder' | 'industrial' | 'modern' | 'future' | 'stellar';
export interface Unit { id: string; owner: number; kind: UnitKind; tile: number; strength: number; target?: number }

export type Stance = 'war' | 'hostile' | 'neutral' | 'trade' | 'alliance';
export interface Relation { a: number; b: number; stance: Stance; since: number; grievance: number } // a < b

export type ChronicleKind = 'founding' | 'proclamation' | 'growth' | 'war' | 'battle' | 'peace'
  | 'alliance' | 'betrayal' | 'fall' | 'silence' | 'return' | 'dispute' | 'decree' | 'secession';
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

export type Base = { id: string; tick: number; actor: number | 'world' | 'decree'; lamport: number };
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

