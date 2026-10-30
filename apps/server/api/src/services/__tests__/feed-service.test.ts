import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { Singleflight } from '@vp/concurrency';
import { publicFeedInstant } from '@vp/domain';
import { inProcessAppConfig } from '@vp/env-schema';
import { cacheUnavailable } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import { err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { ViewerProgress } from '../viewer-progress';
import { feedCursorPayload } from '../cursor';
import { FeedService, type FeedServiceDeps } from '../feed-service';
import { generateEtag } from '../http-cache';
import { VideoService } from '../video-service';
import { videoServiceDeps } from './service-deps';

const HTTP_CACHE = inProcessAppConfig().httpCache.feed;

const OWNER_ID = '00000000-0000-7000-8000-0000000000f1';
const CATEGORY_ID = '00000000-0000-7000-8000-0000000000f2';

describe('apps/server/api/services: FeedService', () => {
  let repositories: InMemoryRepositories;
  let cache: InMemoryCacheClient;
  let videoService: VideoService;
  let service: FeedService;

  const feedService = (overrides: Partial<FeedServiceDeps> = {}) =>
    new FeedService({
      singleflight: new Singleflight(),
      videoService,
      viewerProgress: new ViewerProgress(repositories.watchHistory),
      cache,
      ...HTTP_CACHE,
      ...overrides,
    });

  async function publish(
    id: string,
    categoryId?: string,
    format: 'standard' | 'short' = 'standard'
  ): Promise<void> {
    await repositories.videos.create({
      id,
      ownerId: OWNER_ID,
      title: `Video ${id}`,
      visibility: 'public',
      status: 'READY',
      format,
      sourceKey: `raw/${id}.mp4`,
      ...(categoryId ? { categoryId } : {}),
    });
  }

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    cache = new InMemoryCacheClient();
    videoService = new VideoService(
      videoServiceDeps(repositories.videos, { channels: repositories.channels })
    );
    service = feedService();
  });

  it('serves the weak sha256 ETag the shared http-cache functions compute', async () => {
    await publish('00000000-0000-7000-8000-0000000000f3');

    const page = expectOk(await service.getFeed({ sort: 'recent' }));

    expect(page.etag).toBe(generateEtag(page.data));
    expect(page.etag).toMatch(/^W\/"[a-f0-9]{16}"$/);
  });

  it('builds its Cache-Control through buildCacheHeaders', async () => {
    const page = expectOk(await service.getFeed({ sort: 'recent' }));

    expect(page.headers).toEqual({
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
      ETag: page.etag,
      Vary: 'Authorization',
    });
  });

  it('honours a configured freshness window', async () => {
    const tuned = feedService({ maxAgeSeconds: 5, staleWhileRevalidateSeconds: 10 });

    const page = expectOk(await tuned.getFeed({ sort: 'recent' }));

    expect(page.headers['Cache-Control']).toBe('public, max-age=5, stale-while-revalidate=10');
  });

  it('marks each card with the signed-in caller playhead and keeps that page out of shared caches', async () => {
    const watched = '00000000-0000-7000-8000-0000000000f3';
    const fresh = '00000000-0000-7000-8000-0000000000f4';
    const viewer = { id: '00000000-0000-7000-8000-0000000000f9', role: 'USER' } as const;
    await publish(watched);
    await publish(fresh);
    await repositories.watchHistory.record({
      id: '00000000-0000-7000-8000-000000000701',
      userId: viewer.id,
      videoId: watched,
      progressSeconds: 42,
      durationSeconds: 100,
      watchedAt: new Date('2026-03-01T12:00:00.000Z'),
    });

    const page = expectOk(await service.getFeed({ sort: 'recent' }, undefined, viewer));

    const viewerOf = (id: string) => page.data.items.find((item) => item.id === id)?.viewer;

    expect(viewerOf(watched)).toMatchObject({ progressSeconds: 42 });
    expect(viewerOf(fresh)).toBeNull();
    expect(page.headers['Cache-Control']).toMatch(/^private,/);
  });

  it.each([
    ['the exact tag', (etag: string) => etag],
    ['the tag without its weak marker', (etag: string) => etag.replace(/^W\//, '')],
  ])('reports not modified for %s', async (_label, present) => {
    const first = expectOk(await service.getFeed({ sort: 'recent' }));

    const second = expectOk(await service.getFeed({ sort: 'recent' }, present(first.etag)));

    expect(second.notModified).toBe(true);
    expect(second.etag).toBe(first.etag);
  });

  it('reports modified for an unrelated tag', async () => {
    const page = expectOk(await service.getFeed({ sort: 'recent' }, 'W/"0000000000000000"'));

    expect(page.notModified).toBe(false);
  });

  it('caches the first page and serves later reads without touching the repository', async () => {
    await publish('00000000-0000-7000-8000-0000000000f4');
    await service.getFeed({ sort: 'recent' });

    await publish('00000000-0000-7000-8000-0000000000f5');
    const cached = expectOk(await service.getFeed({ sort: 'recent' }));

    expect(cached.data.items).toHaveLength(1);
  });

  it("shows a cached page's videos under their channel as it is now, not as it was cached", async () => {
    const channel = expectOk(
      await repositories.channels.create({ userId: OWNER_ID, handle: 'owner', displayName: 'Old' })
    );
    await publish('00000000-0000-7000-8000-0000000000f4');
    const first = expectOk(await service.getFeed({ sort: 'recent' }));

    expectOk(await repositories.channels.update(channel.id, { displayName: 'New' }));
    const second = expectOk(await service.getFeed({ sort: 'recent' }));

    expect(first.data.items[0]?.channel?.displayName).toBe('Old');
    expect(second.data.items[0]?.channel?.displayName).toBe('New');
    expect(second.etag).not.toBe(first.etag);
  });

  it.each([
    ['recent', undefined, 'taitube:feed:public:recent:standard:all'],
    ['recent', CATEGORY_ID, `taitube:feed:public:recent:standard:${CATEGORY_ID}`],
    ['popular', undefined, 'taitube:feed:public:popular:standard:all'],
  ] as const)('keys the %s/%s page under its own entry', async (sort, categoryId, key) => {
    await publish('00000000-0000-7000-8000-0000000000f6', CATEGORY_ID);

    await service.getFeed({ sort, ...(categoryId ? { categoryId } : {}) });

    expect(expectOk(await cache.get(key))).not.toBeNull();
  });

  it('serves only Shorts from getShorts and caches them apart from the standard feed', async () => {
    await publish('00000000-0000-7000-8000-0000000000f6');
    await publish('00000000-0000-7000-8000-0000000000f7', undefined, 'short');

    const page = expectOk(await service.getShorts({ limit: 20 }));

    expect(page.data.items.map((item) => item.id)).toEqual([
      '00000000-0000-7000-8000-0000000000f7',
    ]);
    expect(expectOk(await cache.get('taitube:feed:public:shorts:short:all'))).not.toBeNull();
    expect(expectOk(await cache.get('taitube:feed:public:recent:standard:all'))).toBeNull();
  });

  it('carries the Shorts a page served on its cursor, so the next page never repeats one', async () => {
    const ids = ['f8', 'f9', 'fa', 'fb'].map((n) => `00000000-0000-7000-8000-0000000000${n}`);
    for (const id of ids) await publish(id, undefined, 'short');

    const first = expectOk(await service.getShorts({ limit: 2 }));
    const second = expectOk(
      await service.getShorts({ limit: 2, cursor: first.data.nextCursor ?? '' })
    );

    const served = [...first.data.items, ...second.data.items].map((item) => item.id);
    expect(new Set(served)).toEqual(new Set(ids));
    expect(served).toHaveLength(4);
    expect(second.data.nextCursor).toBeNull();
  });

  it('resumes a trending walk from a cursor minted before the ranking shifted', async () => {
    const seeds = [
      { id: '00000000-0000-7000-8000-0000000000e1', ageHours: 0.5, viewsCount: 0 },
      { id: '00000000-0000-7000-8000-0000000000e2', ageHours: 6, viewsCount: 3 },
      { id: '00000000-0000-7000-8000-0000000000e3', ageHours: 40, viewsCount: 0 },
    ];
    for (const seed of seeds) {
      await publish(seed.id);
      const row = expectOk(await repositories.videos.findById(seed.id));
      if (!row) continue;
      row.createdAt = new Date(Date.now() - seed.ageHours * 3_600_000);
      row.viewsCount = seed.viewsCount;
    }

    const first = expectOk(await service.getFeed({ sort: 'trending', limit: 1 }));

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * 3_600_000);
    const second = expectOk(
      await service.getFeed({
        sort: 'trending',
        limit: 1,
        cursor: first.data.nextCursor ?? undefined,
      })
    );

    expect(first.data.items.map((item) => item.id)).toEqual([seeds[0]?.id]);
    expect(second.data.items.map((item) => item.id)).toEqual([seeds[1]?.id]);
  });

  it('never caches a cursored page', async () => {
    const cursor = new Paginator().encodeCursor(
      feedCursorPayload({ createdAt: new Date(), id: OWNER_ID, viewsCount: 0 }, publicFeedInstant())
    );

    await service.getFeed({ sort: 'recent', cursor });

    expect(expectOk(await cache.get('taitube:feed:public:recent:standard:all'))).toBeNull();
  });

  it('still answers when the cache is unavailable', async () => {
    const broken = feedService({
      cache: Object.assign(new InMemoryCacheClient(), {
        get: async () => err(cacheUnavailable('get')),
        set: async () => err(cacheUnavailable('set')),
      }),
    });

    expect(expectOk(await broken.getFeed({ sort: 'recent' }))).toMatchObject({
      notModified: false,
    });
  });
});
