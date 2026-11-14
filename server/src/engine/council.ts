// The council keeper (row A29). Assassinations, successions and the council controls change who leads a
// nation, so like secession they are decided by the world: once a year the runner asks the keeper,
// which reads the true world (seeded rolls, sim/council.ts) and returns bodies that the runner stamps
// as world events and delivers as one batch to every replica.
//
// The keeper remembers two things the World does not hold: the last member seen in each seat (a dead
// member's seat is null, but the successor inherits his memory) and the tick each seat fell empty
// (the successor comes SUCCESSION_TICKS later). Replays never need either: they apply the logged events.
import {
  COUNCIL_ROLES, SUCCESSION_TICKS, assassinations, cutEvents, deathEvents, restoreEvents, successionEvents,
  type CouncilBody, type CouncilLine, type CouncilMember, type CouncilRole, type World,
} from '@terra/shared';

export class CouncilKeeper {
  private last = new Map<string, CouncilMember>();
  private vacantSince = new Map<string, number>();
  private n = 0;

  /** A fresh chronicle line id for the world's council lines. */
  private line(w: World): CouncilLine {
    return { entryId: `c-w-council-${w.tick}-${++this.n}`, tick: w.tick, year: w.year };
  }

  /** Notes every seat as the true world now holds it. Call after every applied batch. */
  observe(w: World): void {
    for (const c of w.countries) {
      const council = c.council;
      if (!council) continue;
      for (const role of COUNCIL_ROLES) {
        const key = `${c.id}:${role}`;
        const m = council[role];
        if (m) { this.last.set(key, { ...m }); this.vacantSince.delete(key); }
        else if (council.state[role] === 'vacant' && !this.vacantSince.has(key)) this.vacantSince.set(key, w.tick);
      }
    }
  }

  /** This year's council news: successors for seats empty long enough, then assassinations.
   *  `eligible` says which nations the world may act on (alive, agent not deleted). */
  turn(w: World, tick: number, eligible: (countryId: number) => boolean): CouncilBody[] {
    this.observe(w);
    const out: CouncilBody[] = [];
    // The bodies are built against the world before this batch, so at most one change per nation a
    // year: a second empty seat waits a year, and a nation that just named a successor is spared the assassin.
    const named = new Set<number>();
    for (const [key, since] of [...this.vacantSince].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
      if (tick - since < SUCCESSION_TICKS) continue;
      const [id, role] = key.split(':') as [string, CouncilRole];
      const countryId = Number(id);
      if (!eligible(countryId) || named.has(countryId)) continue;
      const bodies = successionEvents(w, countryId, role, this.last.get(key), this.line(w));
      if (bodies.length) { out.push(...bodies); this.vacantSince.delete(key); named.add(countryId); }
    }
    for (const a of assassinations(w, tick)) {
      if (!eligible(a.countryId) || named.has(a.countryId)) continue;
      out.push(...deathEvents(w, a.countryId, a.role, 'assassination', this.line(w)));
    }
    return out;
  }

  /** The `kill` control (and decrees that kill a leader): an assassination now. */
  kill(w: World, countryId: number, role: CouncilRole): CouncilBody[] {
    this.observe(w);
    return deathEvents(w, countryId, role, 'assassination', this.line(w));
  }

  cut(w: World, countryId: number, role: CouncilRole): CouncilBody[] { return cutEvents(w, countryId, role, this.line(w)); }
  restore(w: World, countryId: number, role: CouncilRole): CouncilBody[] { return restoreEvents(w, countryId, role, this.line(w)); }
}
