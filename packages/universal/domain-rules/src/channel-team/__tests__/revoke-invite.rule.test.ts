import type { ActingRole, ChannelInvite } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { decideInviteRevoke } from '../revoke-invite.rule';
import { CHANNEL_ID, OWNER_ID, actingAs } from './team-personas';

function decide(role: ActingRole, invite: Partial<ChannelInvite> | null = {}) {
  return decideInviteRevoke({
    ...actingAs(role),
    inviteId: 'inv-1',
    invite: invite && {
      id: 'inv-1',
      channelId: CHANNEL_ID,
      inviteeUserId: 'invitee-1',
      role: 'editor',
      invitedBy: OWNER_ID,
      status: 'pending',
      createdAt: new Date(0),
      expiresAt: new Date(1),
      ...invite,
    },
  });
}

describe('@vp/domain-rules: decideInviteRevoke', () => {
  it.each<ActingRole>(['owner', 'manager'])('lets the %s revoke a pending invite', (role) => {
    expect(expectOk(decide(role)).id).toBe('inv-1');
  });

  it.each<{ scenario: string; input: Parameters<typeof decide>; code: string }>([
    { scenario: 'an editor revokes', input: ['editor'], code: ErrorCodes.FORBIDDEN },
    {
      scenario: 'a manager revokes a manager invite',
      input: ['manager', { role: 'manager' }],
      code: ErrorCodes.FORBIDDEN,
    },
    {
      scenario: 'there is no such invite',
      input: ['owner', null],
      code: ErrorCodes.CHANNEL_INVITE_NOT_FOUND,
    },
    {
      scenario: 'the invite is to another channel',
      input: ['owner', { channelId: 'chan-2' }],
      code: ErrorCodes.CHANNEL_INVITE_NOT_FOUND,
    },
    {
      scenario: 'the invite was answered',
      input: ['owner', { status: 'accepted' }],
      code: ErrorCodes.CHANNEL_INVITE_NOT_PENDING,
    },
  ])('refuses when $scenario', ({ input, code }) => {
    expect(expectErr(decide(...input)).code).toBe(code);
  });
});
