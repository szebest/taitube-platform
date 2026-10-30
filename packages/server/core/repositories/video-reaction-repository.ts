import type {
  LikedVideoEntry,
  ReactionCounts,
  ReactionInputType,
  ReactionType,
  SetReactionResult,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import type { Result } from '@vp/result';

interface LikedVideoCursor {
  likedAt: Date;
  id: string;
}

export interface ListLikedVideosOptions {
  cursor: LikedVideoCursor | null;
  limit: number;
}

export interface VideoReactionRepositoryPort {
  getUserReaction(
    videoId: string,
    userId: string
  ): Promise<Result<ReactionType | null, DatabaseUnavailable>>;
  getReactionCounts(videoId: string): Promise<Result<ReactionCounts, DatabaseUnavailable>>;
  setReaction(
    videoId: string,
    userId: string,
    type: ReactionInputType
  ): Promise<Result<SetReactionResult, DatabaseUnavailable>>;
  countGroundTruth(videoId: string): Promise<Result<ReactionCounts, DatabaseUnavailable>>;
  updateVideoCounters(
    videoId: string,
    likesCount: number,
    dislikesCount: number
  ): Promise<Result<void, DatabaseUnavailable>>;
  /**
   * The videos the viewer likes, newest like first, only those they may still watch, up to
   * `limit + 1` rows. A viewer's likes are private: there is no read of another user's.
   */
  listLiked(
    viewer: UserContext,
    options: ListLikedVideosOptions
  ): Promise<Result<LikedVideoEntry[], DatabaseUnavailable>>;
  listVideoIdsWithReactions(
    limit: number,
    offset?: number
  ): Promise<Result<string[], DatabaseUnavailable>>;
}
