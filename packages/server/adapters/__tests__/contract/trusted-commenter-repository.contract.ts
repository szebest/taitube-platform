import type { Repositories } from '@vp/core/repositories';
import type { Channel } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { INVITEE_ID, seedTeam } from './channel-team-fixtures';
import { OTHER_OWNER_ID, OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

export function describeTrustedCommenterRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('TrustedCommenterRepository contract', () => {
    let subject: RepositoriesSubject;
    let repositories: Repositories;
    let channel: Channel;

    const add = async (userId: string) =>
      expectOk(await repositories.trustedCommenters.add(channel.id, userId, OWNER_ID));
    const isTrusted = async (userId: string) =>
      expectOk(await repositories.trustedCommenters.isTrusted(channel.id, userId));

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      repositories = subject.repositories;
      await seedOwners(repositories);
      channel = await seedTeam(repositories);
    });

    it('trusts nobody until a user is added', async () => {
      expect(await isTrusted(OTHER_OWNER_ID)).toBe(false);
    });

    it('adds a user once, and says so when they were already trusted', async () => {
      expect([await add(OTHER_OWNER_ID), await add(OTHER_OWNER_ID)]).toEqual([true, false]);
      expect(await isTrusted(OTHER_OWNER_ID)).toBe(true);
    });

    it('records its audit row only when the list changed', async () => {
      const entry = (action: 'trusted.added' | 'trusted.removed') =>
        ({
          channelId: channel.id,
          actorUserId: OWNER_ID,
          action,
          targetType: 'user',
          targetId: OTHER_OWNER_ID,
          meta: {},
        }) as const;
      const { trustedCommenters, channelAudit } = repositories;

      await trustedCommenters.add(channel.id, OTHER_OWNER_ID, OWNER_ID, entry('trusted.added'));
      await trustedCommenters.add(channel.id, OTHER_OWNER_ID, OWNER_ID, entry('trusted.added'));
      await trustedCommenters.remove(channel.id, OTHER_OWNER_ID, entry('trusted.removed'));
      await trustedCommenters.remove(channel.id, OTHER_OWNER_ID, entry('trusted.removed'));

      const log = expectOk(await channelAudit.list(channel.id, { cursor: null, limit: 10 }));
      expect(log.map((row) => row.action).reverse()).toEqual(['trusted.added', 'trusted.removed']);
    });

    it('removes a user once, and says so when they were not trusted', async () => {
      await add(OTHER_OWNER_ID);
      const remove = async () =>
        expectOk(await repositories.trustedCommenters.remove(channel.id, OTHER_OWNER_ID));

      expect([await remove(), await remove()]).toEqual([true, false]);
      expect(await isTrusted(OTHER_OWNER_ID)).toBe(false);
    });

    it('trusts a user on one channel only', async () => {
      const other = expectOk(
        await repositories.channels.create({
          userId: OTHER_OWNER_ID,
          handle: 'other',
          displayName: 'Other',
        })
      );
      await add(INVITEE_ID);

      expect(expectOk(await repositories.trustedCommenters.isTrusted(other.id, INVITEE_ID))).toBe(
        false
      );
    });

    it('pages by cursor, one more row than asked for so the caller sees a next page', async () => {
      await add(OTHER_OWNER_ID);
      await add(INVITEE_ID);
      const page = async (cursor: { createdAt: Date; userId: string } | null) =>
        expectOk(await repositories.trustedCommenters.list(channel.id, { cursor, limit: 1 }));

      const firstPage = await page(null);
      const [head] = firstPage;
      const rest = await page(head ? { createdAt: head.createdAt, userId: head.userId } : null);

      expect(firstPage).toHaveLength(2);
      expect(rest.map((row) => row.userId)).toEqual([firstPage[1]?.userId]);
      expect(new Set(firstPage.map((row) => row.userId))).toEqual(
        new Set([OTHER_OWNER_ID, INVITEE_ID])
      );
    });
  });
}
