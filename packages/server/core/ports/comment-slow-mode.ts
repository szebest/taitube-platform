import type { Result } from '@kit/result';
import type { CacheUnavailable } from '@vp/errors';

export type CommentSlowModeClaim =
  | { type: 'claimed' }
  | { type: 'refused'; retryAfterSeconds: number };

/** One comment window per author and channel, shared by every pod. */
export interface CommentSlowModePort {
  /** Starts the window when none is open; otherwise answers how long until it ends. */
  claim(
    channelId: string,
    authorId: string,
    windowSeconds: number
  ): Promise<Result<CommentSlowModeClaim, CacheUnavailable>>;
  /** Ends the window early, for a comment that was claimed and then not stored. */
  release(channelId: string, authorId: string): Promise<Result<void, CacheUnavailable>>;
}
