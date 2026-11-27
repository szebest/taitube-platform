import type { CacheUnavailable } from '@kit/errors';
import type { Result } from '@kit/result';
import type { CommentThread } from '@vp/domain';

/** The first page of a video's top comments, over-fetched by one row, and its comment count. */
export interface HotComments {
  threads: CommentThread[];
  total: number;
}

/**
 * A read-through cache for the watch page. A miss or a dead cache falls through to the fetcher,
 * so the only failure a read reports is the fetcher's own.
 */
export interface CommentCachePort {
  getHot<E>(
    videoId: string,
    fetcher: () => Promise<Result<HotComments, E>>
  ): Promise<Result<HotComments, E>>;
  invalidate(videoId: string): Promise<Result<void, CacheUnavailable>>;
}
