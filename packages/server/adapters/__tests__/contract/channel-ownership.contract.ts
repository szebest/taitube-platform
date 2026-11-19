import { expectErr, expectOk } from '@kit/testing/result';
import type { ChannelRepositoryPort } from '@vp/core/repositories';
import type { NewChannelAuditEntry } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { OTHER_OWNER_ID, OWNER_ID, seedOwnerAccounts } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const PRIMARY_ID = '00000000-0000-7000-8000-000000000401';
const SECOND_ID = '00000000-0000-7000-8000-000000000402';
const LIMIT = 3;

const audited = (
  channelId: string,
  action: 'channel.created' | 'channel.promoted'
): NewChannelAuditEntry => ({
  channelId,
  actorUserId: OWNER_ID,
  action,
  targetType: 'channel',
  targetId: channelId,
  meta: {},
});

export function describeChannelOwnershipContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ChannelRepository ownership contract', () => {
    let subject: RepositoriesSubject;
    let channels: ChannelRepositoryPort;

    const createOwned = (handle: string, userId = OWNER_ID) =>
      channels.createOwned({ userId, handle, displayName: handle }, LIMIT);

    const ownedIds = async (userId = OWNER_ID) =>
      expectOk(await channels.listByUserId(userId)).map((channel) => channel.id);

    const primaryOf = async (userId = OWNER_ID) =>
      expectOk(await channels.findPrimaryByUserId(userId))?.id;

    const auditedOn = async (channelId: string) =>
      expectOk(
        await subject.repositories.channelAudit.list(channelId, { cursor: null, limit: 5 })
      ).map(({ action }) => action);

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwnerAccounts(subject.repositories);
      channels = subject.repositories.channels;
      expectOk(
        await channels.create({
          id: PRIMARY_ID,
          userId: OWNER_ID,
          handle: 'primary',
          displayName: 'Primary',
        })
      );
    });

    it('lists the primary first, then the others oldest first, and nobody else', async () => {
      const second = expectOk(await createOwned('second'));
      const third = expectOk(await createOwned('third'));
      expectOk(await createOwned('elsewhere', OTHER_OWNER_ID));

      expect(await ownedIds()).toEqual([PRIMARY_ID, second.id, third.id]);
      expect([second.isPrimary, third.isPrimary]).toEqual([false, false]);
    });

    it('makes the first channel of a user with none their primary', async () => {
      const first = expectOk(await createOwned('first', OTHER_OWNER_ID));

      expect(first.isPrimary).toBe(true);
      expect(await primaryOf(OTHER_OWNER_ID)).toBe(first.id);
    });

    it('refuses a channel past the limit with CHANNEL_LIMIT_REACHED and stores nothing', async () => {
      expectOk(await createOwned('second'));
      expectOk(await createOwned('third'));

      expect(expectErr(await createOwned('fourth'))).toMatchObject({
        code: ErrorCodes.CHANNEL_LIMIT_REACHED,
        limit: LIMIT,
      });
      expect(await ownedIds()).toHaveLength(LIMIT);
    });

    it('never passes the limit when several creates for one user race', async () => {
      const results = await Promise.all(
        ['r1', 'r2', 'r3', 'r4', 'r5'].map((handle) => createOwned(handle))
      );

      expect(results.filter((result) => result.ok)).toHaveLength(LIMIT - 1);
      expect(
        results.filter(
          (result) => !result.ok && result.error.code === ErrorCodes.CHANNEL_LIMIT_REACHED
        )
      ).toHaveLength(5 - (LIMIT - 1));
      expect(await ownedIds()).toHaveLength(LIMIT);
    });

    it('reports a held handle as HANDLE_ALREADY_TAKEN', async () => {
      expect(expectErr(await createOwned('primary')).code).toBe(ErrorCodes.HANDLE_ALREADY_TAKEN);
    });

    it('moves the primary to the promoted channel and keeps exactly one', async () => {
      const second = expectOk(await createOwned('second'));

      const promoted = expectOk(await channels.promote(OWNER_ID, second.id));

      expect(promoted).toMatchObject({ id: second.id, isPrimary: true });
      expect(await primaryOf()).toBe(second.id);
      expect(expectOk(await channels.findById(PRIMARY_ID))?.isPrimary).toBe(false);
      expect(await ownedIds()).toEqual([second.id, PRIMARY_ID]);
    });

    it('keeps exactly one primary when promotions race', async () => {
      const second = expectOk(await createOwned('second'));
      const third = expectOk(await createOwned('third'));

      await Promise.all([
        channels.promote(OWNER_ID, second.id),
        channels.promote(OWNER_ID, third.id),
        channels.promote(OWNER_ID, PRIMARY_ID),
      ]);

      const owned = expectOk(await channels.listByUserId(OWNER_ID));
      expect(owned.filter((channel) => channel.isPrimary)).toHaveLength(1);
    });

    it.each([
      { name: 'a channel another user owns', userId: OTHER_OWNER_ID, channelId: PRIMARY_ID },
      {
        name: 'a channel that is not there',
        userId: OWNER_ID,
        channelId: '00000000-0000-7000-8000-0000000004ff',
      },
    ])(
      'answers ok(null) and changes nothing when promoting $name',
      async ({ userId, channelId }) => {
        expect(expectOk(await channels.promote(userId, channelId))).toBeNull();
        expect(await primaryOf()).toBe(PRIMARY_ID);
      }
    );

    it('writes the audit rows it is handed with a create and a promotion, and none with a refused one', async () => {
      const second = { id: SECOND_ID, userId: OWNER_ID, handle: 'second', displayName: 'Second' };
      expectOk(await channels.createOwned(second, LIMIT, audited(SECOND_ID, 'channel.created')));
      expectOk(await channels.promote(OWNER_ID, SECOND_ID, audited(SECOND_ID, 'channel.promoted')));
      expectErr(
        await channels.createOwned(
          { ...second, handle: 'primary' },
          LIMIT,
          audited(SECOND_ID, 'channel.created')
        )
      );
      expectOk(
        await channels.promote(OTHER_OWNER_ID, PRIMARY_ID, audited(PRIMARY_ID, 'channel.promoted'))
      );

      expect(await auditedOn(SECOND_ID)).toEqual(['channel.promoted', 'channel.created']);
      expect(await auditedOn(PRIMARY_ID)).toEqual([]);
    });

    it.each([
      { scenario: 'a free handle', handle: 'renamed', written: ['channel.updated'] },
      { scenario: 'a handle another channel holds', handle: 'held', written: [] },
    ])(
      'writes the audit row it is handed with a handle change to $scenario, or none',
      async ({ handle, written }) => {
        expectOk(await createOwned('held'));

        await channels.update(
          PRIMARY_ID,
          { handle, handleChangedAt: new Date() },
          {
            channelId: PRIMARY_ID,
            actorUserId: OWNER_ID,
            action: 'channel.updated',
            targetType: 'channel',
            targetId: PRIMARY_ID,
            meta: { fields: ['handle'] },
          }
        );

        expect(await auditedOn(PRIMARY_ID)).toEqual(written);
      }
    );

    it('lets only one of two racing first creates of a primary through', async () => {
      const results = await Promise.all(
        ['racer-a', 'racer-b'].map((handle) =>
          channels.create({ userId: OTHER_OWNER_ID, handle, displayName: handle })
        )
      );

      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(await ownedIds(OTHER_OWNER_ID)).toHaveLength(1);
    });
  });
}
