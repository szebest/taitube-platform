import { type Failure } from '@kit/errors';
import { ErrorCodes } from '@vp/errors';

export type ReactionForbidden = Failure<typeof ErrorCodes.FORBIDDEN, { videoId: string }>;

export function reactionForbidden(videoId: string): ReactionForbidden {
  return { code: ErrorCodes.FORBIDDEN, message: 'Sign in to react to a video', videoId };
}
