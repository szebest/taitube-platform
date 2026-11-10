import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { TrustedCommenterService } from '../trusted-commenter-service';

const OWNER: UserContext = { id: '11111111-1111-7111-8111-111111111111', role: 'CREATOR' };
const MODERATOR: UserContext = {
  id: '22222222-2222-7222-8222-222222222222',
  role: 'USER',
  memberships: {},
};
const TARGET = '33333333-3333-7333-8333-333333333333';

describe('apps/server/api/services: trusted commenters', () => {
  let repositories: InMemoryRepositories;
  let service: TrustedCommenterService;
  let acting: { channelId: string; ownerId: string; role: 'owner' };

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    await repositories.users.upsert({ id: TARGET, email: 't@example.com' });
    const channel = expectOk(
      await repositories.channels.create({
        userId: OWNER.id,
        handle: 'owner',
        displayName: 'Owner',
      })
    );
    acting = { channelId: channel.id, ownerId: OWNER.id, role: 'owner' };
    service = new TrustedCommenterService({
      trusted: repositories.trustedCommenters,
      users: repositories.users,
      channels: repositories.channels,
      paginator: new Paginator({ defaultLimit: 10, maxLimit: 50 }),
    });
  });

  it('trusts and untrusts the owner can do, a moderator cannot', async () => {
    const moderator = await service.trust(MODERATOR, { ...acting, role: 'moderator' }, TARGET);

    expectOk(await service.trust(OWNER, acting, TARGET));
    expect(expectOk(await service.list(OWNER, acting, {})).items).toMatchObject([
      { userId: TARGET },
    ]);
    expectOk(await service.untrust(OWNER, acting, TARGET));

    expect(expectErr(moderator).code).toBe(ErrorCodes.FORBIDDEN);
    expect(expectOk(await service.list(OWNER, acting, {})).items).toEqual([]);
  });

  it('refuses a user that does not exist as invalid input', async () => {
    const result = await service.trust(OWNER, acting, '99999999-9999-7999-8999-999999999999');

    expect(expectErr(result)).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'userId',
    });
  });
});
