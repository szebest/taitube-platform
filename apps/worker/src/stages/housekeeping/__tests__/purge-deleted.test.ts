import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import { storageUnavailable } from '@vp/errors';
import { err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { runPurgeDeleted } from '../purge-deleted';

describe('housekeeping: purge-deleted', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;

  const purge = async () =>
    expectOk(
      await runPurgeDeleted({
        repositories,
        storage,
        rawBucket: 'raw',
        publicBucket: 'public',
        thresholdMs: 60_000,
      })
    );

  const purgedEvents = async (videoId: string) =>
    expectOk(await repositories.events.findByVideoId(videoId)).filter(
      (event) => event.type === 'video.generation_purged'
    );

  async function seedReprocessedVideo(): Promise<string> {
    const videoId = uuidv7();
    expectOk(
      await repositories.videos.create({
        id: videoId,
        ownerId: uuidv7(),
        sourceKey: `raw/${videoId}/source.mp4`,
        status: 'READY',
        generation: 3,
      })
    );
    return videoId;
  }

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
  });

  it('records the purge of every older generation once', async () => {
    const videoId = await seedReprocessedVideo();

    expect(await purge()).toEqual({ purgedVideosCount: 0, purgedGenerationsCount: 2 });
    expect(await purge()).toEqual({ purgedVideosCount: 0, purgedGenerationsCount: 0 });
    expect(await purgedEvents(videoId)).toHaveLength(1);
  });

  it('records nothing and counts nothing when every purge fails, so the next run retries', async () => {
    const videoId = await seedReprocessedVideo();
    vi.spyOn(storage, 'purgePrefix').mockResolvedValue(err(storageUnavailable('purgePrefix')));
    vi.spyOn(storage, 'deleteObject').mockResolvedValue(err(storageUnavailable('deleteObject')));

    expect(await purge()).toEqual({ purgedVideosCount: 0, purgedGenerationsCount: 0 });
    expect(await purgedEvents(videoId)).toEqual([]);
  });
});
