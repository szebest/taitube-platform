import { ErrorCodes } from '@vp/errors';
import type { VideoForbidden } from '../videos/index';

/** Refused on a video the caller can already see, so the 403 confirms nothing new. */
export function analyticsForbidden(videoId: string): VideoForbidden {
  return {
    code: ErrorCodes.FORBIDDEN,
    message: 'Only the video owner can read its analytics',
    videoId,
    readable: true,
  };
}
