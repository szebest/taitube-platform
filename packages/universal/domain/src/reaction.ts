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

export interface ReactionDelta {
  likes: number;
  dislikes: number;
}

function held(type: ReactionType | null): ReactionDelta {
  return { likes: type === 'LIKE' ? 1 : 0, dislikes: type === 'DISLIKE' ? 1 : 0 };
}

/** How a video's counters move when a viewer's reaction changes from one type to another. */
export function reactionDelta(
  previous: ReactionType | null,
  next: ReactionType | null
): ReactionDelta {
  const before = held(previous);
  const after = held(next);
  return { likes: after.likes - before.likes, dislikes: after.dislikes - before.dislikes };
}
