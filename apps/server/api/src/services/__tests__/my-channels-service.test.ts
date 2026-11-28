import { databaseUnavailable } from '@kit/errors';
import { err } from '@kit/result';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing-fixtures';
import { MyChannelsService } from '../my-channels-service';

const OWNER = { id: SEEDED.userId, role: 'USER' } as const;
const AT = Date.parse('2026-03-01T00:00:00.000Z');

function serviceOver(repositories: InMemoryRepositories, maxOwned = 3) {
  return new MyChannelsService({
    users: repositories.users,
    channels: repositories.channels,
    handleHistory: repositories.channelHandleHistory,
    members: repositories.channelMembers,
    maxOwned,
    now: () => AT,
  });
}

describe('MyChannelsService', () => {
  let repositories: InMemoryRepositories;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    expectOk(await repositories.users.upsert({ id: OWNER.id, email: 'dev@example.com' }));
  });

  it('refuses a channel once the caller owns the cap and writes nothing', async () => {
    const createOwned = vi.spyOn(repositories.channels, 'createOwned');

    const refused = await serviceOver(repositories, 1).create(OWNER, {
      handle: 'second',
      displayName: 'Second',
    });

    expect(expectErr(refused).code).toBe(ErrorCodes.CHANNEL_LIMIT_REACHED);
    expect(createOwned).not.toHaveBeenCalled();
  });

  it('refuses a handle held for its previous owner', async () => {
    repositories.channelHandleHistory.retire({
      handle: 'gone',
      channelId: SEEDED.otherChannelId,
      retiredAt: new Date(AT - 1000),
    });

    const refused = await serviceOver(repositories).create(OWNER, {
      handle: 'gone',
      displayName: 'Gone',
    });

    expect(expectErr(refused).code).toBe(ErrorCodes.HANDLE_RESERVED);
  });

  it('reports a store failure when the audit row cannot be written', async () => {
    vi.spyOn(repositories.channelAudit, 'append').mockResolvedValueOnce(
      err(databaseUnavailable('append'))
    );

    const failed = await serviceOver(repositories).create(OWNER, {
      handle: 'second',
      displayName: 'Second',
    });

    expect(expectErr(failed).code).toBe(ErrorCodes.DATABASE_UNAVAILABLE);
  });

  it('promotes an owned channel and audits it', async () => {
    const created = expectOk(
      await serviceOver(repositories).create(OWNER, { handle: 'second', displayName: 'Second' })
    );

    const promoted = expectOk(await serviceOver(repositories).promote(OWNER, created.id));

    expect(promoted).toMatchObject({ id: created.id, isPrimary: true });
    expect(
      expectOk(await repositories.channelAudit.list(created.id, { cursor: null, limit: 5 })).map(
        ({ action }) => action
      )
    ).toEqual(['channel.promoted', 'channel.created']);
  });

  it('answers CHANNEL_NOT_OWNED when an admin, whom the rules allow, does not own it', async () => {
    const admin = { id: '00000000-0000-7000-8000-0000000000ad', role: 'ADMIN' } as const;

    const refused = await serviceOver(repositories).promote(admin, SEEDED.channelId);

    expect(expectErr(refused).code).toBe(ErrorCodes.CHANNEL_NOT_OWNED);
  });

  it('refuses identities to a caller with no user record', async () => {
    const refused = await serviceOver(repositories).identities({
      id: '00000000-0000-7000-8000-0000000000ff',
      role: 'USER',
    });

    expect(expectErr(refused).code).toBe(ErrorCodes.UNAUTHORIZED);
  });
});
