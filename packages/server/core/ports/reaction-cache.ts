import type { ReactionCounts, ReactionType } from '@vp/domain';
import type { CacheUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/**
 * The read-through methods take a fetcher and return whatever it returned, so a failure the
 * fetcher reports is the fetcher's, not the cache's. `CacheUnavailable` here means the cache
 * itself is gone, which a caller may deliberately narrow away by falling through.
 */
export interface ReactionCachePort {
  getCounts<E>(
    videoId: string,
    fetcher: () => Promise<Result<ReactionCounts, E>>
  ): Promise<Result<ReactionCounts, E | CacheUnavailable>>;
  getUserReaction<E>(
    userId: string,
    videoId: string,
    fetcher: () => Promise<Result<ReactionType | null, E>>
  ): Promise<Result<ReactionType | null, E | CacheUnavailable>>;
  setCounts(videoId: string, counts: ReactionCounts): Promise<Result<void, CacheUnavailable>>;
  setUserReaction(
    userId: string,
    videoId: string,
    reaction: ReactionType | null
  ): Promise<Result<void, CacheUnavailable>>;
  adjustCounters(
    videoId: string,
    deltaLikes: number,
    deltaDislikes: number
  ): Promise<Result<void, CacheUnavailable>>;
  invalidate(videoId: string): Promise<Result<void, CacheUnavailable>>;
}
