import type { HotComments } from '@vp/core/ports';
import { inProcessAppConfig } from '@vp/env-schema';
import { cacheUnavailable, databaseUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { err, ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { InMemoryCacheClient } from '../../in-memory/in-memory-cache-client';
import { RedisCommentCacheAdapter } from '../redis-comment-cache.adapter';

const { hotTtlSeconds } = inProcessAppConfig().caches.comments;
const VIDEO_ID = 'video-1';

const HOT: HotComments = {
  total: 3,
  threads: [
    {
      id: 'c-1',
      videoId: VIDEO_ID,
      authorId: 'u-1',
      parentId: null,
      content: 'first',
      isPinned: true,
      isEdited: false,
      likeCount: 2,
      createdAt: new Date('2026-03-01T12:00:00.000Z'),
      updatedAt: new Date('2026-03-01T12:05:00.000Z'),
      author: {
        userId: 'u-1',
        channelId: 'ch-1',
        handle: 'first',
        displayName: 'First',
        avatarUrl: null,
      },
      replyCount: 2,
    },
  ],
};

describe('RedisCommentCacheAdapter', () => {
  let cache: InMemoryCacheClient;
  let adapter: RedisCommentCacheAdapter;
  let fetches: number;

  const fetcher = async () => {
    fetches += 1;
    return ok(HOT);
  };

  beforeEach(() => {
    fetches = 0;
    cache = new InMemoryCacheClient();
    adapter = new RedisCommentCacheAdapter({ cache, hotTtlSeconds });
  });

  it('reads through once and answers the same page, dates included, after that', async () => {
    expect(expectOk(await adapter.getHot(VIDEO_ID, fetcher))).toStrictEqual(HOT);
    expect(expectOk(await adapter.getHot(VIDEO_ID, fetcher))).toStrictEqual(HOT);

    expect(fetches).toBe(1);
    expect(expectOk(await cache.get(CacheKeys.videoHotComments(VIDEO_ID)))).not.toBeNull();
  });

  it('refetches after an invalidation', async () => {
    expectOk(await adapter.getHot(VIDEO_ID, fetcher));
    expectOk(await adapter.invalidate(VIDEO_ID));
    expectOk(await adapter.getHot(VIDEO_ID, fetcher));

    expect(fetches).toBe(2);
  });

  it('passes the fetcher failure through and caches nothing', async () => {
    const failing = async () => err(databaseUnavailable('listCommentThreads'));

    expectErr(await adapter.getHot(VIDEO_ID, failing));

    expect(expectOk(await cache.get(CacheKeys.videoHotComments(VIDEO_ID)))).toBeNull();
  });

  it('treats an unreadable entry as a miss', async () => {
    expectOk(await cache.set(CacheKeys.videoHotComments(VIDEO_ID), '{"threads":"nope"}'));

    expect(expectOk(await adapter.getHot(VIDEO_ID, fetcher))).toStrictEqual(HOT);
    expect(fetches).toBe(1);
  });

  it('falls through to the source when the cache is unusable', async () => {
    const broken = new RedisCommentCacheAdapter({
      hotTtlSeconds,
      cache: Object.assign(new InMemoryCacheClient(), {
        get: async () => err(cacheUnavailable('get')),
        set: async () => err(cacheUnavailable('set')),
      }),
    });

    expect(expectOk(await broken.getHot(VIDEO_ID, fetcher))).toStrictEqual(HOT);
    expect(fetches).toBe(1);
  });
});
