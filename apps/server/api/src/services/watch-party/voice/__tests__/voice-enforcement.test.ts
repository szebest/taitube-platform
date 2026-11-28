import { expectOk } from '@kit/testing/result';
import { keyOf, ROOM_ID } from '../../__tests__/watch-party-moderation-fixture';
import { drainMicrotasks, elapse, fakeTimers } from '../../__tests__/watch-party-socket-fixture';
import { MEMBER, OTHER, OWNER, userCaller } from '../../__tests__/watch-party-test-deps';
import { WatchPartyMemberService } from '../../watch-party-member-service';
import { WatchPartyRoleService } from '../../watch-party-role-service';
import { mintVoiceToken } from '../voice-token';
import { type VoiceRoom, voiceRoom } from './voice-fixture';

const MINUTE_MS = 60_000;

async function inVoice(room: VoiceRoom, user = MEMBER) {
  const view = expectOk(await mintVoiceToken(room.voice, ROOM_ID, userCaller(user), false));
  room.gateway.join(view.token);
  room.gateway.publish(`party:${ROOM_ID}`, keyOf(user));
}

const grantsOf = (room: VoiceRoom, user = MEMBER) =>
  room.gateway.grantsOf(`party:${ROOM_ID}`, keyOf(user));

async function assign(room: VoiceRoom, roleKey: 'voice_muted' | 'chat_muted', expiresIn?: '10m') {
  const ids = expectOk(await room.repositories.watchPartyRoles.list(ROOM_ID, room.deps.now()));
  const roleId = ids.find(({ key }) => key === roleKey)?.id ?? '';
  expectOk(
    await new WatchPartyRoleService(room.deps).assign(
      ROOM_ID,
      userCaller(OWNER),
      keyOf(MEMBER),
      roleId,
      {
        expiresIn,
      }
    )
  );
  await drainMicrotasks();
  return roleId;
}

describe('apps/api: VoiceEnforcement', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('drops canPublish within the role change that muted a speaker, leaving chat alone', async () => {
    const room = await voiceRoom();
    await inVoice(room);

    await assign(room, 'voice_muted');

    expect(grantsOf(room)).toEqual({ canSubscribe: true, canPublish: false });
    expect(room.gateway.publish(`party:${ROOM_ID}`, keyOf(MEMBER))).toBe(false);
    expect(room.published('voice')).toEqual([{ type: 'voice', state: 'server_muted' }]);
  });

  it('leaves a speaker publishing when only chat is muted', async () => {
    const room = await voiceRoom();
    await inVoice(room);

    await assign(room, 'chat_muted');

    expect(grantsOf(room)).toEqual({ canSubscribe: true, canPublish: true });
    expect(room.published('voice')).toEqual([]);
  });

  it('gives canPublish back when the mute is revoked, and when it runs out', async () => {
    fakeTimers();
    const room = await voiceRoom();
    await inVoice(room);
    const roleId = await assign(room, 'voice_muted');
    await new WatchPartyRoleService(room.deps).revoke(
      ROOM_ID,
      userCaller(OWNER),
      keyOf(MEMBER),
      roleId
    );
    await drainMicrotasks();
    expect(grantsOf(room)?.canPublish).toBe(true);

    await assign(room, 'voice_muted', '10m');
    expect(grantsOf(room)?.canPublish).toBe(false);
    room.clock.advance(10 * MINUTE_MS + 1_000);
    await elapse(10 * MINUTE_MS + 1_000);

    expect(grantsOf(room)).toEqual({ canSubscribe: true, canPublish: true });
  });

  it('follows an edited role: a member role that loses voice.speak stops everyone speaking by it', async () => {
    const room = await voiceRoom();
    await inVoice(room);
    const roles = expectOk(
      await new WatchPartyRoleService(room.deps).list(ROOM_ID, userCaller(OWNER))
    );
    const member = roles.items.find(({ key }) => key === 'member');
    expectOk(
      await new WatchPartyRoleService(room.deps).update(
        ROOM_ID,
        userCaller(OWNER),
        member?.id ?? '',
        {
          permissions: member?.permissions.filter((permission) => permission !== 'voice.speak'),
          updatedAt: member?.updatedAt ?? '',
        }
      )
    );
    await drainMicrotasks();

    expect(grantsOf(room)).toEqual({ canSubscribe: true, canPublish: false });
  });

  it('never raises the publishers past the cap when a role change would give a listener the mic back', async () => {
    const room = await voiceRoom({ config: { voice: { maxSpeakers: 1 } } });
    await inVoice(room, OWNER);
    const listener = expectOk(await mintVoiceToken(room.voice, ROOM_ID, userCaller(MEMBER), true));
    room.gateway.join(listener.token);
    room.enforcement.watch(ROOM_ID);

    await assign(room, 'chat_muted');

    expect(grantsOf(room)).toEqual({ canSubscribe: true, canPublish: false });
  });

  it('disconnects a member who left the room, and every participant when the room closes', async () => {
    const room = await voiceRoom();
    await inVoice(room);
    await inVoice(room, OTHER);
    room.enforcement.watch(ROOM_ID);

    expectOk(
      await new WatchPartyMemberService(room.deps).kick(ROOM_ID, userCaller(OWNER), keyOf(MEMBER))
    );
    await drainMicrotasks();
    expect(room.gateway.removed.map(({ identity }) => identity)).toEqual([keyOf(MEMBER)]);

    await room.deps.broadcaster.toRoom(ROOM_ID, { type: 'closed', reason: 'owner' });
    await drainMicrotasks();
    expect(room.gateway.removed.map(({ identity }) => identity)).toEqual([
      keyOf(MEMBER),
      keyOf(OTHER),
    ]);
  });
});
