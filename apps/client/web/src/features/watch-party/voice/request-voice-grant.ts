import { type Result, fromPromise, isOk, ok } from '@kit/result';
import type { ApiClient } from '@vp/api-client';
import { type ErrorCode, ErrorCodes } from '@vp/errors';
import { failureCode } from '@vp/queries';

interface VoiceTokenApi {
  watchPartyVoice: Pick<ApiClient['watchPartyVoice'], 'createWatchPartyVoiceToken'>;
}

export interface VoiceGrant {
  url: string;
  token: string;
  canSpeak: boolean;
  speakersFull: boolean;
}

/** A token for the room's voice; with the speaker list full the same call is asked again as a listener. */
export async function requestVoiceGrant(
  api: VoiceTokenApi,
  roomId: string
): Promise<Result<VoiceGrant, ErrorCode>> {
  const ask = (listenOnly: boolean) =>
    fromPromise(
      () =>
        api.watchPartyVoice.createWatchPartyVoiceToken({
          params: { id: roomId },
          body: listenOnly ? { listenOnly } : undefined,
        }),
      failureCode
    );

  const first = await ask(false);
  if (isOk(first)) {
    return ok({ ...first.value, speakersFull: false });
  }
  if (first.error !== ErrorCodes.WATCH_PARTY_VOICE_SPEAKERS_FULL) {
    return first;
  }

  const listener = await ask(true);
  return isOk(listener) ? ok({ ...listener.value, speakersFull: true }) : listener;
}
