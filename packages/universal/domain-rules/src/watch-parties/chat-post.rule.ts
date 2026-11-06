import type { WatchPartyRoom } from '@vp/domain';
import {
  type WatchPartyChatOff,
  type WatchPartyPermissionMissing,
  watchPartyChatOff,
} from '@vp/errors';
import { canInRoom, type WatchPartyAbility } from '@vp/permissions';
import { andThen, err, ok, type Result } from '@vp/result';
import { requireRoomPermission } from './permission.rule';

export interface WatchPartyChatPostInput {
  readonly room: Pick<WatchPartyRoom, 'id' | 'chatEnabled' | 'slowModeSeconds'>;
  readonly ability: WatchPartyAbility;
}

/** How long this sender waits between lines: the room's slow mode, or none past it. */
export interface WatchPartyChatPostGrant {
  readonly slowModeSeconds: number;
}

/** Chat off stops everyone; then the line needs `chat.post`, and `chat.bypassSlowMode` skips the wait. */
export function decideWatchPartyChatPost({
  room,
  ability,
}: WatchPartyChatPostInput): Result<
  WatchPartyChatPostGrant,
  WatchPartyChatOff | WatchPartyPermissionMissing
> {
  if (!room.chatEnabled) return err(watchPartyChatOff(room.id));
  return andThen(requireRoomPermission(ability, 'chat.post'), () =>
    ok({ slowModeSeconds: canInRoom(ability, 'chat.bypassSlowMode') ? 0 : room.slowModeSeconds })
  );
}
