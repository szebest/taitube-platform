import type { CommentModerationReason } from './comment-moderation';
import type { Disclosure } from './comment-settings';

export const COMMENT_REMOVAL_EXCERPT_LENGTH = 200;
export const COMMENT_REMOVAL_RETENTION_DAYS = 30;

/** What 42's soft delete keeps for the author's list: the reason and the start of the text. */
export interface CommentRemoval {
  id: string;
  channelId: string;
  videoId: string;
  authorId: string;
  excerpt: string;
  reason: CommentModerationReason;
  note: string | null;
  disclosure: Disclosure;
  removedBy: string | null;
  createdAt: Date;
}

export type NewCommentRemoval = Omit<CommentRemoval, 'createdAt'>;
