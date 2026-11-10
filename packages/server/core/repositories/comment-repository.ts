import type {
  AuthoredComment,
  Comment,
  CommentEditWrite,
  CommentSort,
  CommentThread,
  CreatorInboxComment,
  CreatorInboxFilter,
  ModerationRecord,
  NewChannelAuditEntry,
  NewCommentInput,
  NewCommentRemoval,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
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

/** Who is reading: anonymous is `null`. A viewer sees the public comments and their own. */
export type CommentViewer = Pick<UserContext, 'id'> | null;

export interface ListCommentThreadsOptions {
  viewer: CommentViewer;
  sort: CommentSort;
  window: CommentWindow;
}

export interface ListCommentRepliesOptions {
  viewer: CommentViewer;
  cursor: CommentReplyCursor | null;
  limit: number;
}

export interface ListCreatorInboxOptions {
  filter: CreatorInboxFilter;
  /** Only this author's comments, for the moderator who looks at who wrote one. */
  authorId?: string;
  cursor: CommentReplyCursor | null;
  limit: number;
}

export interface ListAuthoredCommentsOptions {
  cursor: CommentReplyCursor | null;
  limit: number;
}

export type CommentLocator = Pick<Comment, 'id' | 'videoId'>;

/**
 * Reads never return a deleted comment. Listings return up to `limit + 1` rows so the caller can
 * tell a further page exists. Every write that adds or removes comments moves
 * `videos.comments_count` in the same transaction, and counts only what is public: a published
 * comment of an author who is not shadow banned, under a root that is public too.
 *
 * Every read a viewer makes goes through the public scope. `findById` is the one exception: it
 * answers a comment in any moderation state, for the writes that act on it and for the worker.
 */
export interface CommentRepositoryPort {
  findById(id: string): Promise<Result<Comment | null, DatabaseUnavailable>>;
  /** Null for a comment the viewer may not see, which reads the same as one that is not there. */
  findVisible(
    viewer: CommentViewer,
    id: string
  ): Promise<Result<Comment | null, DatabaseUnavailable>>;
  listThreads(
    videoId: string,
    options: ListCommentThreadsOptions
  ): Promise<Result<CommentThread[], DatabaseUnavailable>>;
  listReplies(
    root: CommentLocator,
    options: ListCommentRepliesOptions
  ): Promise<Result<CommentThread[], DatabaseUnavailable>>;
  /**
   * The author's own comments and replies on the video that no one else can see: held, hidden or
   * shadowed. One batched read, so the author's count matches their list.
   */
  listOwnNonPublic(
    videoId: string,
    authorId: string
  ): Promise<Result<CommentThread[], DatabaseUnavailable>>;
  /**
   * Answers null, and writes nothing, when the parent was removed before the reply landed. The
   * thread counts the replies its author may see.
   */
  create(input: NewCommentInput): Promise<Result<CommentThread | null, DatabaseUnavailable>>;
  /**
   * A hold takes the comment, and the replies under it, off the count in the same transaction and
   * tells the moderators; the question flag is rewritten either way.
   */
  updateContent(
    id: string,
    content: string,
    edit: CommentEditWrite
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>>;
  /**
   * Removes the comment and, for a root, its replies; answers how many were removed. A moderator's
   * removal records its `audit` row, and a visible one its `removal` for the author's list, in the
   * same transaction.
   */
  remove(
    comment: CommentLocator,
    record?: ModerationRecord & { removal?: NewCommentRemoval }
  ): Promise<Result<number, DatabaseUnavailable>>;
  /** Pinning unpins whichever comment held the video's one pinned slot, and records `audit`. */
  setPinned(
    comment: CommentLocator,
    pinned: boolean,
    audit?: NewChannelAuditEntry
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>>;
  /**
   * Hearting is idempotent and answers null when the comment was removed meanwhile. The first heart
   * enqueues the author's notification in the same transaction.
   */
  setHearted(
    comment: CommentLocator,
    hearted: boolean
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>>;
  /**
   * The viewer's own live comments and replies, newest first, on videos they may still watch, up to
   * `limit + 1` rows.
   */
  listByAuthor(
    viewer: UserContext,
    options: ListAuthoredCommentsOptions
  ): Promise<Result<AuthoredComment[], DatabaseUnavailable>>;
  /**
   * Live comments on `ownerId`'s videos that the owner did not write, newest first. `unanswered`
   * keeps those without a later reply from the owner in the same thread; `reported` keeps those
   * with an open report.
   */
  listForOwner(
    ownerId: string,
    options: ListCreatorInboxOptions
  ): Promise<Result<CreatorInboxComment[], DatabaseUnavailable>>;
}
