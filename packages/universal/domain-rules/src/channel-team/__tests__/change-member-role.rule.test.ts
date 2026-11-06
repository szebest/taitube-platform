import type { ActingRole, ChannelMembership, ChannelRole } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { decideMemberRoleChange } from '../change-member-role.rule';
import { CHANNEL_ID, OWNER_ID, actingAs, membership } from './team-personas';

function decide(
  role: ActingRole,
  {
    userId = 'member-2',
    member = membership(userId, 'editor'),
    to = 'moderator',
  }: { userId?: string; member?: ChannelMembership | null; to?: ChannelRole } = {}
) {
  return decideMemberRoleChange({ ...actingAs(role), userId, member, to });
}

describe('@vp/domain-rules: decideMemberRoleChange', () => {
  it.each<{ caller: ActingRole; held: ChannelRole; to: ChannelRole }>([
    { caller: 'manager', held: 'editor', to: 'moderator' },
    { caller: 'owner', held: 'editor', to: 'manager' },
    { caller: 'owner', held: 'manager', to: 'analytics' },
  ])('lets the $caller change $held to $to', ({ caller, held, to }) => {
    expect(expectOk(decide(caller, { member: membership('member-2', held), to }))).toEqual({
      channelId: CHANNEL_ID,
      userId: 'member-2',
      from: held,
      to,
    });
  });

  it.each<{ scenario: string; input: Parameters<typeof decide>; code: string }>([
    { scenario: 'an editor changes a role', input: ['editor'], code: ErrorCodes.FORBIDDEN },
    {
      scenario: 'a manager changes a manager',
      input: ['manager', { member: membership('member-2', 'manager'), to: 'editor' }],
      code: ErrorCodes.FORBIDDEN,
    },
    {
      scenario: 'a manager promotes to manager',
      input: ['manager', { to: 'manager' }],
      code: ErrorCodes.FORBIDDEN,
    },
    {
      scenario: 'a manager demotes the owner',
      input: ['manager', { userId: OWNER_ID, member: null }],
      code: ErrorCodes.CHANNEL_OWNER_IMMUTABLE,
    },
    {
      scenario: 'the owner gives themselves a role',
      input: ['owner', { userId: OWNER_ID, member: null }],
      code: ErrorCodes.CHANNEL_OWNER_IMMUTABLE,
    },
    {
      scenario: 'the user is not on the team',
      input: ['owner', { member: null }],
      code: ErrorCodes.CHANNEL_MEMBER_NOT_FOUND,
    },
  ])('refuses when $scenario', ({ input, code }) => {
    expect(expectErr(decide(...input)).code).toBe(code);
  });
});
