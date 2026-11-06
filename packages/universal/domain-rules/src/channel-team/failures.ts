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
