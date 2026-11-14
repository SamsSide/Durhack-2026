// The council contract comes from @terra/shared (row A29); only the event shapes are named here.
import type { Base, WorldEvent } from '@terra/shared';
export type { Council, CouncilMember, CouncilRole, CouncilState } from '@terra/shared';
export type CouncilChanged = Omit<Extract<WorldEvent, { type: 'council_changed' }>, keyof Base>;
export type CouncilStatus = Omit<Extract<WorldEvent, { type: 'council_status' }>, keyof Base>;
export type CouncilCause = CouncilChanged['cause'];
