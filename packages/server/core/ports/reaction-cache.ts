import type { ReactionCounts, ReactionType } from '@vp/domain';

export interface ReactionCachePort {
  getCounts(videoId: string, fetcher: () => Promise<ReactionCounts>): Promise<ReactionCounts>;
  getUserReaction(
    userId: string,
    videoId: string,
    fetcher: () => Promise<ReactionType | null>
  ): Promise<ReactionType | null>;
  setCounts(videoId: string, counts: ReactionCounts): Promise<void>;
  setUserReaction(
    userId: string,
    videoId: string,
    reaction: ReactionType | null
  ): Promise<void>;
  adjustCounters(videoId: string, deltaLikes: number, deltaDislikes: number): Promise<void>;
  invalidate(videoId: string): Promise<void>;
}
