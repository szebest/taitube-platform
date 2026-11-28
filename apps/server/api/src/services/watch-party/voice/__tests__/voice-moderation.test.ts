import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import { assignRole } from '../../__tests__/watch-party-access-fixture';
import { keyOf, ROOM_ID } from '../../__tests__/watch-party-moderation-fixture';
import { MEMBER, OTHER, OWNER, userCaller } from '../../__tests__/watch-party-test-deps';
import { removeFromVoice } from '../voice-moderation';
import { mintVoiceToken } from '../voice-token';
import { voiceRoom } from './voice-fixture';

const ROOM = `party:${ROOM_ID}`;

describe('apps/api: removeFromVoice', () => {
  it('disconnects a member below a moderator from voice and leaves their seat', async () => {
    const room = await voiceRoom();
    await assignRole(room, ROOM_ID, keyOf(MEMBER), 'moderator');
    const view = expectOk(await mintVoiceToken(room.voice, ROOM_ID, userCaller(OTHER), false));
    room.gateway.join(view.token);

    expectOk(await removeFromVoice(room.voice, ROOM_ID, userCaller(MEMBER), keyOf(OTHER)));

    expect(room.gateway.removed).toEqual([{ room: ROOM, identity: keyOf(OTHER) }]);
    const seat = expectOk(await room.repositories.watchPartyMembers.find(ROOM_ID, keyOf(OTHER)));
    expect(seat?.leftAt).toBeNull();
  });

  it.each([
    {
      scenario: 'a member without voice.moderate',
      actor: OTHER,
      target: MEMBER,
      code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
    },
    {
      scenario: 'a moderator reaching the owner',
      actor: MEMBER,
      target: OWNER,
      code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    },
  ])('refuses $scenario', async ({ actor, target, code }) => {
    const room = await voiceRoom();
    await assignRole(room, ROOM_ID, keyOf(MEMBER), 'moderator');

    const refused = await removeFromVoice(room.voice, ROOM_ID, userCaller(actor), keyOf(target));

    expect(expectErr(refused).code).toBe(code);
    expect(room.gateway.removed).toEqual([]);
  });
});
