import { ErrorCodes, type Failure } from '@vp/errors';

export type VideoNotFound = Failure<typeof ErrorCodes.VIDEO_NOT_FOUND, { videoId: string }>;
export type VideoForbidden = Failure<typeof ErrorCodes.FORBIDDEN, { videoId: string }>;
export type VideoVersionConflict = Failure<
  typeof ErrorCodes.VERSION_CONFLICT,
  { videoId: string; expectedVersion: number; actualVersion: number }
>;

export type ReadVideoFailure = VideoNotFound | VideoForbidden;

export function videoNotFound(videoId: string): VideoNotFound {
  return { code: ErrorCodes.VIDEO_NOT_FOUND, message: 'Video not found', videoId };
}

export function videoForbidden(videoId: string): VideoForbidden {
  return { code: ErrorCodes.FORBIDDEN, message: 'Not allowed to access this video', videoId };
}

export function videoVersionConflict(
  videoId: string,
  expectedVersion: number,
  actualVersion: number
): VideoVersionConflict {
  return {
    code: ErrorCodes.VERSION_CONFLICT,
    message: 'Video was modified by another request',
    videoId,
    expectedVersion,
    actualVersion,
  };
}
