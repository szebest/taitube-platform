import { ErrorCodes, type Failure } from '@vp/errors';

export { type HandleTaken, handleTaken } from '@vp/errors';

export type ChannelNotFound = Failure<
  typeof ErrorCodes.CHANNEL_NOT_FOUND,
  { idOrHandle: string }
>;

export type CannotSubscribeToSelf = Failure<
  typeof ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF,
  { channelId: string }
>;

export type ChannelForbidden = Failure<typeof ErrorCodes.FORBIDDEN, { channelId: string }>;

export type SubscribeFailure = CannotSubscribeToSelf | ChannelForbidden;

export function channelNotFound(idOrHandle: string): ChannelNotFound {
  return { code: ErrorCodes.CHANNEL_NOT_FOUND, message: 'Channel not found', idOrHandle };
}

export function cannotSubscribeToSelf(channelId: string): CannotSubscribeToSelf {
  return {
    code: ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF,
    message: 'Cannot subscribe to your own channel',
    channelId,
  };
}

export function channelForbidden(channelId: string): ChannelForbidden {
  return {
    code: ErrorCodes.FORBIDDEN,
    message: 'Not allowed to manage this channel',
    channelId,
  };
}
