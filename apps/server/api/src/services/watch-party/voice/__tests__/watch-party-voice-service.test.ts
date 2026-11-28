import { expectOk } from '@kit/testing/result';
import { keyOf, ROOM_ID } from '../../__tests__/watch-party-moderation-fixture';
import { MEMBER, OWNER, userCaller } from '../../__tests__/watch-party-test-deps';
import { WatchPartyVoiceService } from '../watch-party-voice-service';
import { voiceRoom } from './voice-fixture';

describe('apps/api: WatchPartyVoiceService', () => {
  it('hands a token, a removal and a webhook to the rules over its collaborators', async () => {
    const room = await voiceRoom();
    const service = new WatchPartyVoiceService(room.voice);

    const view = expectOk(await service.token(ROOM_ID, userCaller(MEMBER), false));
    room.gateway.join(view.token);
    expectOk(await service.remove(ROOM_ID, userCaller(OWNER), keyOf(MEMBER)));
    const left = room.gateway.sign({
      type: 'participant_left',
      room: `party:${ROOM_ID}`,
      identity: keyOf(MEMBER),
    });
    expectOk(await service.webhook(left.body, left.authorization));

    expect(room.gateway.removed).toHaveLength(1);
    expect(room.published('voice')).toEqual([{ type: 'voice', state: 'off' }]);
  });
});
