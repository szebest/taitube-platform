import type { Repositories } from '@vp/core/repositories';
import type { Channel, NewChannelUserRestriction } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { INVITEE_ID, seedTeam } from './channel-team-fixtures';
import { OTHER_OWNER_ID, OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const HOUR_MS = 3_600_000;

export function describeChannelUserRestrictionRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('ChannelUserRestrictionRepository contract', () => {
    let subject: RepositoriesSubject;
    let repositories: Repositories;
    let channel: Channel;

    const ban = (
      userId: string,
      expiresAt: Date | null = null,
      reason: string | null = 'spam'
    ): NewChannelUserRestriction => ({
      channelId: channel.id,
      userId,
      kind: 'ban',
      reason,
      expiresAt,
      createdBy: OWNER_ID,
    });
    const shadow = (userId: string): NewChannelUserRestriction => ({
      channelId: channel.id,
      userId,
      kind: 'shadow',
      reason: null,
      expiresAt: null,
      createdBy: OWNER_ID,
    });
    const apply = async (restriction: NewChannelUserRestriction) =>
      expectOk(await repositories.channelUserRestrictions.apply(restriction));
    const findActive = async (userId: string, now = new Date()) =>
      expectOk(await repositories.channelUserRestrictions.findActive(channel.id, userId, now));
    const list = async (limit = 10, cursor = null as { createdAt: Date; userId: string } | null) =>
      expectOk(
        await repositories.channelUserRestrictions.list(channel.id, {
          cursor,
          limit,
          now: new Date(),
        })
      );

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

    it('answers nothing for a user with no restriction', async () => {
      expect(await findActive(OTHER_OWNER_ID)).toBeNull();
    });

    it.each([
      { name: 'a permanent ban', make: () => ban(OTHER_OWNER_ID) },
      {
        name: 'a ban that has not ended',
        make: () => ban(OTHER_OWNER_ID, new Date(Date.now() + HOUR_MS)),
      },
      { name: 'a shadow ban', make: () => shadow(OTHER_OWNER_ID) },
    ])('finds $name', async ({ make }) => {
      const restriction = make();

      expect(await apply(restriction)).toMatchObject(restriction);
      expect(await findActive(OTHER_OWNER_ID)).toMatchObject(restriction);
    });

    it('reads an ended ban as absent, with no job having run', async () => {
      await apply(ban(OTHER_OWNER_ID, new Date(Date.now() - HOUR_MS)));

      expect(await findActive(OTHER_OWNER_ID)).toBeNull();
      expect(await list()).toEqual([]);
    });

    it('holds one restriction per user: a ban replaces a shadow ban', async () => {
      await apply(shadow(OTHER_OWNER_ID));
      await apply(ban(OTHER_OWNER_ID));

      expect(await findActive(OTHER_OWNER_ID)).toMatchObject({ kind: 'ban', reason: 'spam' });
      expect(await list()).toHaveLength(1);
    });

    it('restricts a user on one channel without touching another', async () => {
      const other = expectOk(
        await repositories.channels.create({
          userId: OTHER_OWNER_ID,
          handle: 'other',
          displayName: 'Other',
        })
      );
      await apply(ban(INVITEE_ID));

      expect(
        expectOk(
          await repositories.channelUserRestrictions.findActive(other.id, INVITEE_ID, new Date())
        )
      ).toBeNull();
    });

    it('lifts a restriction once, and says so when there was none', async () => {
      await apply(shadow(OTHER_OWNER_ID));
      const lift = async () =>
        expectOk(await repositories.channelUserRestrictions.lift(channel.id, OTHER_OWNER_ID));

      expect([await lift(), await lift()]).toEqual([true, false]);
      expect(await findActive(OTHER_OWNER_ID)).toBeNull();
    });

    it('lists the newest first and pages by cursor', async () => {
      await apply(ban(OTHER_OWNER_ID));
      await new Promise((resolve) => setTimeout(resolve, 5));
      await apply(shadow(INVITEE_ID));

      const firstPage = await list(1);
      const [head] = firstPage;
      const rest = await list(1, head && { createdAt: head.createdAt, userId: head.userId });

      expect(firstPage.map((row) => row.userId)).toEqual([INVITEE_ID, OTHER_OWNER_ID]);
      expect(rest.map((row) => row.userId)).toEqual([OTHER_OWNER_ID]);
    });

    it('purges restrictions that ended before the cutoff and keeps the rest', async () => {
      await apply(ban(OTHER_OWNER_ID, new Date(Date.now() - 40 * 24 * HOUR_MS)));
      await apply(ban(INVITEE_ID, new Date(Date.now() - HOUR_MS)));
      await apply(shadow(OWNER_ID));
      const cutoff = new Date(Date.now() - 30 * 24 * HOUR_MS);

      expect(expectOk(await repositories.channelUserRestrictions.purgeEndedBefore(cutoff))).toBe(1);
      expect(
        expectOk(
          await repositories.channelUserRestrictions.findActive(channel.id, OWNER_ID, new Date())
        )
      ).not.toBeNull();
    });
  });
}
