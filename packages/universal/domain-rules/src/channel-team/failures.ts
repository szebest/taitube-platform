import { ErrorCodes, type Failure } from '@vp/errors';

export type ChannelMembershipRequired = Failure<
  typeof ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED,
  { channelId: string }
>;

export function channelMembershipRequired(channelId: string): ChannelMembershipRequired {
  return {
    code: ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED,
    message: 'You are no member of this channel',
    channelId,
  };
}

export type ChannelInviteNotFound = Failure<
  typeof ErrorCodes.CHANNEL_INVITE_NOT_FOUND,
  { inviteId: string }
>;

export type ChannelInviteNotPending = Failure<
  typeof ErrorCodes.CHANNEL_INVITE_NOT_PENDING,
  { inviteId: string }
>;

export type ChannelInviteAlreadyPending = Failure<
  typeof ErrorCodes.CHANNEL_INVITE_ALREADY_PENDING,
  { inviteeUserId: string }
>;

export type ChannelMemberExists = Failure<
  typeof ErrorCodes.CHANNEL_MEMBER_EXISTS,
  { userId: string }
>;

export type ChannelMemberNotFound = Failure<
  typeof ErrorCodes.CHANNEL_MEMBER_NOT_FOUND,
  { userId: string }
>;

export type ChannelOwnerImmutable = Failure<typeof ErrorCodes.CHANNEL_OWNER_IMMUTABLE>;

export function channelInviteNotFound(inviteId: string): ChannelInviteNotFound {
  return { code: ErrorCodes.CHANNEL_INVITE_NOT_FOUND, message: 'Invite not found', inviteId };
}

export function channelInviteNotPending(inviteId: string): ChannelInviteNotPending {
  return {
    code: ErrorCodes.CHANNEL_INVITE_NOT_PENDING,
    message: 'The invite was answered, revoked or has expired',
    inviteId,
  };
}

export function channelInviteAlreadyPending(inviteeUserId: string): ChannelInviteAlreadyPending {
  return {
    code: ErrorCodes.CHANNEL_INVITE_ALREADY_PENDING,
    message: 'This user already has a pending invite to the channel',
    inviteeUserId,
  };
}

export function channelMemberExists(userId: string): ChannelMemberExists {
  return {
    code: ErrorCodes.CHANNEL_MEMBER_EXISTS,
    message: 'This user is already on the channel team',
    userId,
  };
}

export function channelMemberNotFound(userId: string): ChannelMemberNotFound {
  return {
    code: ErrorCodes.CHANNEL_MEMBER_NOT_FOUND,
    message: 'This user is not on the channel team',
    userId,
  };
}

export function channelOwnerImmutable(): ChannelOwnerImmutable {
  return {
    code: ErrorCodes.CHANNEL_OWNER_IMMUTABLE,
    message: 'The channel owner cannot be removed or given a role',
  };
}
