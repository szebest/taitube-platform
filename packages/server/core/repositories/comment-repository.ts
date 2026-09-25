import type { Comment, CommentSort, CommentThread, NewCommentInput } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/** Every key either sort orders by; `newest` reads all but `likeCount`. */
export interface CommentThreadCursor {
  isPinned: boolean;
  likeCount: number;
  createdAt: Date;
  id: string;
}

export interface CommentReplyCursor {
  createdAt: Date;
  id: string;
}

/** `offset` serves the legacy `page`/`size` query; everything new walks the keyset. */
export type CommentWindow =
  | { type: 'keyset'; cursor: CommentThreadCursor | null; limit: number }
  | { type: 'offset'; offset: number; limit: number };

export interface ListCommentThreadsOptions {
  sort: CommentSort;
  window: CommentWindow;
}

export interface ListCommentRepliesOptions {
  cursor: CommentReplyCursor | null;
  limit: number;
}

export type CommentLocator = Pick<Comment, 'id' | 'videoId'>;

/**
 * Reads never return a deleted comment. Listings return up to `limit + 1` rows so the caller can
 * tell a further page exists. Every write that adds or removes comments moves
 * `videos.comments_count` in the same transaction.
 */
export interface CommentRepositoryPort {
  findById(id: string): Promise<Result<Comment | null, DatabaseUnavailable>>;
  listThreads(
    videoId: string,
    options: ListCommentThreadsOptions
  ): Promise<Result<CommentThread[], DatabaseUnavailable>>;
  listReplies(
    root: CommentLocator,
    options: ListCommentRepliesOptions
  ): Promise<Result<CommentThread[], DatabaseUnavailable>>;
  /** Answers null, and writes nothing, when the parent was removed before the reply landed. */
  create(input: NewCommentInput): Promise<Result<CommentThread | null, DatabaseUnavailable>>;
  updateContent(
    id: string,
    content: string
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>>;
  /** Removes the comment and, for a root, its replies; answers how many were removed. */
  remove(comment: CommentLocator): Promise<Result<number, DatabaseUnavailable>>;
  /** Pinning unpins whichever comment held the video's one pinned slot. */
  setPinned(
    comment: CommentLocator,
    pinned: boolean
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>>;
}
