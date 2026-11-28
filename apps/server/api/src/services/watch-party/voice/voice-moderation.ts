import { andThenAsync, type Result } from '@kit/result';
import { decideMemberAction } from '@vp/domain-rules';
import type {
  DatabaseUnavailable,
  VoiceUnavailable,
  WatchPartyNotFound,
  WatchPartyPermissionMissing,
  WatchPartyRoleEscalation,
} from '@vp/errors';
import type { PartyCaller } from '../party-caller';
import { actingInRoom, resolveTarget } from '../watch-party-member-targets';
import type { VoiceServiceDeps } from './voice-deps';
import { voiceRoomOf } from './voice-room';

type RemoveFailure =
  | WatchPartyNotFound
  | WatchPartyPermissionMissing
  | WatchPartyRoleEscalation
  | VoiceUnavailable
  | DatabaseUnavailable;

/** Disconnects a member below the actor from voice only: their seat in the room stays. */
export function removeFromVoice(
  deps: VoiceServiceDeps,
  roomId: string,
  caller: PartyCaller,
  memberKey: string
): Promise<Result<void, RemoveFailure>> {
  return actingInRoom(deps.context, roomId, caller, async (context, actorKey) => {
    const resolved = await resolveTarget(deps, context, memberKey, 'held');
    return andThenAsync(resolved, ({ subject }) =>
      andThenAsync(
        decideMemberAction({
          ability: context.ability,
          actorKey,
          action: 'voice',
          target: subject,
        }),
        () => deps.gateway.removeParticipant(voiceRoomOf(roomId), memberKey)
      )
    );
  });
}
