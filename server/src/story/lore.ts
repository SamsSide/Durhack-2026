// Template lore built from a country's fields and its real chronicle entries (mock mode).
import { regionOwner, relationOf, type World } from '@terra/shared';

export function countryLore(world: World, id: number) {
  const c = world.countries[id];
  if (!c) return null;
  const mine = world.chronicle.filter((e) => e.countries.includes(id));
  const history = mine.length
    ? mine.slice(-6).map((e) => `In year ${e.year}: ${e.text}`).join(' ')
    : `${c.name} has no recorded history yet.`;
  const relations = world.countries
    .filter((o) => o.id !== id)
    .map((o) => ({ o, r: relationOf(world, id, o.id) }))
    .filter(({ r }) => r.stance !== 'neutral')
    .map(({ o, r }) => {
      const shared = world.chronicle.filter((e) => e.countries.includes(id) && e.countries.includes(o.id)).slice(-1)[0];
      return {
        with: o.id, stance: r.stance,
        story: shared ? shared.text : `${c.name} and ${o.name} have stood in a state of ${r.stance} since year ${world.year - (world.tick - r.since)}.`,
      };
    });
  return {
    countryId: id,
    asOfTick: world.tick,
    summary: `${c.name} is a ${c.government} led by ${c.leader}. ${c.alive ? `It holds ${world.owner.filter((o) => o === id).length} provinces.` : 'It has fallen.'}`,
    culture: `The people of ${c.name} are known for ${c.culture.join(', ')}. ${c.foundingMyth}`,
    politics: `${c.leader} rules as a ${c.government}. ${c.ideology}`,
    history,
    anthemLyrics: [
      `Rise, ${c.adjective} hearts, beneath the open sky`,
      c.foundingMyth.split('.')[0] ?? c.name,
      `We keep the old ways of ${c.culture[0] ?? 'our fathers'}`,
      `${c.name}, we stand, we stand`,
    ],
    relations,
  };
}

export function regionLore(world: World, id: number) {
  const r = world.regions[id];
  if (!r) return null;
  const owner = regionOwner(world, id);
  const oc = world.countries[owner];
  return {
    regionId: id,
    name: r.name || `Unsettled region ${id}`,
    owner,
    summary: oc ? `${r.name || 'This region'} lies under ${oc.name}, ${r.tiles.length} provinces of ${r.unrest > 0.5 ? 'restless' : 'quiet'} land.` : `${r.name || 'This region'} belongs to no one.`,
    history: world.chronicle.filter((e) => e.text.includes(r.name) && r.name).map((e) => e.text).join(' ') || 'Nothing has been written about this place yet.',
  };
}
