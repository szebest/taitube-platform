import type { PresentMember } from '@vp/core/ports';
import { MEMBER_KINDS, parseMemberKey, WATCH_PARTY_PHASES, type WatchPartyRoom } from '@vp/domain';
import type { WatchPartyMetrics } from '@vp/observability';

/** What one sweep pass saw: open rooms by phase and members present by kind. */
export interface SweepTally {
  readonly phases: Map<string, number>;
  readonly kinds: Map<string, number>;
}

export const emptyTally = (): SweepTally => ({ phases: new Map(), kinds: new Map() });

export function addToTally(
  tally: SweepTally,
  room: Pick<WatchPartyRoom, 'phase'>,
  present: readonly PresentMember[]
): void {
  tally.phases.set(room.phase, (tally.phases.get(room.phase) ?? 0) + 1);
  for (const { memberKey } of present) {
    const kind = parseMemberKey(memberKey)?.kind ?? 'unknown';
    tally.kinds.set(kind, (tally.kinds.get(kind) ?? 0) + 1);
  }
}

/** A phase or kind nobody holds is set to zero, so a gauge never keeps a number from an earlier pass. */
export function publishTally(
  { phases, kinds }: SweepTally,
  { watchPartyRooms, watchPartyPresentMembers }: WatchPartyMetrics
): void {
  for (const phase of WATCH_PARTY_PHASES) watchPartyRooms.set({ phase }, phases.get(phase) ?? 0);
  for (const kind of MEMBER_KINDS) watchPartyPresentMembers.set({ kind }, kinds.get(kind) ?? 0);
}
