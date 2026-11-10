import { createHash } from 'node:crypto';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { createInviteLink } from '../watch-party-invite-links';
import { keyOf, ROOM_ID, seedRoom } from './watch-party-moderation-fixture';
import {
  DISCORD_ID,
  discordSession,
  guestCaller,
  OWNER,
  userCaller,
  watchPartyTestDeps,
} from './watch-party-test-deps';

async function setUpRoom() {
  const test = watchPartyTestDeps();
  const at = test.deps.now();
  await seedRoom(test.repositories, OWNER, at);
  const discord = {
    roomId: ROOM_ID,
    memberKey: `discord:${DISCORD_ID}`,
    kind: 'discord' as const,
    userId: null,
    discordUserId: DISCORD_ID,
    displayName: 'Discord Dana',
    avatarUrl: null,
    ipHash: null,
    joinedVia: 'activity' as const,
    joinedAt: at,
  };
  expectOk(await test.repositories.watchPartyMembers.join(discord, null));
  return test;
}

describe('createInviteLink', () => {
  it('lets a Discord member with members.invite create a link under their member key', async () => {
    const { deps, repositories } = await setUpRoom();

    const created = expectOk(
      await createInviteLink(deps, ROOM_ID, guestCaller(discordSession()), { ttl: '1h' })
    );

    const stored = expectOk(
      await repositories.watchPartyInviteLinks.findByTokenHash(
        createHash('sha256').update(created.token).digest('hex')
      )
    );
    expect(stored?.createdBy).toBe(`discord:${DISCORD_ID}`);
  });

  it('refuses a guest, whose Guest role cannot invite', async () => {
    const { deps, repositories } = await setUpRoom();
    expectOk(
      await repositories.watchPartyMembers.join(
        {
          roomId: ROOM_ID,
          memberKey: 'guest:abcdefghijklmnop',
          kind: 'guest',
          userId: null,
          discordUserId: null,
          displayName: 'Guest 4821',
          avatarUrl: null,
          ipHash: null,
          joinedVia: 'link',
          joinedAt: deps.now(),
        },
        null
      )
    );
    const guest = guestCaller({
      principal: { kind: 'guest', guestId: 'abcdefghijklmnop', name: 'Guest 4821' },
      ipHash: null,
    });

    const failure = expectErr(await createInviteLink(deps, ROOM_ID, guest, { ttl: '24h' }));

    expect(failure.code).toBe(ErrorCodes.WATCH_PARTY_PERMISSION_MISSING);
  });

  it('logs the change once and never the token', async () => {
    const { deps, log } = await setUpRoom();

    const created = expectOk(
      await createInviteLink(deps, ROOM_ID, userCaller(OWNER), { ttl: '24h', maxUses: 3 })
    );

    expect(log.lines()).toEqual([
      expect.objectContaining({
        roomId: ROOM_ID,
        actorKey: keyOf(OWNER),
        action: 'invite-link.create',
      }),
    ]);
    expect(log.text()).not.toContain(created.token);
  });
});
