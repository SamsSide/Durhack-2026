// The council (row A29): every nation has a ruler and a general. The ruler sets focus and stance (the
// agent's Gemini ruler, or autopilot); the general moves the armies (the general's step in nationTurn).
// Either can fall, be cut off or be succeeded, and then the other covers (armies fight at
// COVER_STRENGTH while the ruler covers the general).
//
// Who decides what, so every replica agrees:
// - A general falling in battle is derived in settleMove (sim/war.ts) from the battle seed, so every
//   replica derives the same death with the battle.
// - Assassinations, successions, the `kill`, `cut_member` and `restore_member` controls are decided by
//   the world (the server's runner, like secession and the fall of a deleted nation) and published as
//   one batch of world events that every replica applies.
// Everything here is pure: the same world and the same arguments give the same events.
import type {
  BuildingStyle, ChronicleKind, Council, CouncilMember, CouncilRole, CouncilState, Country, TechAge, World, WorldEvent,
} from '../types';
import { hashString } from '../rng';

export const COUNCIL_ROLES: CouncilRole[] = ['ruler', 'general'];
/** Years between a death and the successor. */
export const SUCCESSION_TICKS = 8;
/** Armies fight at this share of their strength while the ruler covers the general. */
export const COVER_STRENGTH = 0.85;
/** A general can fall when his side loses a battle with at least this combined strength... */
export const GENERAL_FALL_STRENGTH = 50;
/** ...with this chance. */
export const GENERAL_FALL_CHANCE = 0.25;
/** The chance a year that one member of a nation's council is assassinated; times WAR_ASSASSINATION in war. */
export const ASSASSINATION_CHANCE = 1 / 400;
export const WAR_ASSASSINATION = 3;
/** The chance a ruler's death in a military or autocratic nation ends in the general seizing power. */
export const COUP_CHANCE = 0.3;

export type CouncilBody = Record<string, unknown> & { type: WorldEvent['type'] };
/** Where a council line goes in the chronicle: its id, tick and year. */
export interface CouncilLine { entryId: string; tick: number; year: number }

const other = (r: CouncilRole): CouncilRole => (r === 'ruler' ? 'general' : 'ruler');
const roll = (key: string): number => hashString(key) / 4294967296;
const mid = (name: string): string => name.replace(/^The /, 'the ');

// ---- names, from the nation's culture ----------------------------------------------------------

const NAME_POOLS: { styles: BuildingStyle[]; given: string[]; family: string[] }[] = [
  { styles: ['classical'], given: ['Cassia', 'Marcus', 'Livia', 'Tullio', 'Aurel', 'Decima', 'Sabin', 'Octavia', 'Quintus', 'Varo'],
    family: ['Severa', 'Corvus', 'Aquila', 'Draso', 'Valens', 'Pollio'] },
  { styles: ['east_asian'], given: ['Mei', 'Jun', 'Haru', 'Lian', 'Tai', 'Sora', 'Kenji', 'Yue', 'Ren', 'Akio'],
    family: ['Tan', 'Mori', 'Kai', 'Sato', 'Lin', 'Hoshi'] },
  { styles: ['south_asian', 'desert', 'sahel', 'egyptian'], given: ['Amar', 'Zahra', 'Idris', 'Nadia', 'Tariq', 'Samir', 'Leila', 'Kofi', 'Amina', 'Ravi', 'Nefer', 'Sefu'],
    family: ['Rahim', 'Diallo', 'Okoro', 'Hassan', 'Varma', 'Sekou'] },
  { styles: ['mesoamerican'], given: ['Itzel', 'Tenoch', 'Xochi', 'Cuauh', 'Yaretzi', 'Ollin', 'Citlali', 'Ahuitz'],
    family: ['Ek', 'Balam', 'Chimal', 'Kan', 'Itza'] },
  { styles: ['soviet_bloc'], given: ['Mirela', 'Oskar', 'Kasia', 'Teodor', 'Yara', 'Dimitri', 'Vera', 'Lev', 'Anya', 'Pavel'],
    family: ['Varga', 'Volkov', 'Petrova', 'Novak', 'Sokol'] },
  { styles: ['industrial', 'western_modern', 'scrap', 'arcology'], given: ['Rafe', 'Senna', 'Corin', 'Liesel', 'Duncan', 'Ada', 'Jonah', 'Wren', 'Mara', 'Silas'],
    family: ['Quill', 'Marr', 'Hale', 'Cross', 'Stone', 'Ward'] },
  { styles: ['medieval', 'norse', 'highland'], given: ['Varo', 'Ilse', 'Brannoc', 'Edric', 'Sigrun', 'Aldo', 'Maud', 'Torvald', 'Wulf', 'Hilde', 'Osric', 'Elske'],
    family: ['Holt', 'Ashby', 'Kestrel', 'Rook', 'Fenn', 'Strand', 'Morrow', 'Harrow'] },
];
const poolOf = (style: BuildingStyle | undefined) => NAME_POOLS.find((p) => p.styles.includes(style ?? 'medieval')) ?? NAME_POOLS[NAME_POOLS.length - 1]!;

const TITLE_RE = /^(King|Queen|Speaker|Admiral|Warden|Tribune|Chancellor|Consul|Emperor|Empress|Khan|Sultan|Prince|Princess|Duke|Duchess|Elder|Captain|First Citizen|High \w+|Lord|Lady|President|Premier|Doge|Regent|Pharaoh|Shogun|Chief|General|Marshal)\b/;
const HEIR_RE = /king|queen|monarch|empire|imperial|dynast|throne|crown|sultan|khan|pharaoh|principality|duchy|realm/i;
const ELECTED_RE = /republic|council|assembly|democra|league|commune|parliament|federation|confedera|senate|concord|citizen/i;
const COUP_RE = /milit|junta|autocra|despot|tyran|warlord|horde|stratocra|dictat|martial|shogun/i;

type Namable = Pick<Country, 'id' | 'leader' | 'government' | 'buildingStyle'> & { techAge?: TechAge };

/** A general's name, from the nation's culture: "General Varo", "Captain Ilse". */
export function generalName(c: Namable, salt: string, rank = 'General'): string {
  const p = poolOf(c.buildingStyle);
  return `${rank} ${p.given[hashString(`general:${salt}`) % p.given.length]!}`;
}

/** A new ruler's name: the title the nation's rulers carry, a given name and a family name. */
export function rulerName(c: Namable, salt: string): string {
  const p = poolOf(c.buildingStyle);
  const title = TITLE_RE.exec(c.leader)?.[1]
    ?? (HEIR_RE.test(c.government) ? 'Sovereign' : ELECTED_RE.test(c.government) ? 'Speaker' : COUP_RE.test(c.government) ? 'Marshal' : 'Lord');
  return `${title} ${p.given[hashString(`ruler:${salt}`) % p.given.length]!} ${p.family[hashString(`family:${salt}`) % p.family.length]!}`;
}

const member = (name: string, tick: number, memory = ''): CouncilMember =>
  ({ name, portraitSeed: hashString(`portrait:${name}:${tick}`), since: tick, memory });

/** The council a nation starts with: its leader as ruler and a general from its culture. Deterministic from the seed. */
export function foundingCouncil(c: Namable, seed: number, tick: number): Council {
  return {
    ruler: member(c.leader, tick),
    general: member(generalName(c, `${seed}:${c.id}:${tick}`), tick),
    state: { ruler: 'active', general: 'active' },
  };
}

// ---- what the council changes in the sim -------------------------------------------------------

/** The attacker's strength multiplier: COVER_STRENGTH while the ruler covers the general. 1 without a council. */
export function coverMultiplier(world: World, countryId: number): number {
  const s = world.countries[countryId]?.council?.state.general;
  return s === 'vacant' || s === 'cut' ? COVER_STRENGTH : 1;
}

/** True when the ruler can rule: no council (old worlds), or the ruler is active or covering. */
export function rulerPresent(world: World, countryId: number): boolean {
  const s = world.countries[countryId]?.council?.state.ruler;
  return s === undefined || s === 'active' || s === 'covering';
}

/** The status changes after a change of members: an empty seat is vacant, a cut one stays cut, a
 *  present member covers when the other seat is vacant or cut, and is active otherwise. */
function statusBodies(countryId: number, before: Council, members: Record<CouncilRole, CouncilMember | null>,
  forced: Partial<Record<CouncilRole, CouncilState>> = {}): CouncilBody[] {
  const st: Record<CouncilRole, CouncilState> = { ...before.state, ...forced };
  for (const r of COUNCIL_ROLES) {
    if (!members[r]) st[r] = 'vacant';
    else if (forced[r] === undefined && st[r] === 'vacant') st[r] = 'active';
  }
  for (const r of COUNCIL_ROLES) {
    if (st[r] !== 'active' && st[r] !== 'covering') continue;
    const o = st[other(r)];
    st[r] = o === 'vacant' || o === 'cut' ? 'covering' : 'active';
  }
  return COUNCIL_ROLES.filter((r) => st[r] !== before.state[r]).map((r) => ({ type: 'council_status', countryId, role: r, state: st[r] }));
}

/** The two seats, with one optionally replaced. */
function seats(council: Council, role?: CouncilRole, m?: CouncilMember | null): Record<CouncilRole, CouncilMember | null> {
  const out: Record<CouncilRole, CouncilMember | null> = { ruler: council.ruler, general: council.general };
  if (role && m !== undefined) out[role] = m;
  return out;
}
function only(role: CouncilRole, state: CouncilState): Partial<Record<CouncilRole, CouncilState>> {
  const out: Partial<Record<CouncilRole, CouncilState>> = {};
  out[role] = state;
  return out;
}

const chronicle = (line: CouncilLine, kind: ChronicleKind, countries: number[], text: string): CouncilBody =>
  ({ type: 'chronicle', entry: { id: line.entryId, tick: line.tick, year: line.year, kind, countries, text } });

/** Who carries on after a seat empties, in words. */
function coverText(council: Council, role: CouncilRole, countryName: string): string {
  const o = council[other(role)];
  const os = council.state[other(role)];
  if (!o || os === 'vacant' || os === 'cut') return `${countryName} is left without a head.`;
  return role === 'general' ? `${o.name} takes command.` : `${o.name} holds the course until a successor is named.`;
}

/**
 * A member dies: `council_changed` member null, the statuses (the other covers, the seat is vacant)
 * and a `death` line. `place` names the battlefield for a general who fell in battle. Empty when the
 * seat is already empty.
 */
export function deathEvents(world: World, countryId: number, role: CouncilRole, cause: 'death' | 'assassination',
  line: CouncilLine, place?: string): CouncilBody[] {
  const c = world.countries[countryId];
  const council = c?.council;
  const m = council?.[role];
  if (!c || !c.alive || !council || !m) return [];
  const members = seats(council, role, null);
  const how = place ? `fell at ${mid(place)}` : cause === 'assassination' ? 'is struck down by an assassin' : 'dies';
  return [
    { type: 'council_changed', countryId, role, member: null, cause },
    ...statusBodies(countryId, council, members),
    chronicle(line, 'death', [countryId], `${m.name} of ${mid(c.name)} ${how}; ${coverText(council, role, mid(c.name))}`),
  ];
}

/** `cut_member`: the member is cut off (state `cut`) and the other covers. Empty if not present. */
export function cutEvents(world: World, countryId: number, role: CouncilRole, line: CouncilLine): CouncilBody[] {
  const c = world.countries[countryId];
  const council = c?.council;
  const m = council?.[role];
  if (!c || !c.alive || !council || !m || council.state[role] === 'cut') return [];
  return [
    { type: 'council_changed', countryId, role, member: m, cause: 'disconnect' },
    ...statusBodies(countryId, council, seats(council), only(role, 'cut')),
    chronicle(line, 'proclamation', [countryId], `No word comes from ${m.name} of ${mid(c.name)}; ${coverText(council, role, mid(c.name))}`),
  ];
}

/** `restore_member`: a cut member is back (`council_changed` cause restored) and both are active again. */
export function restoreEvents(world: World, countryId: number, role: CouncilRole, line: CouncilLine): CouncilBody[] {
  const c = world.countries[countryId];
  const council = c?.council;
  const m = council?.[role];
  if (!c || !c.alive || !council || !m || council.state[role] !== 'cut') return [];
  return [
    { type: 'council_changed', countryId, role, member: m, cause: 'restored' },
    ...statusBodies(countryId, council, seats(council), only(role, 'active')),
    chronicle(line, 'proclamation', [countryId], `${m.name} of ${mid(c.name)} is heard from again and takes up ${role === 'general' ? 'command' : 'the seat'} once more.`),
  ];
}

/**
 * A successor for an empty seat. `predecessor` is the member who held it (the runner remembers it);
 * the successor inherits its memory. A ruler's successor follows the government: an heir, an
 * election, or in a military or autocratic nation (COUP_CHANCE) the general seizes power, leaving
 * his own seat empty. Empty when the seat is not vacant.
 */
export function successionEvents(world: World, countryId: number, role: CouncilRole, predecessor: CouncilMember | undefined,
  line: CouncilLine): CouncilBody[] {
  const c = world.countries[countryId];
  const council = c?.council;
  if (!c || !c.alive || !council || council[role] || council.state[role] !== 'vacant') return [];
  const tick = line.tick;
  const salt = `${world.seed}:${countryId}:${role}:${tick}`;
  const memory = predecessor?.memory ?? '';
  const pred = predecessor?.name ?? (role === 'ruler' ? 'the old ruler' : 'the old general');
  const name = mid(c.name);
  const g = council.general;
  if (role === 'ruler' && g && council.state.general !== 'cut' && COUP_RE.test(c.government) && roll(`coup:${salt}`) < COUP_CHANCE) {
    const ruler = { ...g, since: tick, memory };
    return [
      { type: 'council_changed', countryId, role: 'ruler', member: ruler, cause: 'coup' },
      { type: 'council_changed', countryId, role: 'general', member: null, cause: 'coup' },
      ...statusBodies(countryId, council, { ruler, general: null }),
      chronicle(line, 'succession', [countryId], `${g.name} marches on the palace and seizes power in ${name}; the army rules now, by ${pred}'s old counsel.`),
    ];
  }
  const fresh = member(role === 'ruler' ? rulerName(c, salt) : generalName(c, salt, 'Captain'), tick, memory);
  const members = seats(council, role, fresh);
  const text = role === 'general'
    ? `${fresh.name} takes command of the armies of ${name} with ${pred}'s last orders.`
    : HEIR_RE.test(c.government) ? `${fresh.name} is crowned in ${name}, heir to ${pred} and keeper of the old counsel.`
      : ELECTED_RE.test(c.government) ? `${name} elects ${fresh.name} to the seat of ${pred}, and hands over the old ledgers.`
        : `${fresh.name} takes the seat of ${pred} in ${name}.`;
  return [
    { type: 'council_changed', countryId, role, member: fresh, cause: 'succession' },
    ...statusBodies(countryId, council, members),
    chronicle(line, 'succession', [countryId], text),
  ];
}

/** This year's assassinations: one seeded roll per living nation with a council (times
 *  WAR_ASSASSINATION while it is at war), then a roll for which member. Pure. */
export function assassinations(world: World, tick: number): { countryId: number; role: CouncilRole }[] {
  const out: { countryId: number; role: CouncilRole }[] = [];
  for (const c of world.countries) {
    const council = c.council;
    if (!c.alive || !council) continue;
    const present = COUNCIL_ROLES.filter((r) => council[r]);
    if (!present.length) continue;
    const war = world.relations.some((r) => r.stance === 'war' && (r.a === c.id || r.b === c.id)
      && !!world.countries[r.a === c.id ? r.b : r.a]?.alive);
    const p = ASSASSINATION_CHANCE * (war ? WAR_ASSASSINATION : 1);
    if (roll(`assassin:${world.seed}:${tick}:${c.id}`) >= p) continue;
    out.push({ countryId: c.id, role: present[hashString(`assassin-who:${world.seed}:${tick}:${c.id}`) % present.length]! });
  }
  return out;
}

/** Does the loser's general fall in this battle? Seeded by the battle; only an active general who led. */
export function generalFalls(world: World, loser: number, combined: number, seed: number): boolean {
  const council = world.countries[loser]?.council;
  if (!council?.general || (council.state.general !== 'active' && council.state.general !== 'covering')) return false;
  return combined >= GENERAL_FALL_STRENGTH && roll(`fall:${seed}`) < GENERAL_FALL_CHANCE;
}
