import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters';
import { publicFeedInstant } from '@vp/domain';
import { encodeFeedCursor } from '../cursor';
import { FeedService } from '../feed-service';
import { HttpCacheService } from '../http-cache-service';
import { VideoService } from '../video-service';

const OWNER_ID = '00000000-0000-7000-8000-0000000000f1';
const CATEGORY_ID = '00000000-0000-7000-8000-0000000000f2';

describe('apps/api/services: FeedService', () => {
  let repositories: InMemoryRepositories;
  let cache: InMemoryCacheClient;
  let videoService: VideoService;
  let service: FeedService;

  async function publish(id: string, categoryId?: string): Promise<void> {
    await repositories.videos.create({
      id,
      ownerId: OWNER_ID,
      title: `Video ${id}`,
      visibility: 'public',
      status: 'READY',
      sourceKey: `raw/${id}.mp4`,
      ...(categoryId ? { categoryId } : {}),
    });
  }

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    cache = new InMemoryCacheClient();
    videoService = new VideoService({
      videos: repositories.videos,
      cdnBaseUrl: 'http://localhost:9000/public',
    });
    service = new FeedService({ videoService, cache });
  });

  it('serves a weak sha256 ETag from the one HttpCacheService implementation', async () => {
    await publish('00000000-0000-7000-8000-0000000000f3');

    const page = await service.getFeed({ sort: 'recent' });

    expect(page.etag).toBe(new HttpCacheService().generateEtag(page.data));
    expect(page.etag).toMatch(/^W\/"[a-f0-9]{16}"$/);
  });

  it('builds its Cache-Control through buildCacheHeaders', async () => {
    const page = await service.getFeed({ sort: 'recent' });

    expect(page.headers).toEqual({
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
      ETag: page.etag,
    });
  });

  it('honours a configured freshness window', async () => {
    const tuned = new FeedService({
      videoService,
      cache,
      maxAgeSeconds: 5,
      staleWhileRevalidateSeconds: 10,
    });

    const page = await tuned.getFeed({ sort: 'recent' });

    expect(page.headers['Cache-Control']).toBe('public, max-age=5, stale-while-revalidate=10');
  });

  it.each([
    ['the exact tag', (etag: string) => etag],
    ['the tag without its weak marker', (etag: string) => etag.replace(/^W\//, '')],
  ])('reports not modified for %s', async (_label, present) => {
    const first = await service.getFeed({ sort: 'recent' });

    const second = await service.getFeed({ sort: 'recent' }, present(first.etag));

    expect(second.notModified).toBe(true);
    expect(second.etag).toBe(first.etag);
  });

  it('reports modified for an unrelated tag', async () => {
    const page = await service.getFeed({ sort: 'recent' }, 'W/"0000000000000000"');

    expect(page.notModified).toBe(false);
  });

  it('caches the first page and serves later reads without touching the repository', async () => {
    await publish('00000000-0000-7000-8000-0000000000f4');
    await service.getFeed({ sort: 'recent' });

    await publish('00000000-0000-7000-8000-0000000000f5');
    const cached = await service.getFeed({ sort: 'recent' });

    expect(cached.data.items).toHaveLength(1);
  });

  it.each([
    ['recent', undefined, 'taitube:feed:public:recent:all'],
    ['recent', CATEGORY_ID, `taitube:feed:public:recent:${CATEGORY_ID}`],
    ['popular', undefined, 'taitube:feed:public:popular:all'],
  ] as const)('keys the %s/%s page under its own entry', async (sort, categoryId, key) => {
    await publish('00000000-0000-7000-8000-0000000000f6', CATEGORY_ID);

    await service.getFeed({ sort, ...(categoryId ? { categoryId } : {}) });

    await expect(cache.get(key)).resolves.not.toBeNull();
  });

  it('resumes a trending walk from a cursor minted before the ranking shifted', async () => {
    const seeds = [
      { id: '00000000-0000-7000-8000-0000000000e1', ageHours: 0.5, viewsCount: 0 },
      { id: '00000000-0000-7000-8000-0000000000e2', ageHours: 6, viewsCount: 3 },
      { id: '00000000-0000-7000-8000-0000000000e3', ageHours: 40, viewsCount: 0 },
    ];
    for (const seed of seeds) {
      await publish(seed.id);
      const row = await repositories.videos.findById(seed.id);
      if (!row) continue;
      row.createdAt = new Date(Date.now() - seed.ageHours * 3_600_000);
      row.viewsCount = seed.viewsCount;
    }

    const first = await service.getFeed({ sort: 'trending', limit: 1 });

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * 3_600_000);
    const second = await service.getFeed({
      sort: 'trending',
      limit: 1,
      cursor: first.data.nextCursor ?? undefined,
    });
    vi.restoreAllMocks();

    expect(first.data.items.map((item) => item.id)).toEqual([seeds[0]?.id]);
    expect(second.data.items.map((item) => item.id)).toEqual([seeds[1]?.id]);
  });

  it('never caches a cursored page', async () => {
    const cursor = encodeFeedCursor(
      { createdAt: new Date(), id: OWNER_ID, viewsCount: 0 },
      publicFeedInstant()
    );

    await service.getFeed({ sort: 'recent', cursor });

    await expect(cache.get('taitube:feed:public:recent:all')).resolves.toBeNull();
  });

  it('still answers when the cache is unavailable', async () => {
    const broken = new FeedService({
      videoService,
      cache: Object.assign(new InMemoryCacheClient(), {
        get: async () => {
          throw new Error('redis down');
        },
        set: async () => {
          throw new Error('redis down');
        },
      }),
    });

    await expect(broken.getFeed({ sort: 'recent' })).resolves.toMatchObject({ notModified: false });
  });

  it('works with no cache wired at all', async () => {
    const uncached = new FeedService({ videoService });

    await expect(uncached.getFeed({ sort: 'recent' })).resolves.toMatchObject({
      data: { items: [], total: 0 },
    });
  });
});
