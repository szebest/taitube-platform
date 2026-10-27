export const COMMENT_SORTS = ['top', 'newest'] as const;

export type CommentSort = (typeof COMMENT_SORTS)[number];

export interface Comment {
  id: string;
  videoId: string;
  authorId: string;
  parentId: string | null;
  content: string;
  isPinned: boolean;
  isEdited: boolean;
  likeCount: number;
  heartedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The author's channel, absent for a user who never claimed one. */
interface CommentAuthor {
  userId: string;
  channelId: string | null;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface CommentThread extends Comment {
  author: CommentAuthor;
  replyCount: number;
}

export interface CommentVideoSummary {
  id: string;
  title: string;
}

export const CREATOR_INBOX_FILTERS = ['all', 'unanswered', 'reported'] as const;

export type CreatorInboxFilter = (typeof CREATOR_INBOX_FILTERS)[number];

export interface CreatorInboxComment extends CommentThread {
  video: CommentVideoSummary;
}

export interface NewCommentInput {
  id: string;
  videoId: string;
  authorId: string;
  parentId: string | null;
  content: string;
}

/**
 * Threads nest one level: a reply to a reply joins the root's thread instead of opening a
 * third level, the way a watch page renders it.
 */
export function threadRootId(comment: Pick<Comment, 'id' | 'parentId'>): string {
  return comment.parentId ?? comment.id;
}
