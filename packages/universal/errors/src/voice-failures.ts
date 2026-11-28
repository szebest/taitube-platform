import { type Failure, type Unavailable, unavailable } from '@kit/errors';
import { ErrorCodes } from './error-codes';

/** The media server did not answer: joining voice or changing a grant can be tried again. */
export type VoiceUnavailable = Unavailable<typeof ErrorCodes.WATCH_PARTY_VOICE_UNAVAILABLE>;

export const voiceUnavailable = unavailable(
  ErrorCodes.WATCH_PARTY_VOICE_UNAVAILABLE,
  'Voice unavailable'
);

export type VoiceSpeakersFull = Failure<
  typeof ErrorCodes.WATCH_PARTY_VOICE_SPEAKERS_FULL,
  { roomId: string; maxSpeakers: number }
>;

export function voiceSpeakersFull(roomId: string, maxSpeakers: number): VoiceSpeakersFull {
  return {
    code: ErrorCodes.WATCH_PARTY_VOICE_SPEAKERS_FULL,
    message: 'Speakers are full',
    roomId,
    maxSpeakers,
  };
}

/** A webhook whose signature or body the media server's key does not vouch for. */
export type VoiceWebhookRejected = Failure<typeof ErrorCodes.UNAUTHORIZED, { reason: string }>;

export function voiceWebhookRejected(reason: string): VoiceWebhookRejected {
  return { code: ErrorCodes.UNAUTHORIZED, message: 'Voice webhook rejected', reason };
}
