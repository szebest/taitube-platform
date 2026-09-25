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
  createdAt: Date;
  updatedAt: Date;
}

/** The author's channel, absent for a user who never claimed one. */
export interface CommentAuthor {
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
