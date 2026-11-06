import type { ActingRole, ChannelMembership } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { decideMemberRemoval } from '../remove-member.rule';
import { CHANNEL_ID, OWNER_ID, actingAs, membership } from './team-personas';

function decide(
  role: ActingRole,
  {
    userId = 'member-2',
    member = membership(userId, 'editor'),
  }: { userId?: string; member?: ChannelMembership | null } = {}
) {
  return decideMemberRemoval({ ...actingAs(role), userId, member });
}

describe('@vp/domain-rules: decideMemberRemoval', () => {
  it.each<{ scenario: string; caller: ActingRole; target: ChannelMembership; action: string }>([
    {
      scenario: 'the owner removes a member',
      caller: 'owner',
      target: membership('member-2', 'manager'),
      action: 'member.removed',
    },
    {
      scenario: 'a manager removes an editor',
      caller: 'manager',
      target: membership('member-2', 'editor'),
      action: 'member.removed',
    },
    {
      scenario: 'an editor leaves',
      caller: 'editor',
      target: membership('editor-1', 'editor'),
      action: 'member.left',
    },
    {
      scenario: 'a manager leaves',
      caller: 'manager',
      target: membership('manager-1', 'manager'),
      action: 'member.left',
    },
  ])('$scenario: $action', ({ caller, target, action }) => {
    const { userId, role } = target;

    expect(expectOk(decide(caller, { userId, member: target }))).toEqual({
      member: { channelId: CHANNEL_ID, userId, role },
      action,
    });
  });

  it.each<{ scenario: string; input: Parameters<typeof decide>; code: string }>([
    { scenario: 'an editor removes someone else', input: ['editor'], code: ErrorCodes.FORBIDDEN },
    {
      scenario: 'a manager removes a manager',
      input: ['manager', { member: membership('member-2', 'manager') }],
      code: ErrorCodes.FORBIDDEN,
    },
    {
      scenario: 'a manager removes the owner',
      input: ['manager', { userId: OWNER_ID, member: null }],
      code: ErrorCodes.CHANNEL_OWNER_IMMUTABLE,
    },
    {
      scenario: 'the owner leaves',
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
