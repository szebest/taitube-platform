import type { Result } from '@kit/result';
import type {
  ChannelPost,
  ChannelPostCursor,
  ChannelPostEntry,
  NewChannelAuditEntry,
  NewChannelPostInput,
  PostPayload,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export interface ListChannelPostsOptions {
  /** Whose like each entry reports; anonymous is `null`. */
  viewerId: string | null;
  cursor: ChannelPostCursor | null;
  limit: number;
}

export interface ChannelPostEdit {
  payload: PostPayload;
  commentsEnabled: boolean;
}

export type ChannelPostEdited =
  | { type: 'edited'; post: ChannelPost }
  | { type: 'stale'; version: number }
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
  publish(
    input: NewChannelPostInput,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelPost, DatabaseUnavailable>>;
  /** Applies only while the post is still at `version`, and moves it one version on. */
  edit(
    id: string,
    version: number,
    edit: ChannelPostEdit,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelPostEdited, DatabaseUnavailable>>;
  /** False when the post was already gone. */
  remove(id: string, audit: NewChannelAuditEntry): Promise<Result<boolean, DatabaseUnavailable>>;
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
