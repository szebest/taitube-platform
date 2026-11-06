import type { Repositories } from '@vp/core/repositories';
import type { Channel } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { INVITEE_ID, auditOf, expired, invite, inviteId, seedTeam } from './channel-team-fixtures';
import { OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

export function describeChannelInviteRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('ChannelInviteRepository contract', () => {
    let subject: RepositoriesSubject;
    let repositories: Repositories;
    let channel: Channel;

    const create = async (n: number, overrides: Parameters<typeof invite>[2] = {}) =>
      expectOk(
        await repositories.channelInvites.create(
          invite(channel, n, overrides),
          auditOf(channel, 'invite.created', n)
        )
      );

    const accept = async (n: number, inviteeUserId = INVITEE_ID) =>
      expectOk(
        await repositories.channelInvites.accept(
          inviteId(n),
          inviteeUserId,
          auditOf(channel, 'invite.accepted', n, inviteeUserId)
        )
      );

    const auditActions = async () =>
      expectOk(await repositories.channelAudit.list(channel.id, { cursor: null, limit: 50 }))
        .map((entry) => entry.action)
        .sort();

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

    it('creates a pending invite and audits it', async () => {
      expect(await create(1)).toMatchObject({
        type: 'created',
        invite: { id: inviteId(1), status: 'pending', role: 'editor' },
      });
      expect(await auditActions()).toEqual(['invite.created']);
    });

    it('refuses a second pending invite for the same invitee, and audits nothing for it', async () => {
      await create(1);

      expect(await create(2)).toEqual({ type: 'already-pending' });
      expect(await auditActions()).toEqual(['invite.created']);
    });

    it('closes an expired invite so a new one can be sent', async () => {
      await create(1, expired);

      expect((await create(2)).type).toBe('created');
      expect(expectOk(await repositories.channelInvites.findById(inviteId(1)))?.status).toBe(
        'expired'
      );
    });

    it('reads a pending invite past its expiry as expired, and lists only live ones', async () => {
      await create(1, expired);

      expect(expectOk(await repositories.channelInvites.findById(inviteId(1)))?.status).toBe(
        'expired'
      );
      expect(expectOk(await repositories.channelInvites.listPending(channel.id))).toEqual([]);
    });

    it('accepts into a membership in one step, and audits both', async () => {
      await create(1);

      expect(await accept(1)).toMatchObject({
        type: 'accepted',
        membership: {
          channelId: channel.id,
          userId: INVITEE_ID,
          role: 'editor',
          invitedBy: OWNER_ID,
        },
      });
      expect(expectOk(await repositories.channelMembers.membershipsOf(INVITEE_ID))).toEqual([
        { channelId: channel.id, ownerId: OWNER_ID, role: 'editor' },
      ]);
      expect(await auditActions()).toEqual(['invite.accepted', 'invite.created']);
    });

    it.each([
      { scenario: 'an expired invite', setup: (n: number) => create(n, expired) },
      {
        scenario: 'a revoked invite',
        setup: async (n: number) => {
          await create(n);
          await repositories.channelInvites.close(
            inviteId(n),
            'revoked',
            auditOf(channel, 'invite.revoked', n)
          );
        },
      },
      {
        scenario: 'a declined invite',
        setup: async (n: number) => {
          await create(n);
          await repositories.channelInvites.close(
            inviteId(n),
            'declined',
            auditOf(channel, 'invite.declined', n, INVITEE_ID)
          );
        },
      },
      {
        scenario: 'an accepted invite',
        setup: async (n: number) => {
          await create(n);
          await accept(n);
        },
      },
    ])('cannot accept $scenario', async ({ setup }) => {
      await setup(1);

      expect(await accept(1)).toEqual({ type: 'not-pending' });
    });

    it('lets only the invitee accept', async () => {
      await create(1);

      expect(await accept(1, OWNER_ID)).toEqual({ type: 'not-pending' });
      expect(expectOk(await repositories.channelMembers.membershipsOf(OWNER_ID))).toEqual([]);
    });

    it('closes a pending invite once', async () => {
      await create(1);
      const revoke = () =>
        repositories.channelInvites.close(
          inviteId(1),
          'revoked',
          auditOf(channel, 'invite.revoked', 1)
        );

      expect(expectOk(await revoke())).toBe(true);
      expect(expectOk(await revoke())).toBe(false);
      expect(await auditActions()).toEqual(['invite.created', 'invite.revoked']);
    });
  });
}
