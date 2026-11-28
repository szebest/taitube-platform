import { err, isErr, ok, type Result } from '@kit/result';
import { type AuthorizationFailure, authorize } from '@vp/domain-rules';
import { type DatabaseUnavailable, watchPartyClosed, type WatchPartyClosed } from '@vp/errors';
import { type InvalidField, invalidField } from '@vp/validation';
import type { PartyCaller } from './party-caller';
import type { WatchPartyDeps } from './watch-party-deps';
import { type PreviewFailure, roomAccessOf } from './watch-party-preview';

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
