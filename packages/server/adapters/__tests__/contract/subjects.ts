import { expectOk } from '@kit/testing/result';
import type { NewVideoInput, Repositories, VideoRecord } from '@vp/core/repositories';
import type { CommentModerationFields, NewChannelPostInput } from '@vp/domain';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { InMemoryRepositories } from '../../in-memory/repositories/in-memory-repositories';
export interface RepositoriesSubject {
  readonly repositories: Repositories;
  /** `create` stamps its own `createdAt`; feed ordering needs rows placed in the past. */
  seedVideo(input: NewVideoInput, createdAt?: Date): Promise<VideoRecord>;
  /** No write path sets a like count or a past `createdAt`; ranking specs need both. */
  adjustComment(id: string, patch: CommentAdjustment): Promise<void>;
  /** `publish` stamps its own `createdAt`; export specs place posts on the days they are read by. */
  backdatePost(id: string, createdAt: Date): Promise<void>;
  /** `publish` stamps now and no write path pins; ordering specs place a post in the keyset directly. */
  placePost(id: string, patch: PostPlacement): Promise<void>;
  /** The port publishes only; a draft is the one state a spec cannot reach through it. */
  seedDraftPost(input: NewChannelPostInput): Promise<void>;
  /** Ordering specs place a playlist's last change in the past rather than waiting on a clock. */
  backdatePlaylist(id: string, updatedAt: Date): Promise<void>;
  /** Notifications are stamped by the clock; specs move what exists into the past instead of waiting. */
  ageNotifications(ms: number): Promise<void>;
  /**
   * Stamps the rows whose `key` is one of `ids` at distinct microseconds of the millisecond `at`, as
   * `now()` can while a cursor carries milliseconds; the lowest `key` gets the latest microsecond,
   * against a walk that breaks ties on it descending. A double holds a `Date`, nothing finer.
   */
  spreadAcrossMicroseconds(spread: MicrosecondSpread): Promise<void>;
  reset(): Promise<void>;
  close(): Promise<void>;
}

export type PostPlacement = Partial<{ pinnedAt: Date; publishedAt: Date }>;

interface MicrosecondSpread {
  stamp: AnyPgColumn;
  key: AnyPgColumn;
  ids: readonly string[];
  at: Date;
}

type CommentAdjustment = Partial<{ likeCount: number; createdAt: Date }> &
  Partial<CommentModerationFields>;

export type MakeRepositoriesSubject = () => Promise<RepositoriesSubject>;

export async function inMemorySubject(): Promise<RepositoriesSubject> {
  const repositories = new InMemoryRepositories();
  return {
    repositories,
    seedVideo: async (input, createdAt) => {
      const record = expectOk(await repositories.videos.create(input));
      if (createdAt) record.createdAt = createdAt;
      return record;
    },
    adjustComment: async (id, patch) => {
      const stored = expectOk(await repositories.comments.findById(id));
      if (!stored) throw new Error(`comment ${id} is not there to adjust`);
      Object.assign(stored, patch);
    },
    backdatePost: async (id, createdAt) => {
      const stored = repositories.channelPosts.posts.get(id);
      if (!stored) throw new Error(`post ${id} is not there to backdate`);
      stored.createdAt = createdAt;
    },
    placePost: async (id, patch) => {
      const stored = repositories.channelPosts.posts.get(id);
      if (!stored) throw new Error(`post ${id} is not there to place`);
      Object.assign(stored, patch);
    },
    seedDraftPost: async (input) => {
      repositories.channelPosts.posts.set(input.id, {
        ...input,
        status: 'draft',
        publishAt: null,
        publishedAt: null,
        pinnedAt: null,
        editedAt: null,
        likeCount: 0,
        commentsCount: 0,
        version: 1,
        createdAt: new Date(),
      });
    },
    backdatePlaylist: async (id, updatedAt) => {
      const stored = expectOk(await repositories.playlists.findById(id));
      if (!stored) throw new Error(`playlist ${id} is not there to backdate`);
      stored.updatedAt = updatedAt;
    },
    ageNotifications: async (ms) => repositories.notifications.age(ms),
    spreadAcrossMicroseconds: async () => {},
    reset: async () => {
      repositories.clear();
    },
    close: async () => {},
  };
}
