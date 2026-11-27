import type { HeldReason, ModerationState, NewCommentModeration } from './comment-moderation';
import type { Disclosure } from './comment-settings';

export const THREADS_OPEN_PER_VIEWER = 5;
export const THREADS_PINNED_LIMIT = 3;
export const THREAD_LIST_LIMIT = 200;
export const THREAD_MARKER_MIN_REPLIES = 2;
export const THREAD_MARKER_MIN_REPLIERS = 2;
export const THREAD_MARKER_MERGE_PERCENT = 1;
export const THREAD_MARKERS_DRAWN = 20;

export interface VideoThread {
  id: string;
  videoId: string;
  channelId: string;
  authorId: string;
  authorChannelId: string;
  anchorMs: number;
  title: string;
  body: string;
  pinnedAt: Date | null;
  commentsCount: number;
  moderationState: ModerationState;
  moderationDisclosure: Disclosure | null;
  heldReason: HeldReason | null;
  createdAt: Date;
}

export interface NewVideoThreadInput {
  id: string;
  videoId: string;
  channelId: string;
  authorId: string;
  authorChannelId: string;
  anchorMs: number;
  title: string;
  body: string;
  moderation: NewCommentModeration;
  /** The moderators told, in the same transaction, that a held thread is waiting. */
  moderators?: readonly string[];
}

interface ThreadAuthor {
  channelId: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * A thread with who wrote it. `replyCount` is what a reader sees; the marker rule reads
 * `markerReplies` and `markerRepliers`, which leave out shadow banned and banned authors.
 */
export interface VideoThreadEntry {
  thread: VideoThread;
  author: ThreadAuthor;
  replyCount: number;
  markerReplies: number;
  markerRepliers: number;
  /** The author is shadow banned on the channel: only they see the thread. */
  authorShadowed: boolean;
}

export type ThreadCreated = { type: 'created'; thread: VideoThread } | { type: 'limit' };

export type ThreadPinOutcome = 'pinned' | 'unpinned' | 'limit' | 'missing';
