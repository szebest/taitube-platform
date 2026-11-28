import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import { keyOf, ROOM_ID } from '../../__tests__/watch-party-moderation-fixture';
import { MEMBER, OWNER, userCaller } from '../../__tests__/watch-party-test-deps';
import { mintVoiceToken } from '../voice-token';
import { receiveVoiceWebhook } from '../voice-webhook';
import { voiceRoom } from './voice-fixture';

const ROOM = `party:${ROOM_ID}`;

describe('apps/api: receiveVoiceWebhook', () => {
  it.each([
    { canSpeak: true, state: 'live' },
    { canSpeak: false, state: 'listening' },
  ])('tells a joining member their voice state is $state', async ({ canSpeak, state }) => {
    const room = await voiceRoom();
    const view = expectOk(await mintVoiceToken(room.voice, ROOM_ID, userCaller(MEMBER), !canSpeak));
    room.gateway.join(view.token);
    const signed = room.gateway.sign({
      type: 'participant_joined',
      room: ROOM,
      identity: keyOf(MEMBER),
      canPublish: canSpeak,
    });

    expectOk(await receiveVoiceWebhook(room.voice, signed.body, signed.authorization));

    expect(room.published('voice')).toEqual([{ type: 'voice', state }]);
  });

  it('tells a leaving member `off`, and stops watching an empty room', async () => {
    const room = await voiceRoom();
    const watch = vi.spyOn(room.enforcement, 'unwatch');
    const signed = room.gateway.sign({
      type: 'participant_left',
      room: ROOM,
      identity: keyOf(OWNER),
    });

    expectOk(await receiveVoiceWebhook(room.voice, signed.body, signed.authorization));

    expect(room.published('voice')).toEqual([{ type: 'voice', state: 'off' }]);
    expect(watch).toHaveBeenCalledWith(ROOM_ID);
  });

  it('takes an event for another room as nothing to do', async () => {
    const room = await voiceRoom();
    const signed = room.gateway.sign({
      type: 'participant_left',
      room: 'elsewhere',
      identity: 'x',
    });

    expectOk(await receiveVoiceWebhook(room.voice, signed.body, signed.authorization));

    expect(room.published('voice')).toEqual([]);
  });

  it.each([
    { scenario: 'a body the signature does not cover', tamper: (body: string) => `${body} ` },
    { scenario: 'no signature', tamper: undefined },
  ])('refuses $scenario as unauthorised', async ({ tamper }) => {
    const room = await voiceRoom();
    const signed = room.gateway.sign({
      type: 'participant_left',
      room: ROOM,
      identity: keyOf(OWNER),
    });

    const refused = await receiveVoiceWebhook(
      room.voice,
      tamper === undefined ? signed.body : tamper(signed.body),
      tamper === undefined ? undefined : signed.authorization
    );

    expect(expectErr(refused).code).toBe(ErrorCodes.UNAUTHORIZED);
    expect(room.published('voice')).toEqual([]);
  });
});
