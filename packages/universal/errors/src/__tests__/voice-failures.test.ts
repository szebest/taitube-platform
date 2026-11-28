import { ErrorCodes } from '../error-codes';
import { RETRY_CLASS } from '../retry-class';
import { voiceSpeakersFull, voiceUnavailable, voiceWebhookRejected } from '../voice-failures';

describe('@vp/errors: voice failures', () => {
  it('reports an unreachable media server as transient, with what it was doing', () => {
    const failure = voiceUnavailable('mint', new Error('ECONNREFUSED'));

    expect(failure).toMatchObject({
      code: ErrorCodes.WATCH_PARTY_VOICE_UNAVAILABLE,
      operation: 'mint',
    });
    expect(RETRY_CLASS[failure.code]).toBe('transient');
  });

  it('carries the cap a full speaker list was refused at', () => {
    expect(voiceSpeakersFull('room-1', 12)).toMatchObject({
      code: ErrorCodes.WATCH_PARTY_VOICE_SPEAKERS_FULL,
      roomId: 'room-1',
      maxSpeakers: 12,
    });
  });

  it('refuses a webhook as unauthorised, with why', () => {
    expect(voiceWebhookRejected('signature')).toMatchObject({
      code: ErrorCodes.UNAUTHORIZED,
      reason: 'signature',
    });
  });
});
