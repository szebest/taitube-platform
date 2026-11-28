import { andThenAsync, err, isErr, ok, type Result } from '@kit/result';
import type { createWatchPartyVoiceToken } from '@vp/api-contracts';
import { requireRoomPermission } from '@vp/domain-rules';
import {
  type DatabaseUnavailable,
  type VoiceSpeakersFull,
  type VoiceUnavailable,
  type WatchPartyClosed,
  type WatchPartyNotFound,
  type WatchPartyPermissionMissing,
  voiceSpeakersFull,
  watchPartyClosed,
} from '@vp/errors';
import type { z } from 'zod';
import type { PartyCaller } from '../party-caller';
import { resolvePeople } from '../watch-party-names';
import { actingAsMember } from '../watch-party-seated-actions';
import type { VoiceServiceDeps } from './voice-deps';
import { voiceGrantsOf } from './voice-grants';
import { voiceRoomOf } from './voice-room';

export type VoiceTokenView = z.output<typeof createWatchPartyVoiceToken.result>;

export type VoiceTokenFailure =
  | WatchPartyNotFound
  | WatchPartyClosed
  | WatchPartyPermissionMissing
  | VoiceSpeakersFull
  | VoiceUnavailable
  | DatabaseUnavailable;

async function speakersFull(
  deps: VoiceServiceDeps,
  roomId: string,
  memberKey: string
): Promise<Result<boolean, VoiceUnavailable>> {
  const listed = await deps.gateway.listParticipants(voiceRoomOf(roomId));
  if (isErr(listed)) return listed;
  const others = listed.value.filter(
    ({ identity, grants }) => identity !== memberKey && grants.canPublish
  );
  return ok(others.length >= deps.voice.maxSpeakers);
}

/**
 * A listener's token needs `voice.join`; a speaker's `voice.speak` on top, the room's cap on
 * speakers not yet reached, and a seat that is not a guest's. The grants come from the roles, so
 * what the token says is what the SFU enforces.
 */
export function mintVoiceToken(
  deps: VoiceServiceDeps,
  roomId: string,
  caller: PartyCaller,
  listenOnly: boolean
): Promise<Result<VoiceTokenView, VoiceTokenFailure>> {
  return actingAsMember(
    deps.context,
    roomId,
    caller,
    async (context, memberKey): Promise<Result<VoiceTokenView, VoiceTokenFailure>> => {
      const joined = requireRoomPermission(context.ability, 'voice.join');
      if (isErr(joined)) return joined;

      const canSpeak = voiceGrantsOf(context.effective).canPublish && !listenOnly;
      if (canSpeak) {
        const full = await speakersFull(deps, roomId, memberKey);
        if (isErr(full)) return full;
        if (full.value) return err(voiceSpeakersFull(roomId, deps.voice.maxSpeakers));
      }

      const people = await resolvePeople(
        deps.repositories.channels,
        [memberKey],
        context.seat === null ? undefined : new Map([[memberKey, context.seat]])
      );
      return andThenAsync(people, async (personOf) => {
        const minted = await deps.gateway.mintToken({
          room: voiceRoomOf(roomId),
          identity: memberKey,
          name: personOf(memberKey).name,
          grants: { canSubscribe: true, canPublish: canSpeak },
          ttlSeconds: deps.voice.tokenTtlSeconds,
        });
        if (isErr(minted)) return minted;
        deps.enforcement.watch(roomId);
        return ok({
          url: deps.voice.url,
          token: minted.value,
          expiresAt: new Date(
            deps.now().getTime() + deps.voice.tokenTtlSeconds * 1000
          ).toISOString(),
          canSpeak,
        });
      });
    },
    watchPartyClosed
  );
}
