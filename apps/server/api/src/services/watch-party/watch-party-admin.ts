import { assertNever, err, isErr, map, type Result } from '@kit/result';
import type { WatchPartyView } from '@vp/api-contracts';
import { memberKeyOf } from '@vp/domain';
import { type AuthorizationFailure, authorize } from '@vp/domain-rules';
import {
  type DatabaseUnavailable,
  type WatchPartyClosed,
  type WatchPartyNotFound,
  watchPartyClosed,
  watchPartyNotFound,
} from '@vp/errors';
import { canModerateWatchParties } from '@vp/permissions';
import type { PartyCaller } from './party-caller';
import type { WatchPartyDeps } from './watch-party-deps';
import { announce, logChange } from './watch-party-moderation-effects';
import { presentRoom } from './watch-party-room-views';

type AdminFailure = AuthorizationFailure | WatchPartyNotFound | DatabaseUnavailable;

function moderator(
  caller: PartyCaller,
  action: 'close' | 'restore'
): Result<string, AuthorizationFailure> {
  const actor = authorize(caller.user, canModerateWatchParties(caller.user), {
    action,
    subject: 'WatchParty',
  });
  return map(actor, ({ id }) => memberKeyOf({ kind: 'user', userId: id }));
}

export async function adminCloseRoom(
  deps: WatchPartyDeps,
  roomId: string,
  caller: PartyCaller
): Promise<Result<WatchPartyView, AdminFailure | WatchPartyClosed>> {
  const actorKey = moderator(caller, 'close');
  if (isErr(actorKey)) return actorKey;

  const written = await deps.repositories.watchPartyRooms.close(
    roomId,
    'moderator',
    null,
    deps.now()
  );
  if (isErr(written)) return written;
  switch (written.value.type) {
    case 'applied': {
      const view = await presentRoom(deps, written.value.room);
      if (isErr(view)) return view;
      await announce(deps, roomId, { type: 'closed', reason: 'moderator' });
      logChange(deps, { roomId, actorKey: actorKey.value, action: 'admin.close' });
      return view;
    }
    case 'stale':
      return err(watchPartyClosed(roomId));
    case 'missing':
      return err(watchPartyNotFound(roomId));
    default:
      return assertNever(written.value, 'RoomWrite');
  }
}

export async function adminRestoreRoom(
  deps: WatchPartyDeps,
  roomId: string,
  caller: PartyCaller
): Promise<Result<WatchPartyView, AdminFailure>> {
  const actorKey = moderator(caller, 'restore');
  if (isErr(actorKey)) return actorKey;

  const restored = await deps.repositories.watchPartyReports.restore(roomId, deps.now());
  if (isErr(restored)) return restored;
  if (!restored.value) return err(watchPartyNotFound(roomId));
  const room = await deps.repositories.watchPartyRooms.findById(roomId);
  if (isErr(room)) return room;
  if (room.value === null) return err(watchPartyNotFound(roomId));
  logChange(deps, { roomId, actorKey: actorKey.value, action: 'admin.restore' });
  return presentRoom(deps, room.value);
}
