import type {
  CommentModerationFields,
  HeldReason,
  NewCommentModeration,
} from './comment-moderation';
import type { Disclosure } from './comment-settings';

export const COMMENT_SORTS = ['top', 'newest'] as const;

export type CommentSort = (typeof COMMENT_SORTS)[number];

export interface Comment extends CommentModerationFields {
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

export const CREATOR_INBOX_FILTERS = [
  'all',
  'unanswered',
  'reported',
  'held',
  'hidden',
  'questions',
  'restricted',
] as const;

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
  /** Published when absent; the gate sets it for a comment it holds. */
  moderation?: NewCommentModeration;
  /** The moderators told, in the same transaction, that a held comment is waiting. */
  moderators?: readonly string[];
}

/** What an edit writes besides the text: the question flag, and the hold when the gate caught it. */
export interface CommentEditWrite {
  looksLikeQuestion: boolean;
  hold?: {
    reason: HeldReason;
    disclosure: Disclosure;
    /** The moderators told, in the same transaction, that the edited comment is waiting. */
    moderators: readonly string[];
  };
}

/**
 * Threads nest one level: a reply to a reply joins the root's thread instead of opening a
 * third level, the way a watch page renders it.
 */
export function threadRootId(comment: Pick<Comment, 'id' | 'parentId'>): string {
  return comment.parentId ?? comment.id;
}

function threadOrderKey(sort: CommentSort, thread: CommentThread): readonly (number | string)[] {
  const pinned = thread.isPinned ? 1 : 0;
  const created = thread.createdAt.getTime();
  return sort === 'top'
    ? [pinned, thread.likeCount, created, thread.id]
    : [pinned, created, thread.id];
}

/** The order a listing of root comments comes in: pinned first, then the sort, newest breaking ties. */
export function compareThreads(sort: CommentSort) {
  return (a: CommentThread, b: CommentThread): number => {
    const left = threadOrderKey(sort, a);
    const right = threadOrderKey(sort, b);
    const at = left.findIndex((part, index) => part !== right[index]);
    if (at === -1) return 0;
    return (left[at] ?? 0) > (right[at] ?? 0) ? -1 : 1;
  };
}
