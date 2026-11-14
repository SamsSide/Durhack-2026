// Local mirror of the council contract (docs/contracts.md, row A29). These types go away when A29 lands in @terra/shared.
export type CouncilRole = 'ruler' | 'general';
export type CouncilState = 'active' | 'covering' | 'vacant' | 'cut';
export type CouncilCause = 'founded' | 'death' | 'assassination' | 'disconnect' | 'succession' | 'coup' | 'restored';
export interface CouncilMember { name: string; portraitSeed: number; since: number; memory: string }
export interface CouncilData {
  ruler: CouncilMember | null; general: CouncilMember | null;
  state: Record<CouncilRole, CouncilState>;
}
export interface CouncilChanged { type: 'council_changed'; countryId: number; role: CouncilRole; member: CouncilMember | null; cause: CouncilCause }
export interface CouncilStatus { type: 'council_status'; countryId: number; role: CouncilRole; state: CouncilState }
