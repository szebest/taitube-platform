import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { WatchPartyInviteService } from '../watch-party-invite-service';
import { keyOf, ROOM_ID, seedRoom } from './watch-party-moderation-fixture';
import { MEMBER, OTHER, OWNER, userCaller, watchPartyTestDeps } from './watch-party-test-deps';

const STRANGER = '00000000-0000-7000-8000-00000000f0ee';
const BUDGET = { limit: 3, windowSeconds: 3600 };

async function setUpInvites() {
  const test = watchPartyTestDeps({ config: { watchParties: { budgets: { invite: BUDGET } } } });
  const { repositories, deps } = test;
  await seedRoom(repositories, OWNER, deps.now());
  for (const [n, user] of [OWNER, MEMBER, OTHER].entries()) {
    expectOk(await repositories.users.upsert({ id: user.id, email: `user${n}@taitube.local` }));
    expectOk(
      await repositories.channels.create({
        userId: user.id,
        handle: `user-${n}`,
        displayName: `User ${n}`,
      })
    );
  }
  const owner = { ...userCaller(OWNER), user: OWNER };
  return { ...test, owner, service: new WatchPartyInviteService(deps) };
}

const inviteIds = [MEMBER.id, OTHER.id];

describe('WatchPartyInviteService', () => {
  it('logs one line for a request with how many were sent, folded and refused', async () => {
    const { service, owner, log } = await setUpInvites();

    expectOk(await service.invite(ROOM_ID, owner, { userIds: [...inviteIds, OWNER.id] }));

    expect(log.lines()).toEqual([
      expect.objectContaining({
        level: 'info',
        roomId: ROOM_ID,
        actorKey: keyOf(OWNER),
        action: 'invite.send',
        sent: 2,
        folded: 0,
        refused: 1,
      }),
    ]);
  });

  it.each([
    {
      scenario: 'a request of more people than the budget holds',
      first: 0,
      userIds: [MEMBER.id, OTHER.id, OWNER.id, STRANGER],
      sent: 0,
    },
    { scenario: 'a request after the budget is spent', first: 3, userIds: [MEMBER.id], sent: 0 },
    { scenario: 'a request that fits what is left', first: 2, userIds: [MEMBER.id], sent: 1 },
  ])('answers $scenario', async ({ first, userIds, sent }) => {
    const { service, owner, gate, repositories, deps } = await setUpInvites();
    for (let n = 0; n < first; n += 1) {
      expectOk(await gate.consume('invite', OWNER.id, BUDGET));
    }

    const result = await service.invite(ROOM_ID, owner, { userIds });

    if (sent === 0) {
      expect(expectErr(result)).toMatchObject({
        code: ErrorCodes.RATE_LIMITED,
        retryAfterSeconds: expect.any(Number),
      });
    } else {
      expect(expectOk(result).sent).toHaveLength(sent);
    }
    expect(expectOk(await repositories.watchPartyInvites.countPending(ROOM_ID, deps.now()))).toBe(
      sent
    );
  });

  it('logs a decline once, naming the room and the invitee', async () => {
    const { service, owner, log } = await setUpInvites();
    const { sent } = expectOk(await service.invite(ROOM_ID, owner, { userIds: [MEMBER.id] }));

    expectOk(await service.decline(MEMBER, sent[0]?.inviteId ?? ''));

    expect(log.lines().filter(({ action }) => action === 'invite.decline')).toEqual([
      expect.objectContaining({ roomId: ROOM_ID, actorKey: keyOf(MEMBER), level: 'info' }),
    ]);
  });
});
