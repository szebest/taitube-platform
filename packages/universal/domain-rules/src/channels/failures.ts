import { ErrorCodes, type Failure, type InputFailure } from '@vp/errors';

export { type HandleTaken, handleTaken } from '@vp/errors';

export type ChannelNotFound = Failure<typeof ErrorCodes.CHANNEL_NOT_FOUND, { idOrHandle: string }>;

export type CannotSubscribeToSelf = Failure<
  typeof ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF,
  { channelId: string }
>;

export type ChannelForbidden = Failure<typeof ErrorCodes.FORBIDDEN, { channelId: string }>;

export type UnsubscribeFailure = ChannelNotFound | ChannelForbidden;
export type SubscribeFailure = UnsubscribeFailure | CannotSubscribeToSelf;

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

export type HandleChangeTooSoon = Failure<
  typeof ErrorCodes.HANDLE_CHANGE_TOO_SOON,
  { availableAt: string }
>;

export type HandleReserved = Failure<
  typeof ErrorCodes.HANDLE_RESERVED,
  { handle: string; availableAt: string }
>;

export type SpotlightVideoProblem = 'missing' | 'not-owned' | 'not-ready' | 'not-public';

export type InvalidSpotlightVideo = InputFailure<
  typeof ErrorCodes.INVALID_SPOTLIGHT_VIDEO,
  { videoId: string; problem: SpotlightVideoProblem }
>;

export function handleChangeTooSoon(availableAt: Date): HandleChangeTooSoon {
  return {
    code: ErrorCodes.HANDLE_CHANGE_TOO_SOON,
    message: 'The handle was changed recently',
    availableAt: availableAt.toISOString(),
  };
}

export function handleReserved(handle: string, availableAt: Date): HandleReserved {
  return {
    code: ErrorCodes.HANDLE_RESERVED,
    message: `Handle "${handle}" is held for the channel that used it`,
    handle,
    availableAt: availableAt.toISOString(),
  };
}

export function invalidSpotlightVideo(
  field: string,
  videoId: string,
  problem: SpotlightVideoProblem
): InvalidSpotlightVideo {
  return {
    code: ErrorCodes.INVALID_SPOTLIGHT_VIDEO,
    message: 'A spotlight video must be a public, ready video of this channel',
    field,
    videoId,
    problem,
  };
}

export type ImageUploadNotFound = Failure<
  typeof ErrorCodes.IMAGE_UPLOAD_NOT_FOUND,
  { uploadId: string }
>;

export function imageUploadNotFound(uploadId: string): ImageUploadNotFound {
  return {
    code: ErrorCodes.IMAGE_UPLOAD_NOT_FOUND,
    message: 'No image upload of this channel is waiting to be completed',
    uploadId,
  };
}
