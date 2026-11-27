import type { ChannelPost } from './channel-post';
import type {
  CommentModerationFields,
  HeldReason,
  NewCommentModeration,
} from './comment-moderation';
import type { Disclosure } from './comment-settings';
import type { Video } from './video';

export const COMMENT_SORTS = ['top', 'newest'] as const;

export type CommentSort = (typeof COMMENT_SORTS)[number];

export const COMMENT_TARGET_TYPES = ['video', 'post', 'thread'] as const;

/** What a comment sits under; one table holds the comments of every kind. */
export type CommentTarget = { type: 'video'; id: string } | { type: 'post'; id: string };

/** What a comment sits under, loaded: the rules read its owner, channel and switches from it. */
export type CommentHost =
  | { type: 'video'; video: Video }
  | { type: 'post'; post: ChannelPost; ownerId: string };

/** The video a comment sits under, or null for a comment on anything else. */
export function commentVideoId(target: CommentTarget): string | null {
  return target.type === 'video' ? target.id : null;
}

export interface Comment extends CommentModerationFields {
  id: string;
  target: CommentTarget;
  /** The channel of the target, which moderates the comment. */
  channelId: string;
  authorId: string;
  authorChannelId: string;
  parentId: string | null;
  content: string;
  isPinned: boolean;
  isEdited: boolean;
  likeCount: number;
  heartedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The channel the comment was posted as, and the user behind it. */
interface CommentAuthor {
  userId: string;
  channelId: string;
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

/** The target an inbox row sits under, with the title the row shows. */
export interface CommentTargetSummary {
  type: CommentTarget['type'];
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
  /** Null for a comment on anything but a video; `targetSummary` names every kind. */
  video: CommentVideoSummary | null;
  targetSummary: CommentTargetSummary;
}

export interface NewCommentInput {
  id: string;
  target: CommentTarget;
  channelId: string;
  authorId: string;
  authorChannelId: string;
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
