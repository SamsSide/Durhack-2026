// Which nations are cut or deleted, as the map colouring and the status layers see them. Lane b (B7).
import type { AgentStatus } from '@terra/shared';

export type NationStatus = 'cut' | 'deleted';

const byCountry = new Map<number, NationStatus>();
let signature = '';

/** Store the statuses of these agents. Returns true when anything the map shows changed. */
export function setStatuses(agents: ReadonlyArray<AgentStatus>): boolean {
  let sig = '';
  const next = new Map<number, NationStatus>();
  for (const a of agents) {
    const st: NationStatus | null = a.deleted ? 'deleted' : a.link === 'cut' ? 'cut' : null;
    if (st) { next.set(a.countryId, st); sig += `${a.countryId}${st[0]},`; }
  }
  if (sig === signature) return false;
  signature = sig;
  byCountry.clear();
  for (const [k, v] of next) byCountry.set(k, v);
  return true;
}

export function statusOf(countryId: number): NationStatus | undefined {
  return byCountry.get(countryId);
}
