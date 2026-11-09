import type { ChannelInvite } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { decideInviteAnswer } from '../answer-invite.rule';
import { CHANNEL_ID, OWNER_ID } from './team-personas';

const INVITEE: UserContext = { id: 'invitee-1', role: 'USER' };

function decide(invite: Partial<ChannelInvite> | null = {}, user: UserContext = INVITEE) {
  return decideInviteAnswer({
    user,
    inviteId: 'inv-1',
    invite: invite && {
      id: 'inv-1',
      channelId: CHANNEL_ID,
      ownerId: OWNER_ID,
      inviteeUserId: INVITEE.id,
      role: 'editor',
      invitedBy: OWNER_ID,
      status: 'pending',
      createdAt: new Date(0),
      expiresAt: new Date(1),
      ...invite,
    },
  });
}

describe('@vp/domain-rules: decideInviteAnswer', () => {
  it('lets the invitee answer their pending invite', () => {
    expect(expectOk(decide()).id).toBe('inv-1');
  });

  it.each<{ scenario: string; input: Parameters<typeof decide>; code: string }>([
    {
      scenario: 'there is no such invite',
      input: [null],
      code: ErrorCodes.CHANNEL_INVITE_NOT_FOUND,
    },
    {
      scenario: 'the owner answers for the invitee',
      input: [{}, { id: OWNER_ID, role: 'USER' }],
      code: ErrorCodes.CHANNEL_INVITE_NOT_FOUND,
    },
    {
      scenario: 'a guest answers',
      input: [{ inviteeUserId: 'guest-1' }, { id: 'guest-1', role: 'GUEST' }],
      code: ErrorCodes.FORBIDDEN,
    },
    ...(['accepted', 'declined', 'revoked', 'expired'] as const).map((status) => ({
      scenario: `the invite is ${status}`,
      input: [{ status }] as Parameters<typeof decide>,
      code: ErrorCodes.CHANNEL_INVITE_NOT_PENDING,
    })),
  ])('refuses when $scenario', ({ input, code }) => {
    expect(expectErr(decide(...input)).code).toBe(code);
  });
});
