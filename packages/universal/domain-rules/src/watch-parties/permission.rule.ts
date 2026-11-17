import { err, ok, type Result } from '@kit/result';
import type { WatchPartyPermission } from '@vp/domain';
import { type WatchPartyPermissionMissing, watchPartyPermissionMissing } from '@vp/errors';
import { canInRoom, type WatchPartyAbility } from '@vp/permissions';

/** The gate every room action passes first: the permission it needs, named when missing. */
export function requireRoomPermission(
  ability: WatchPartyAbility,
  permission: WatchPartyPermission
): Result<WatchPartyPermission, WatchPartyPermissionMissing> {
  return canInRoom(ability, permission)
    ? ok(permission)
    : err(watchPartyPermissionMissing(permission));
}
