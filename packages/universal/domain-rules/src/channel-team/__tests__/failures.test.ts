import { ErrorCodes } from '@vp/errors';
import {
  channelInviteAlreadyPending,
  channelInviteNotFound,
  channelInviteNotPending,
  channelMemberExists,
  channelMemberNotFound,
  channelMembershipRequired,
  channelOwnerImmutable,
} from '../failures';

describe('@vp/domain-rules: channel team failures', () => {
  it.each([
    {
      failure: channelMembershipRequired('chan-9'),
      expected: { code: ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED, channelId: 'chan-9' },
    },
    {
      failure: channelInviteNotFound('inv-1'),
      expected: { code: ErrorCodes.CHANNEL_INVITE_NOT_FOUND, inviteId: 'inv-1' },
    },
    {
      failure: channelInviteNotPending('inv-1'),
      expected: { code: ErrorCodes.CHANNEL_INVITE_NOT_PENDING, inviteId: 'inv-1' },
    },
    {
      failure: channelInviteAlreadyPending('usr-2'),
      expected: { code: ErrorCodes.CHANNEL_INVITE_ALREADY_PENDING, inviteeUserId: 'usr-2' },
    },
    {
      failure: channelMemberExists('usr-2'),
      expected: { code: ErrorCodes.CHANNEL_MEMBER_EXISTS, userId: 'usr-2' },
    },
    {
      failure: channelMemberNotFound('usr-2'),
      expected: { code: ErrorCodes.CHANNEL_MEMBER_NOT_FOUND, userId: 'usr-2' },
    },
    {
      failure: channelOwnerImmutable(),
      expected: { code: ErrorCodes.CHANNEL_OWNER_IMMUTABLE },
    },
  ])('$expected.code names what it refers to', ({ failure, expected }) => {
    expect(failure).toMatchObject(expected);
  });
});
