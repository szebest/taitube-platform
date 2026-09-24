import type { VideoStatus } from '@vp/domain';
import { ErrorCodes, type Failure } from '@vp/errors';

export type VideoNotFound = Failure<typeof ErrorCodes.VIDEO_NOT_FOUND, { videoId: string }>;
/**
 * `readable` records what the caller could already see. A refusal on a video they cannot read has
 * to be disguised as absent, or the 403 confirms the id; a refusal to *edit* a video they can read
 * hides nothing, so it stays a 403. The rule knows which; nothing downstream has to guess.
 */
export type VideoForbidden = Failure<
  typeof ErrorCodes.FORBIDDEN,
  { videoId: string; readable: boolean }
>;
export type VideoReadRequiresAuth = Failure<typeof ErrorCodes.UNAUTHORIZED, { videoId: string }>;
export type VideoStatusNotEligible = Failure<
  typeof ErrorCodes.VALIDATION_FAILED,
  { videoId: string; status: VideoStatus; eligible: readonly VideoStatus[] }
>;

export type ReadVideoFailure = VideoNotFound | VideoForbidden | VideoReadRequiresAuth;

export function videoNotFound(videoId: string): VideoNotFound {
  return { code: ErrorCodes.VIDEO_NOT_FOUND, message: 'Video not found', videoId };
}

export function videoForbidden(videoId: string): VideoForbidden {
  return {
    code: ErrorCodes.FORBIDDEN,
    message: 'Not allowed to access this video',
    videoId,
    readable: false,
  };
}

export function videoEditForbidden(videoId: string): VideoForbidden {
  return {
    code: ErrorCodes.FORBIDDEN,
    message: 'Not allowed to edit this video',
    videoId,
    readable: true,
  };
}

export function videoReadRequiresAuth(videoId: string): VideoReadRequiresAuth {
  return {
    code: ErrorCodes.UNAUTHORIZED,
    message: 'Authentication required to view private video',
    videoId,
  };
}

export function videoStatusNotEligible(
  videoId: string,
  status: VideoStatus,
  eligible: readonly VideoStatus[]
): VideoStatusNotEligible {
  return {
    code: ErrorCodes.VALIDATION_FAILED,
    message: `Cannot perform this action on a video with status ${status}. Must be ${eligible.join(', ')}.`,
    videoId,
    status,
    eligible,
  };
}
