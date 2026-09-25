import type { NewVideoInput, Repositories, VideoRecord } from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
import { InMemoryRepositories } from '../../in-memory/repositories/in-memory-repositories';
export interface RepositoriesSubject {
  readonly repositories: Repositories;
  /** `create` stamps its own `createdAt`; feed ordering needs rows placed in the past. */
  seedVideo(input: NewVideoInput, createdAt?: Date): Promise<VideoRecord>;
  /** No write path sets a like count or a past `createdAt`; ranking specs need both. */
  adjustComment(id: string, patch: CommentAdjustment): Promise<void>;
  /** Ordering specs place a playlist's last change in the past rather than waiting on a clock. */
  backdatePlaylist(id: string, updatedAt: Date): Promise<void>;
  reset(): Promise<void>;
  close(): Promise<void>;
}

interface CommentAdjustment {
  likeCount: number;
  createdAt: Date;
}

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
    backdatePlaylist: async (id, updatedAt) => {
      const stored = expectOk(await repositories.playlists.findById(id));
      if (!stored) throw new Error(`playlist ${id} is not there to backdate`);
      stored.updatedAt = updatedAt;
    },
    reset: async () => {
      repositories.clear();
    },
    close: async () => {},
  };
}
