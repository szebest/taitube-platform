import { isOk } from '@kit/result';
import { ApiError } from '@vp/api-client';
import { ErrorCodes } from '@vp/errors';
import { requestVoiceGrant } from '../request-voice-grant';

const TOKEN = {
  url: 'ws://livekit',
  token: 't',
  expiresAt: '2030-01-01T00:00:00.000Z',
  canSpeak: false,
};

describe('apps/client/web: asking for a voice token', () => {
  it('asks again as a listener when the speakers are full, and says so', async () => {
    const createWatchPartyVoiceToken = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(409, ErrorCodes.WATCH_PARTY_VOICE_SPEAKERS_FULL, 'full'))
      .mockResolvedValueOnce(TOKEN);
    const api = { watchPartyVoice: { createWatchPartyVoiceToken } };

    const granted = await requestVoiceGrant(api, 'room');

    expect(isOk(granted) && granted.value).toMatchObject({ canSpeak: false, speakersFull: true });
    expect(createWatchPartyVoiceToken).toHaveBeenLastCalledWith({
      params: { id: 'room' },
      body: { listenOnly: true },
    });
  });
});
