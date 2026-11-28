import { assertNever, isErr, ok, type Result } from '@kit/result';
import type { VoiceWebhookRejected } from '@vp/errors';
import { announce } from '../watch-party-moderation-effects';
import type { VoiceServiceDeps } from './voice-deps';
import { roomIdOfVoiceRoom, voiceRoomOf } from './voice-room';

/**
 * LiveKit reports who joined and left. A join settles that member's grants and tells their socket
 * its voice state; a leave tells it `off`, and an empty room stops being watched.
 */
export async function receiveVoiceWebhook(
  deps: VoiceServiceDeps,
  body: string,
  authorization: string | undefined
): Promise<Result<void, VoiceWebhookRejected>> {
  const verified = await deps.gateway.verifyWebhook(body, authorization);
  if (isErr(verified)) return verified;

  const event = verified.value;
  switch (event.type) {
    case 'participant_joined': {
      const roomId = roomIdOfVoiceRoom(event.room);
      if (roomId === null) return ok();
      deps.enforcement.watch(roomId);
      const synced = await deps.enforcement.sync(roomId, { only: event.identity, announce: true });
      if (isErr(synced)) deps.logger.warn({ err: synced.error, roomId }, 'voice join not settled');
      return ok();
    }
    case 'participant_left': {
      const roomId = roomIdOfVoiceRoom(event.room);
      if (roomId === null) return ok();
      await announce(deps, roomId, { type: 'voice', state: 'off' }, event.identity);
      const remaining = await deps.gateway.listParticipants(voiceRoomOf(roomId));
      if (!isErr(remaining) && remaining.value.length === 0) deps.enforcement.unwatch(roomId);
      return ok();
    }
    case 'ignored':
      return ok();
    default:
      return assertNever(event, 'VoiceWebhookEvent');
  }
}
