import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import { storageUnavailable } from '@vp/errors';
import { err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { runPurgeDeleted } from '../purge-deleted';
import { hoursAgo, seedVideo } from './housekeeping-harness';

const PLAYLIST = 'application/vnd.apple.mpegurl';

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

  const publicKeys = async (prefix: string) =>
    expectOk(await storage.listObjects({ bucket: 'public', prefix, maxKeys: 1500 })).keys;

  const put = async (bucket: string, key: string, contentType = PLAYLIST) =>
    expectOk(await storage.uploadObject({ bucket, key, body: key, contentType }));

  const seedReprocessedVideo = async () =>
    (await seedVideo(repositories, { status: 'READY', generation: 3 })).id;

  async function seedSoftDeleted(): Promise<{ videoId: string; sourceKey: string }> {
    const { id, sourceKey } = await seedVideo(repositories, {
      status: 'DELETED',
      deletedAt: hoursAgo(2),
      idleSince: hoursAgo(2),
    });
    await put('raw', sourceKey, 'video/mp4');
    return { videoId: id, sourceKey };
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

  it('removes the old generation and legacy playlist while keeping the ready one', async () => {
    const { id: videoId } = await seedVideo(repositories, { status: 'READY', generation: 2 });
    const hls = `videos/${videoId}/hls`;
    for (const key of ['g1/master.m3u8', 'g1/720p/index.m3u8', 'master.m3u8']) {
      await put('public', `${hls}/${key}`);
    }
    await put('public', `${hls}/g2/master.m3u8`);
    await put('public', `${hls}/g2/720p/index.m3u8`);

    expect((await purge()).purgedGenerationsCount).toBeGreaterThanOrEqual(1);

    expect(await publicKeys(`${hls}/`)).toEqual(
      expect.arrayContaining([`${hls}/g2/master.m3u8`, `${hls}/g2/720p/index.m3u8`])
    );
    expect(await publicKeys(`${hls}/g1/`)).toHaveLength(0);
    expect(expectOk(await storage.headObject('public', `${hls}/master.m3u8`))).toBeNull();
    expect((await purge()).purgedGenerationsCount).toBe(0);
  });

  it('purges every object of a soft-deleted video past one listing page and drops the row', async () => {
    const { videoId, sourceKey } = await seedSoftDeleted();
    const segmentCount = 1050;
    for (let i = 1; i <= segmentCount; i += 1) {
      await put('public', `videos/${videoId}/hls/720p/seg_${String(i).padStart(5, '0')}.ts`);
    }
    await put('public', `videos/${videoId}/hls/master.m3u8`);
    expect(await publicKeys(`videos/${videoId}/`)).toHaveLength(segmentCount + 1);

    expect((await purge()).purgedVideosCount).toBe(1);

    expect(expectOk(await storage.headObject('raw', sourceKey))).toBeNull();
    expect(await publicKeys(`videos/${videoId}/`)).toHaveLength(0);
    expect(expectOk(await repositories.videos.findById(videoId))).toBeNull();
  });

  it('keeps the soft-deleted row when the public purge fails, so the next run retries', async () => {
    const { videoId } = await seedSoftDeleted();
    const purgePrefix = storage.purgePrefix.bind(storage);
    vi.spyOn(storage, 'purgePrefix').mockImplementation((bucket, prefix) =>
      bucket === 'public'
        ? Promise.resolve(err(storageUnavailable('purgePrefix', '503 Service Unavailable')))
        : purgePrefix(bucket, prefix)
    );

    expect((await purge()).purgedVideosCount).toBe(0);
    expect(expectOk(await repositories.videos.findById(videoId))?.status).toBe('DELETED');
  });

  it('hard-deletes a soft-deleted video exactly once when two purges race', async () => {
    const { videoId } = await seedSoftDeleted();

    const [first, second] = await Promise.all([purge(), purge()]);

    expect(first.purgedVideosCount + second.purgedVideosCount).toBe(1);
    expect(expectOk(await repositories.videos.findById(videoId))).toBeNull();
  });
});
