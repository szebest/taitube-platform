import type { Result } from '@kit/result';
import type { CommentTarget, CommentThread } from '@vp/domain';
import type { CacheUnavailable } from '@vp/errors';

/** The first page of a target's top comments, over-fetched by one row, and its comment count. */
export interface HotComments {
  threads: CommentThread[];
  total: number;
}

/**
 * A read-through cache for the first page under a video or a post. A miss or a dead cache falls through to the fetcher,
 * so the only failure a read reports is the fetcher's own.
 */
export interface CommentCachePort {
  getHot<E>(
    target: CommentTarget,
    fetcher: () => Promise<Result<HotComments, E>>
  ): Promise<Result<HotComments, E>>;
  invalidate(target: CommentTarget): Promise<Result<void, CacheUnavailable>>;
}
