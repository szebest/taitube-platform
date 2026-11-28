import { err, isErr, ok, type Result } from '@kit/result';
import type { WatchPartyView } from '@vp/api-contracts';
import { memberKeyOf, type WatchPartyRoom } from '@vp/domain';
import { type AuthorizationFailure, authorize } from '@vp/domain-rules';
import { type DatabaseUnavailable, watchPartyClosed, type WatchPartyClosed } from '@vp/errors';
import { type InvalidField, invalidField } from '@vp/validation';
import type { PartyCaller } from './party-caller';
import type { WatchPartyDeps } from './watch-party-deps';
import { type PreviewFailure, roomAccessOf } from './watch-party-preview';
import { presentRooms } from './watch-party-room-views';

export type InterestFailure =
  | AuthorizationFailure
  | PreviewFailure
  | WatchPartyClosed
  | InvalidField
  | DatabaseUnavailable;

/** Any account that can see the room; only a scheduled, open room can be marked, and clearing is always allowed. */
export async function setInterest(
  deps: WatchPartyDeps,
  roomId: string,
  caller: PartyCaller,
  interested: boolean
): Promise<Result<void, InterestFailure>> {
  const { repositories, context, now } = deps;
  const actor = authorize(caller.user, true, { action: 'read', subject: 'WatchParty' });
  if (isErr(actor)) return actor;
  const loaded = await context.load(roomId, caller);
  if (isErr(loaded)) return loaded;
  const access = await roomAccessOf(deps, loaded.value, undefined);
  if (isErr(access)) return access;

  if (!interested) return repositories.watchPartyInterest.remove(roomId, actor.value.id);
  const { room } = loaded.value;
  if (room.status === 'closed') return err(watchPartyClosed(roomId));
  if (room.scheduledFor === null) {
    return err(invalidField('scheduledFor', 'only a scheduled party can be marked', {}));
  }
  const added = await repositories.watchPartyInterest.add(roomId, actor.value.id, now());
  return isErr(added) ? added : ok();
}

/**
 * The open rooms the account is interested in and may still see: one that turned private, or
 * banned the account, since it was marked is dropped, as the preview would answer it 404 or 403.
 */
export async function interestedRooms(
  deps: WatchPartyDeps,
  caller: PartyCaller,
  userId: string,
  alreadyListed: ReadonlySet<string>
): Promise<Result<WatchPartyView[], DatabaseUnavailable>> {
  const { repositories, context, logger } = deps;
  const ids = await repositories.watchPartyInterest.openRoomIdsOf(userId);
  if (isErr(ids)) return ids;

  const visible: WatchPartyRoom[] = [];
  for (const id of ids.value.filter((each) => !alreadyListed.has(each))) {
    const loaded = await context.load(id, caller);
    const access = isErr(loaded) ? loaded : await roomAccessOf(deps, loaded.value, undefined);
    const banned = await repositories.watchPartyMembers.isBanned(
      id,
      memberKeyOf({ kind: 'user', userId }),
      null
    );
    if (isErr(loaded) || isErr(access) || isErr(banned)) {
      logger.warn({ roomId: id }, 'interested room not listed');
      continue;
    }
    if (!banned.value) visible.push(loaded.value.room);
  }
  return presentRooms(deps, visible);
}
