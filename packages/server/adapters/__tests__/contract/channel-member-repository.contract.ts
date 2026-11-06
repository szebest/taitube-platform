import type { Repositories } from '@vp/core/repositories';
import type { Channel, ChannelRole } from '@vp/domain';
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

    const roleChange = (from: ChannelRole, to: ChannelRole) =>
      repositories.channelMembers.changeRole(
        { channelId: channel.id, userId: INVITEE_ID, from, to },
        {
          channelId: channel.id,
          actorUserId: OWNER_ID,
          action: 'member.role_changed',
          targetType: 'member',
          targetId: INVITEE_ID,
          meta: { from, to },
        }
      );

    const removal = (role: ChannelRole) =>
      repositories.channelMembers.remove(
        { channelId: channel.id, userId: INVITEE_ID, role },
        memberAudit(channel, 'member.removed')
      );

    it('changes a role from the one read and audits it', async () => {
      expect(expectOk(await roleChange('editor', 'moderator'))?.role).toBe('moderator');
      expect(expectOk(await repositories.channelMembers.membershipsOf(INVITEE_ID))).toEqual([
        { channelId: channel.id, ownerId: OWNER_ID, role: 'moderator' },
      ]);
      expect((await auditActions())[0]).toBe('member.role_changed');
    });

    it('removes a member once, auditing only the removal that happened', async () => {
      expect(expectOk(await removal('editor'))).toBe(true);
      expect(expectOk(await removal('editor'))).toBe(false);
      expect(expectOk(await repositories.channelMembers.membershipsOf(INVITEE_ID))).toEqual([]);
      expect((await auditActions()).filter((action) => action === 'member.removed')).toHaveLength(
        1
      );
    });

    it('changes and removes nothing, and audits nothing, when the role moved since it was read', async () => {
      const before = await auditActions();

      expect(expectOk(await roleChange('manager', 'moderator'))).toBeNull();
      expect(expectOk(await removal('manager'))).toBe(false);
      expect(expectOk(await repositories.channelMembers.membershipsOf(INVITEE_ID))).toEqual([
        { channelId: channel.id, ownerId: OWNER_ID, role: 'editor' },
      ]);
      expect(await auditActions()).toEqual(before);
    });
  });
}
