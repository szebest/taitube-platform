import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import { assignRoleId, guestSession } from '../../__tests__/watch-party-access-fixture';
import {
  GUEST_KEY,
  keyOf,
  ROOM_ID,
  roleIdsOf,
} from '../../__tests__/watch-party-moderation-fixture';
import { MEMBER, OWNER, userCaller } from '../../__tests__/watch-party-test-deps';
import { mintVoiceToken } from '../voice-token';
import { claimsOf, voiceRoom } from './voice-fixture';

const guestCaller = { user: null, party: guestSession('abcdefghijklmnop'), ip: '203.0.113.7' };

describe('apps/api: mintVoiceToken', () => {
  it.each([
    { scenario: 'a friends-room member', preset: 'friends', role: null, canSpeak: true },
    { scenario: 'a public-room member', preset: 'public', role: null, canSpeak: false },
    { scenario: 'a public-room Speaker', preset: 'public', role: 'speaker', canSpeak: true },
    {
      scenario: 'a friends-room member who is Voice muted',
      preset: 'friends',
      role: 'voice_muted',
      canSpeak: false,
    },
  ] as const)('grants $scenario canPublish=$canSpeak', async ({ preset, role, canSpeak }) => {
    const room = await voiceRoom({ preset });
    if (role !== null) {
      const ids = await roleIdsOf(room.repositories, room.deps.now());
      await assignRoleId(room, ROOM_ID, keyOf(MEMBER), ids[role]);
    }

    const view = expectOk(await mintVoiceToken(room.voice, ROOM_ID, userCaller(MEMBER), false));

    expect(view.canSpeak).toBe(canSpeak);
    expect(claimsOf(view.token)).toMatchObject({
      room: `party:${ROOM_ID}`,
      identity: keyOf(MEMBER),
      grants: { canSubscribe: true, canPublish: canSpeak },
      ttlSeconds: 600,
    });
  });

  it('keeps a guest a listener whatever the room allows', async () => {
    const room = await voiceRoom({ preset: 'friends' });

    const view = expectOk(await mintVoiceToken(room.voice, ROOM_ID, guestCaller, false));

    expect(view.canSpeak).toBe(false);
    expect(claimsOf(view.token)).toMatchObject({
      identity: GUEST_KEY,
      grants: { canSubscribe: true, canPublish: false },
    });
  });

  it('answers the token with the url, the expiry and a listener when asked to only listen', async () => {
    const room = await voiceRoom();

    const view = expectOk(await mintVoiceToken(room.voice, ROOM_ID, userCaller(MEMBER), true));

    expect(view).toMatchObject({
      url: 'ws://localhost:7880',
      canSpeak: false,
      expiresAt: new Date(room.deps.now().getTime() + 600_000).toISOString(),
    });
  });

  it('refuses a speaker once the room holds the cap, and still lets them listen', async () => {
    const room = await voiceRoom({ config: { voice: { maxSpeakers: 1 } } });
    const owner = expectOk(await mintVoiceToken(room.voice, ROOM_ID, userCaller(OWNER), false));
    room.gateway.join(owner.token);

    const full = expectErr(await mintVoiceToken(room.voice, ROOM_ID, userCaller(MEMBER), false));
    const listener = expectOk(await mintVoiceToken(room.voice, ROOM_ID, userCaller(MEMBER), true));

    expect(full).toMatchObject({
      code: ErrorCodes.WATCH_PARTY_VOICE_SPEAKERS_FULL,
      maxSpeakers: 1,
    });
    expect(listener.canSpeak).toBe(false);
  });

  it('turns a stranger away as the room not existing', async () => {
    const room = await voiceRoom();
    const stranger = userCaller({ id: '00000000-0000-7000-8000-00000000f0aa', role: 'USER' });

    expect(expectErr(await mintVoiceToken(room.voice, ROOM_ID, stranger, false)).code).toBe(
      ErrorCodes.WATCH_PARTY_NOT_FOUND
    );
  });

  it('refuses a member without voice.join, and reports a media server that is down', async () => {
    const room = await voiceRoom();
    await room.repositories.watchPartyRoles.resetBuiltIns(
      ROOM_ID,
      [{ key: 'member', permissions: [] }],
      {
        at: room.deps.now(),
        line: {
          id: room.deps.secrets.newId(),
          line: { event: 'roles_changed', actorKey: keyOf(OWNER), targetKey: null, detail: null },
          videoId: null,
          positionMs: null,
          createdAt: room.deps.now(),
        },
      }
    );

    const refused = expectErr(await mintVoiceToken(room.voice, ROOM_ID, userCaller(MEMBER), false));
    room.gateway.setUnavailable(true);
    const down = expectErr(await mintVoiceToken(room.voice, ROOM_ID, userCaller(OWNER), false));

    expect(refused).toMatchObject({
      code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
      permission: 'voice.join',
    });
    expect(down.code).toBe(ErrorCodes.WATCH_PARTY_VOICE_UNAVAILABLE);
  });
});
