import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { ActingChannel, ActingRole, ChannelRole } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { seedTeamMember } from '../../__tests__/test-app';
import { ChannelMemberService } from '../channel-member-service';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000017b1', role: 'USER' };
const MEMBER_ID = '00000000-0000-7000-8000-0000000017b2';

async function setup(role: ChannelRole = 'editor') {
  const repositories = new InMemoryRepositories();
  const channelId = await seedTeamMember(repositories, {
    ownerId: OWNER.id,
    memberId: MEMBER_ID,
    role,
  });
  expectOk(
    await repositories.channels.create({ userId: MEMBER_ID, handle: 'ada', displayName: 'Ada' })
  );
  const service = new ChannelMemberService({
    members: repositories.channelMembers,
    invites: repositories.channelInvites,
    channels: repositories.channels,
  });
  const as = (actingRole: ActingRole): { user: UserContext; acting: ActingChannel } => ({
    user:
      actingRole === 'owner'
        ? OWNER
        : {
            id: MEMBER_ID,
            role: 'USER',
            memberships: { [channelId]: { role: actingRole, ownerId: OWNER.id } },
          },
    acting: { channelId, ownerId: OWNER.id, role: actingRole },
  });
  const auditActions = async () =>
    expectOk(await repositories.channelAudit.list(channelId, { cursor: null, limit: 10 })).map(
      ({ action }) => action
    );
  return { channelId, service, as, auditActions };
}

describe('apps/server/api/services: ChannelMemberService', () => {
  it('lists the team with each member as their own channel shows them', async () => {
    const { service, as } = await setup();
    const { user, acting } = as('owner');

    expect(expectOk(await service.team(user, acting))).toEqual({
      members: [
        expect.objectContaining({
          userId: MEMBER_ID,
          role: 'editor',
          profile: { handle: 'ada', displayName: 'Ada', avatarUrl: null },
        }),
      ],
      invites: [],
    });
  });

  it('refuses the team to an editor', async () => {
    const { service, as } = await setup();
    const { user, acting } = as('editor');

    expect(expectErr(await service.team(user, acting)).code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('changes a role and audits who changed it', async () => {
    const { service, as, auditActions } = await setup();
    const { user, acting } = as('owner');

    expect(expectOk(await service.changeRole(user, acting, MEMBER_ID, 'moderator'))).toMatchObject({
      userId: MEMBER_ID,
      role: 'moderator',
    });
    expect(await auditActions()).toContain('member.role_changed');
  });

  it.each([
    {
      scenario: 'the user is not on the team',
      userId: '00000000-0000-7000-8000-0000000017b9',
      code: ErrorCodes.CHANNEL_MEMBER_NOT_FOUND,
    },
    {
      scenario: 'the user is the owner',
      userId: OWNER.id,
      code: ErrorCodes.CHANNEL_OWNER_IMMUTABLE,
    },
  ])('refuses a role change when $scenario', async ({ userId, code }) => {
    const { service, as } = await setup();
    const { user, acting } = as('owner');

    expect(expectErr(await service.changeRole(user, acting, userId, 'editor')).code).toBe(code);
  });

  it.each<{ scenario: string; actor: ActingRole; action: string }>([
    { scenario: 'the owner removes the member', actor: 'owner', action: 'member.removed' },
    { scenario: 'the member leaves', actor: 'editor', action: 'member.left' },
  ])('$scenario: audited as $action, and gone', async ({ actor, action }) => {
    const { service, as, auditActions } = await setup();
    const { user, acting } = as(actor);

    expectOk(await service.remove(user, acting, MEMBER_ID));

    expect(await auditActions()).toContain(action);
    expect(expectOk(await service.memberships(as('editor').user)).items).toEqual([]);
    expect(expectErr(await service.remove(user, acting, MEMBER_ID)).code).toBe(
      ErrorCodes.CHANNEL_MEMBER_NOT_FOUND
    );
  });

  it('lists the channels the caller works on with their role', async () => {
    const { channelId, service, as } = await setup('analytics');

    expect(expectOk(await service.memberships(as('analytics').user))).toEqual({
      items: [
        {
          channelId,
          role: 'analytics',
          channel: { handle: 'team-owner', displayName: 'Owner', avatarUrl: null },
        },
      ],
    });
  });
});
