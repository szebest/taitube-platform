import type { Repositories } from '@vp/core/repositories';
import type { Channel, ChannelRole } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { INVITEE_ID, auditOf, expired, invite, inviteId, seedTeam } from './channel-team-fixtures';
import { OTHER_OWNER_ID, OWNER_ID, seedOwners } from './fixtures';
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

    const notifications = async () =>
      expectOk(await subject.repositories.outbox.claimBatch(50)).flatMap((row) =>
        row.kind === 'notification' && row.payload.type === 'queue'
          ? [{ name: row.payload.job.name, data: row.payload.job.data }]
          : []
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

    it('creates a pending invite, audits it and tells the invitee', async () => {
      expect(await create(1)).toMatchObject({
        type: 'created',
        invite: { id: inviteId(1), status: 'pending', role: 'editor' },
      });
      expect(await auditActions()).toEqual(['invite.created']);
      expect(await notifications()).toEqual([
        { name: 'notify-team-invite', data: { inviteId: inviteId(1) } },
      ]);
    });

    it('refuses a second pending invite for the same invitee, and audits or tells nothing for it', async () => {
      await create(1);

      expect(await create(2)).toEqual({ type: 'already-pending' });
      expect(await auditActions()).toEqual(['invite.created']);
      expect(await notifications()).toHaveLength(1);
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

    const joinAs = async (role: ChannelRole) => {
      expectOk(
        await repositories.channelInvites.create(
          invite(channel, 80, { inviteeUserId: OTHER_OWNER_ID, role }),
          auditOf(channel, 'invite.created', 80)
        )
      );
      expect(await accept(80, OTHER_OWNER_ID)).toMatchObject({ type: 'accepted' });
    };

    it.each<{ scenario: string; inviter: ChannelRole | 'outsider' | 'deleted'; accepted: boolean }>(
      [
        { scenario: 'a manager', inviter: 'manager', accepted: true },
        { scenario: 'an editor', inviter: 'editor', accepted: false },
        { scenario: 'someone off the team', inviter: 'outsider', accepted: false },
        { scenario: 'a deleted account', inviter: 'deleted', accepted: false },
      ]
    )('accepts an invite sent by $scenario: $accepted', async ({ inviter, accepted }) => {
      if (inviter !== 'outsider' && inviter !== 'deleted') await joinAs(inviter);
      await create(1, { invitedBy: inviter === 'deleted' ? null : OTHER_OWNER_ID });

      expect((await accept(1)).type).toBe(accepted ? 'accepted' : 'not-pending');
      expect(expectOk(await repositories.channelInvites.findById(inviteId(1)))?.status).toBe(
        accepted ? 'accepted' : 'pending'
      );
    });

    describe('listPendingFor', () => {
      const otherChannel = async () =>
        expectOk(
          await repositories.channels.create({
            userId: OTHER_OWNER_ID,
            handle: 'other',
            displayName: 'Other',
          })
        );

      const pendingIds = async (
        cursor: { createdAt: Date; id: string } | null = null,
        limit = 10
      ) =>
        expectOk(
          await repositories.channelInvites.listPendingFor(INVITEE_ID, { cursor, limit })
        ).map(({ id }) => id);

      it('lists the invitee own pending invites, newest first', async () => {
        const other = await otherChannel();
        await create(1);
        expectOk(
          await repositories.channelInvites.create(
            invite(other, 2, { invitedBy: OTHER_OWNER_ID }),
            auditOf(other, 'invite.created', 2, OTHER_OWNER_ID)
          )
        );

        expect(await pendingIds()).toEqual([inviteId(2), inviteId(1)]);
      });

      it.each([
        {
          scenario: 'an expired invite',
          close: async (n: number) => create(n, expired),
        },
        {
          scenario: 'a revoked invite',
          close: async (n: number) => {
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
          close: async (n: number) => {
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
          close: async (n: number) => {
            await create(n);
            await accept(n);
          },
        },
      ])('leaves out $scenario', async ({ close }) => {
        await close(1);

        expect(await pendingIds()).toEqual([]);
      });

      it('leaves out another user invite', async () => {
        await create(1, { inviteeUserId: OTHER_OWNER_ID });

        expect(await pendingIds()).toEqual([]);
      });

      it('walks the invites by keyset, one more row than the limit', async () => {
        const second = await otherChannel();
        const third = expectOk(
          await repositories.channels.create({
            userId: INVITEE_ID,
            handle: 'third',
            displayName: 'Third',
          })
        );
        for (const [index, from] of [channel, second, third].entries()) {
          expectOk(
            await repositories.channelInvites.create(
              invite(from, index + 1),
              auditOf(from, 'invite.created', index + 1)
            )
          );
        }
        const all = await pendingIds();

        const firstPage = expectOk(
          await repositories.channelInvites.listPendingFor(INVITEE_ID, { cursor: null, limit: 1 })
        );
        const [lastOfPage] = firstPage;

        expect(all).toHaveLength(3);
        expect(firstPage.map(({ id }) => id)).toEqual(all.slice(0, 2));
        expect(lastOfPage && (await pendingIds(lastOfPage))).toEqual(all.slice(1));
      });
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
