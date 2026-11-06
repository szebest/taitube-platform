import type { ActingRole, ChannelRole } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { type InviteMemberInput, decideChannelInvite } from '../invite-member.rule';
import { CHANNEL_ID, OWNER_ID, actingAs } from './team-personas';

const NOW = new Date('2026-11-01T00:00:00.000Z');

function decide(
  role: ActingRole,
  overrides: Partial<Omit<InviteMemberInput, 'user' | 'acting'>> & { offered?: ChannelRole } = {}
) {
  const { offered = 'editor', ...rest } = overrides;
  return decideChannelInvite({
    ...actingAs(role),
    handle: 'invitee',
    invitee: { userId: 'invitee-1' },
    isMember: false,
    role: offered,
    id: 'inv-1',
    now: NOW,
    ...rest,
  });
}

describe('@vp/domain-rules: decideChannelInvite', () => {
  it('offers the role for fourteen days, sent by the caller', () => {
    expect(expectOk(decide('manager'))).toEqual({
      id: 'inv-1',
      channelId: CHANNEL_ID,
      inviteeUserId: 'invitee-1',
      role: 'editor',
      invitedBy: 'manager-1',
      expiresAt: new Date('2026-11-15T00:00:00.000Z'),
    });
  });

  it('lets the owner offer the manager role', () => {
    expect(expectOk(decide('owner', { offered: 'manager' })).role).toBe('manager');
  });

  it.each<{ scenario: string; input: Parameters<typeof decide>; code: string }>([
    { scenario: 'an editor invites', input: ['editor'], code: ErrorCodes.FORBIDDEN },
    { scenario: 'a moderator invites', input: ['moderator'], code: ErrorCodes.FORBIDDEN },
    {
      scenario: 'a manager offers the manager role',
      input: ['manager', { offered: 'manager' }],
      code: ErrorCodes.FORBIDDEN,
    },
    {
      scenario: 'no channel has the handle',
      input: ['owner', { invitee: null }],
      code: ErrorCodes.CHANNEL_NOT_FOUND,
    },
    {
      scenario: 'the invitee is on the team',
      input: ['owner', { isMember: true }],
      code: ErrorCodes.CHANNEL_MEMBER_EXISTS,
    },
    {
      scenario: 'the invitee is the owner',
      input: ['manager', { invitee: { userId: OWNER_ID } }],
      code: ErrorCodes.CHANNEL_MEMBER_EXISTS,
    },
  ])('refuses when $scenario', ({ input, code }) => {
    expect(expectErr(decide(...input)).code).toBe(code);
  });
});
