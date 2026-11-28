import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import { seedLink } from './watch-party-access-fixture';
import { setUpJoin } from './watch-party-join-fixture';
import { MEMBER, OTHER, OWNER, userCaller } from './watch-party-test-deps';

describe('apps/server/api/services: joinRoom by invite link', () => {
  it('removes nobody when the link a member came in by is revoked', async () => {
    const test = await setUpJoin({ visibility: 'private' });
    const token = await seedLink(test, test.room.id);
    expectOk(await test.join(userCaller(MEMBER), { invite: token }));
    const links = test.repositories.watchPartyInviteLinks;
    const hash = test.deps.secrets.hashToken(token);
    const { id = '' } = expectOk(await links.findByTokenHash(hash)) ?? {};
    expectOk(await links.revoke(test.room.id, id, new Date()));

    const failure = expectErr(await test.join(userCaller(OTHER), { invite: token }));

    expect(failure.code).toBe(ErrorCodes.WATCH_PARTY_INVITE_INVALID);
    expect(await test.seated()).toEqual([`user:${OWNER.id}`, `user:${MEMBER.id}`]);
  });
});
