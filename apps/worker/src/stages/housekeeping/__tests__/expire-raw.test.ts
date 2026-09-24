import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import { storageUnavailable } from '@vp/errors';
import { err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { runExpireRaw } from '../expire-raw';
import { DAY_MS, seedVideo } from './housekeeping-harness';

describe('housekeeping: expire-raw', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;

  const expire = async () =>
    expectOk(await runExpireRaw({ repositories, storage, rawBucket: 'raw', retentionDays: 7 }));

  const expiredEvents = async (videoId: string) =>
    expectOk(await repositories.events.findByVideoId(videoId)).filter(
      (event) => event.type === 'video.raw_expired'
    );

  async function seedReadyVideo(): Promise<{ videoId: string; sourceKey: string }> {
    const { id: videoId, sourceKey } = await seedVideo(repositories, {
      status: 'READY',
      readyAt: new Date(Date.now() - 10 * DAY_MS),
    });
    expectOk(
      await storage.uploadObject({
        bucket: 'raw',
        key: sourceKey,
        body: 'raw source bytes',
        contentType: 'video/mp4',
      })
    );
    return { videoId, sourceKey };
  }

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
  });

  it('removes a raw source past retention and records it once', async () => {
    const { videoId, sourceKey } = await seedReadyVideo();

    expect(await expire()).toEqual({ expiredCount: 1 });
    expect(await expire()).toEqual({ expiredCount: 0 });

    expect(expectOk(await storage.headObject('raw', sourceKey))).toBeNull();
    expect(await expiredEvents(videoId)).toHaveLength(1);
  });

  it.each(['deleteObject', 'purgePrefix'] as const)(
    'records nothing and counts nothing when %s fails, so the next run retries',
    async (operation) => {
      const { videoId } = await seedReadyVideo();
      vi.spyOn(storage, operation).mockResolvedValue(err(storageUnavailable(operation)));

      expect(await expire()).toEqual({ expiredCount: 0 });
      expect(await expiredEvents(videoId)).toEqual([]);
    }
  );
});
