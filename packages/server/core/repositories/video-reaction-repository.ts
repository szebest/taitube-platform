import type {
  ReactionCounts,
  ReactionInputType,
  ReactionType,
  SetReactionResult,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

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
  listVideoIdsWithReactions(
    limit?: number,
    offset?: number
  ): Promise<Result<string[], DatabaseUnavailable>>;
}
