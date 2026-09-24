import { InMemoryJobQueue, type InMemoryRepositories } from '@vp/adapters/in-memory';
import type { NewOutboxInput, NewVideoInput, VideoRecord } from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

export const hoursAgo = (hours: number): Date => new Date(Date.now() - hours * HOUR_MS);

export type VideoSeed = Omit<NewVideoInput, 'id' | 'ownerId' | 'sourceKey'> & {
  idleSince?: Date;
};

export async function seedVideo(
  repositories: InMemoryRepositories,
  { idleSince, ...fields }: VideoSeed
): Promise<VideoRecord> {
  const id = uuidv7();
  const video = expectOk(
    await repositories.videos.create({
      id,
      ownerId: uuidv7(),
      sourceKey: `raw/${id}/source.mp4`,
      ...fields,
    })
  );
  if (idleSince) video.updatedAt = idleSince;
  return video;
}

export function inMemoryQueues(): (name: string) => InMemoryJobQueue {
  const queues = new Map<string, InMemoryJobQueue>();
  return (name) => {
    const existing = queues.get(name);
    if (existing) return existing;
    const created = new InMemoryJobQueue(name);
    queues.set(name, created);
    return created;
  };
}

export function queueOutboxEntry(
  queueName: string,
  data: unknown = {},
  jobId?: string,
  kind = queueName
): NewOutboxInput {
  return {
    kind,
    payload: {
      type: 'queue',
      queueName,
      job: { name: queueName, data, opts: jobId ? { jobId } : {} },
    },
  };
}
