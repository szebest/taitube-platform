export type ReactionType = 'LIKE' | 'DISLIKE';
export type ReactionInputType = 'LIKE' | 'DISLIKE' | 'NONE';

export interface VideoReaction {
  id: string;
  videoId: string;
  userId: string;
  type: ReactionType;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReactionCounts {
  likesCount: number;
  dislikesCount: number;
}

export interface SetReactionResult {
  previousType: ReactionType | null;
  newType: ReactionType | null;
  likesCount: number;
  dislikesCount: number;
}
