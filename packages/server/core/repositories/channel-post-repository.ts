import type { Result } from '@kit/result';
import type {
  ChannelPost,
  ChannelPostCursor,
  ChannelPostEntry,
  ManagedPostCursor,
  NewChannelAuditEntry,
  NewChannelPostInput,
  NewPostInput,
  NewUnpublishedPostInput,
  PostPayload,
  PostPinOutcome,
  PostStatus,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export interface ListChannelPostsOptions {
  /** Whose like each entry reports; anonymous is `null`. */
  viewerId: string | null;
  cursor: ChannelPostCursor | null;
  limit: number;
}

/** Where an unpublished post waits after an edit; absent leaves its status as it is. */
export type ChannelPostPlacement =
  | { status: 'draft'; publishAt: null }
  | { status: 'scheduled'; publishAt: Date };

/** Who saved the edit; a published post's edit records a revision with it, in the same transaction. */
export interface ChannelPostRevisionAuthor {
  authorUserId: string;
  restoredFromVersion: number | null;
}

export interface ChannelPostEdit {
  payload: PostPayload;
  commentsEnabled: boolean;
  placement?: ChannelPostPlacement;
  revision: ChannelPostRevisionAuthor;
}

/** What a channel holds at most, counted inside the transaction that adds a post. */
export interface PostWriteLimits {
  dailySince: Date;
  daily: number;
  pending: number;
}

export type ChannelPostCreated =
  | { type: 'created'; post: ChannelPost }
  | { type: 'daily_limit' }
  | { type: 'pending_limit' };

export interface ListManagedPostsOptions {
  /** One status, or every status when `null`. */
  status: PostStatus | null;
  cursor: ManagedPostCursor | null;
  limit: number;
}

export type ChannelPostEdited =
  | { type: 'edited'; post: ChannelPost }
  | { type: 'stale'; version: number }
  | { type: 'locked' }
  | { type: 'missing' };

/** Whether the viewer likes the post now, and its count after the write. */
export interface PostLikeWritten {
  liked: boolean;
  likeCount: number;
}

/**
 * A channel's posts. Listings return up to `limit + 1` published posts, pinned first then newest,
 * so the caller can tell a further page exists. `publish` writes the post, its audit row and the
 * job that tells the channel's subscribers in one transaction; `remove` takes the post's comments
 * with it.
 */
export interface ChannelPostRepositoryPort {
  findById(id: string): Promise<Result<ChannelPost | null, DatabaseUnavailable>>;
  /** The channel's posts created at or after `since`, published or not, for the daily limit. */
  countCreatedSince(channelId: string, since: Date): Promise<Result<number, DatabaseUnavailable>>;
  /**
   * Adds a post as published, a draft or a scheduled post, counting the channel's posts of the day
   * and its held posts under a lock on the channel row, so two requests cannot both take the last slot.
   */
  create(
    input: NewPostInput,
    audit: NewChannelAuditEntry,
    limits: PostWriteLimits
  ): Promise<Result<ChannelPostCreated, DatabaseUnavailable>>;
  publish(
    input: NewChannelPostInput,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelPost, DatabaseUnavailable>>;
  /**
   * Applies only while the post is still at `version`, and moves it one version on. With the post
   * row locked it counts the votes: a poll that has any keeps its question and options (`locked`).
   * Editing a published post appends the revision.
   */
  edit(
    id: string,
    version: number,
    edit: ChannelPostEdit,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelPostEdited, DatabaseUnavailable>>;
  /** False when the post was already gone. */
  remove(id: string, audit: NewChannelAuditEntry): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Draft and scheduled posts of the channel, for the daily-independent holding limit. */
  countPending(channelId: string): Promise<Result<number, DatabaseUnavailable>>;
  /** Writes a draft or a scheduled post; nothing is announced until it is promoted. */
  saveUnpublished(
    input: NewUnpublishedPostInput,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelPost, DatabaseUnavailable>>;
  /**
   * Publishes a draft or scheduled post once: a compare-and-set on its status, so a second call or
   * a second scheduler run finds it published and answers null. The subscriber job is written with it.
   */
  promote(
    id: string,
    audit: NewChannelAuditEntry | null
  ): Promise<Result<ChannelPost | null, DatabaseUnavailable>>;
  /** Promotes the scheduled posts due at `now`, oldest first; returns the ids this call published. */
  promoteDue(now: Date, limit: number): Promise<Result<string[], DatabaseUnavailable>>;
  /** Newest created first, every status, `limit + 1` rows; the studio list. */
  listManaged(
    channelId: string,
    options: ListManagedPostsOptions
  ): Promise<Result<ChannelPost[], DatabaseUnavailable>>;
  /**
   * Pins or unpins a published post of the channel; a pin past `limit` is refused inside the same
   * transaction, so two concurrent pins cannot make a fourth.
   */
  setPinned(
    id: string,
    channelId: string,
    pinned: boolean,
    limit: number,
    audit: NewChannelAuditEntry
  ): Promise<Result<PostPinOutcome, DatabaseUnavailable>>;
  listPublished(
    channelId: string,
    options: ListChannelPostsOptions
  ): Promise<Result<ChannelPostEntry[], DatabaseUnavailable>>;
  /** Published posts of the channels `subscriberChannelId` subscribes to, newest first. */
  listFeed(
    subscriberChannelId: string,
    options: ListChannelPostsOptions
  ): Promise<Result<ChannelPostEntry[], DatabaseUnavailable>>;
  isLiked(postId: string, userId: string): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Idempotent; null when the post is gone. */
  setLiked(
    postId: string,
    userId: string,
    liked: boolean
  ): Promise<Result<PostLikeWritten | null, DatabaseUnavailable>>;
}
