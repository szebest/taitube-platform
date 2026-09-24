import type { NewVideoInput, Repositories, VideoRecord } from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
import { InMemoryRepositories } from '../../in-memory/repositories/in-memory-repositories';
export interface RepositoriesSubject {
  readonly repositories: Repositories;
  /** `create` stamps its own `createdAt`; feed ordering needs rows placed in the past. */
  seedVideo(input: NewVideoInput, createdAt?: Date): Promise<VideoRecord>;
  reset(): Promise<void>;
  close(): Promise<void>;
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
    reset: async () => {
      repositories.clear();
    },
    close: async () => {},
  };
}
