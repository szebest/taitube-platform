import type {
  ReactionCounts,
  ReactionInputType,
  ReactionType,
  SetReactionResult,
  VideoReaction,
} from '../domain/reaction';

export type {
  ReactionCounts,
  ReactionInputType,
  ReactionType,
  SetReactionResult,
  VideoReaction,
};

export interface VideoReactionRepositoryPort {
  getUserReaction(videoId: string, userId: string): Promise<ReactionType | null>;
  getReactionCounts(videoId: string): Promise<ReactionCounts>;
  setReaction(
    videoId: string,
    userId: string,
    type: ReactionInputType
  ): Promise<SetReactionResult>;
  countGroundTruth(videoId: string): Promise<ReactionCounts>;
  updateVideoCounters(
    videoId: string,
    likesCount: number,
    dislikesCount: number
  ): Promise<void>;
  listVideoIdsWithReactions(limit?: number, offset?: number): Promise<string[]>;
}

