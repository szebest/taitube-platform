import { WATCH_PARTY_LIMITS, type WatchPartyQueueItem } from '@vp/domain';
import { requireRoomPermission } from '@vp/domain-rules';
import { type WatchPartyPermissionMissing, watchPartyPermissionMissing } from '@vp/errors';
import { canInRoom, type WatchPartyAbility } from '@vp/permissions';
import { err, ok, type Result } from '@vp/result';

/** A member holding `queue.add` alone keeps a few items pending; `queue.reorder` lifts the cap. */
export function decideQueuePending(input: {
  readonly ability: WatchPartyAbility;
  readonly pending: number;
  readonly adding: number;
}): Result<void, WatchPartyPermissionMissing> {
  const { ability, pending, adding } = input;
  return canInRoom(ability, 'queue.reorder') ||
    pending + adding <= WATCH_PARTY_LIMITS.pendingItemsPerMember
    ? ok()
    : err(watchPartyPermissionMissing('queue.reorder'));
}

/** Anyone's item goes with `queue.remove`; one's own item that has not played, with `queue.add`. */
export function decideQueueRemove(input: {
  readonly ability: WatchPartyAbility;
  readonly memberKey: string;
  readonly item: Pick<WatchPartyQueueItem, 'addedBy' | 'playedAt'>;
}): Result<void, WatchPartyPermissionMissing> {
  const { ability, memberKey, item } = input;
  const own =
    canInRoom(ability, 'queue.add') && item.addedBy === memberKey && item.playedAt === null;
  if (own) return ok();
  const required = requireRoomPermission(ability, 'queue.remove');
  return required.ok ? ok() : required;
}
