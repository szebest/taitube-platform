import type { Repositories } from '@vp/core/repositories';
import type { Channel } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { INVITEE_ID, memberAudit, seedMember, seedTeam } from './channel-team-fixtures';
import { OTHER_OWNER_ID, OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

export function describeChannelMemberRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('ChannelMemberRepository contract', () => {
    let subject: RepositoriesSubject;
    let repositories: Repositories;
    let channel: Channel;

    const auditActions = async () =>
      expectOk(await repositories.channelAudit.list(channel.id, { cursor: null, limit: 50 })).map(
        (entry) => entry.action
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
      await seedMember(repositories, channel);
    });

    it('lists the members of a channel', async () => {
      expect(expectOk(await repositories.channelMembers.listByChannel(channel.id))).toMatchObject([
        { channelId: channel.id, userId: INVITEE_ID, role: 'editor', invitedBy: OWNER_ID },
      ]);
    });

    it('answers no memberships for a user who works on no channel', async () => {
      expect(expectOk(await repositories.channelMembers.membershipsOf(OTHER_OWNER_ID))).toEqual([]);
    });

    it('changes a role and audits it', async () => {
      const changed = expectOk(
        await repositories.channelMembers.changeRole(channel.id, INVITEE_ID, 'moderator', {
          channelId: channel.id,
          actorUserId: OWNER_ID,
          action: 'member.role_changed',
          targetType: 'member',
          targetId: INVITEE_ID,
          meta: { from: 'editor', to: 'moderator' },
        })
      );

      expect(changed?.role).toBe('moderator');
      expect(expectOk(await repositories.channelMembers.membershipsOf(INVITEE_ID))).toEqual([
        { channelId: channel.id, ownerId: OWNER_ID, role: 'moderator' },
      ]);
      expect((await auditActions())[0]).toBe('member.role_changed');
    });

    it('removes a member once, auditing only the removal that happened', async () => {
      const remove = () =>
        repositories.channelMembers.remove(
          channel.id,
          INVITEE_ID,
          memberAudit(channel, 'member.removed')
        );

      expect(expectOk(await remove())).toBe(true);
      expect(expectOk(await remove())).toBe(false);
      expect(expectOk(await repositories.channelMembers.membershipsOf(INVITEE_ID))).toEqual([]);
      expect((await auditActions()).filter((action) => action === 'member.removed')).toHaveLength(
        1
      );
    });
  });
}
