import { CacheKeys } from '@vp/events';
import { expectOk } from '@vp/testing/result';
import { InMemoryCacheClient } from '../../in-memory/in-memory-cache-client';
import { RedisPlayheadCacheAdapter } from '../redis-playhead-cache.adapter';

const USER = 'user-1';
const TTL_SECONDS = 604_800;

const progress = (videoId: string, progressSeconds: number) => ({
  videoId,
  progressSeconds,
  durationSeconds: 600,
  watchedAt: new Date('2026-03-01T12:00:00.000Z'),
  flushedAt: new Date('2026-03-01T11:59:00.000Z'),
});

describe('RedisPlayheadCacheAdapter', () => {
  let cache: InMemoryCacheClient;
  let adapter: RedisPlayheadCacheAdapter;

  beforeEach(() => {
    cache = new InMemoryCacheClient();
    adapter = new RedisPlayheadCacheAdapter({ cache, ttlSeconds: TTL_SECONDS });
  });

  it('answers a miss as null', async () => {
    expect(expectOk(await adapter.read(USER, 'video-1'))).toBeNull();
  });

  it('reads back the last playhead written, under the per-video key, for the buffer TTL', async () => {
    const set = vi.spyOn(cache, 'set');
    expectOk(await adapter.write(USER, progress('video-1', 40)));
    expectOk(await adapter.write(USER, progress('video-1', 45)));

    expect(expectOk(await adapter.read(USER, 'video-1'))).toEqual(progress('video-1', 45));
    expect(set).toHaveBeenLastCalledWith(
      CacheKeys.userPlayhead(USER, 'video-1'),
      expect.any(String),
      TTL_SECONDS
    );
  });

  it('forgets the playheads it is named, and keeps the rest', async () => {
    for (const videoId of ['video-1', 'video-2', 'video-3']) {
      expectOk(await adapter.write(USER, progress(videoId, 10)));
    }

    expectOk(await adapter.forget(USER, ['video-1', 'video-2']));

    expect(expectOk(await adapter.read(USER, 'video-1'))).toBeNull();
    expect(expectOk(await adapter.read(USER, 'video-2'))).toBeNull();
    expect(expectOk(await adapter.read(USER, 'video-3'))).not.toBeNull();
  });

  it.each([
    { scenario: 'is not JSON', raw: '{' },
    { scenario: 'has lost a field', raw: '{"progressSeconds":1}' },
    {
      scenario: 'predates the flush stamp',
      raw: '{"progressSeconds":1,"durationSeconds":2,"watchedAt":"2026-03-01T12:00:00.000Z"}',
    },
  ])('treats an entry that $scenario as a miss', async ({ raw }) => {
    expectOk(await cache.set(CacheKeys.userPlayhead(USER, 'video-1'), raw));

    expect(expectOk(await adapter.read(USER, 'video-1'))).toBeNull();
  });
});
