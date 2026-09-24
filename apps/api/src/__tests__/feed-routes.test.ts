import type { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { bearer, buildInMemoryApp, seedVideo } from './in-memory-app';
import { SEEDED } from '@vp/testing';

const USER_1 = SEEDED.userId;
const USER_2 = '00000000-0000-7000-8000-000000000002';
const CAT_TECH = '10000000-0000-7000-8000-000000000001';
const CAT_MUSIC = '20000000-0000-7000-8000-000000000002';
const FEED_CACHE_CONTROL = 'public, max-age=30, stale-while-revalidate=60';

function videoId(n: number): string {
  return `018f0000-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`;
}

describe('apps/api public video feed', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let cache: InMemoryCacheClient;
  const userToken = mintToken({ sub: USER_1, role: 'user', ttl: '1h' });

  beforeAll(async () => {
    ({ app, repositories, cache } = await buildInMemoryApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repositories.clear();
    cache.clear();
  });

  it('serves anonymous callers the public READY videos with an ETag and Cache-Control', async () => {
    await seedVideo(repositories, { id: videoId(1), ownerId: USER_1, title: 'Public Video 1' });
    await seedVideo(repositories, { id: videoId(2), ownerId: USER_2, title: 'Public Video 2' });
    await seedVideo(repositories, {
      id: videoId(3),
      ownerId: USER_1,
      title: 'Private Video',
      visibility: 'private',
    });

    const res = await app.inject({ method: 'GET', url: '/v1/feed' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe(FEED_CACHE_CONTROL);
    expect(res.headers['etag']).toBeDefined();
    expect(res.headers['etag']).toMatch(/^W\/"[a-f0-9]+"/);
    const body = res.json();
    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.items.map((v: { title: string }) => v.title)).toEqual(
      expect.arrayContaining(['Public Video 1', 'Public Video 2'])
    );
    expect(body.items.some((v: { title: string }) => v.title === 'Private Video')).toBe(false);
  });

  it('answers a repeat request carrying the ETag with 304 Not Modified', async () => {
    await seedVideo(repositories, { id: videoId(11), ownerId: USER_1, title: 'Public Video 11' });

    const res1 = await app.inject({ method: 'GET', url: '/v1/feed' });
    expect(res1.statusCode).toBe(200);
    const etag = res1.headers['etag'] as string;
    expect(etag).toBeDefined();

    const res2 = await app.inject({
      method: 'GET',
      url: '/v1/feed',
      headers: { 'if-none-match': etag },
    });
    expect(res2.statusCode).toBe(304);
    expect(res2.body).toBe('');
    expect(res2.headers['etag']).toBe(etag);
    expect(res2.headers['cache-control']).toBe(FEED_CACHE_CONTROL);
  });

  it('orders ?sort=popular by views, highest first', async () => {
    for (const [n, title, viewsCount] of [
      [21, 'Low Views Video', 5],
      [22, 'Top Views Video', 5000],
      [23, 'Mid Views Video', 200],
    ] as const) {
      await seedVideo(repositories, { id: videoId(n), ownerId: USER_1, title, viewsCount });
    }

    const res = await app.inject({ method: 'GET', url: '/v1/feed?sort=popular' });

    expect(res.statusCode).toBe(200);
    expect(res.json().items.map((v: { title: string }) => v.title)).toEqual([
      'Top Views Video',
      'Mid Views Video',
      'Low Views Video',
    ]);
  });

  it.each([
    { categoryId: CAT_TECH, title: 'Tech Video' },
    { categoryId: CAT_MUSIC, title: 'Music Video' },
  ])('filters by categoryId $categoryId', async ({ categoryId, title }) => {
    await seedVideo(repositories, {
      id: videoId(31),
      ownerId: USER_1,
      title: 'Tech Video',
      categoryId: CAT_TECH,
    });
    await seedVideo(repositories, {
      id: videoId(32),
      ownerId: USER_2,
      title: 'Music Video',
      categoryId: CAT_MUSIC,
    });

    const res = await app.inject({ method: 'GET', url: `/v1/feed?categoryId=${categoryId}` });

    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(1);
    expect(res.json().items[0]?.title).toBe(title);
  });

  it('pages through the feed with limit and an opaque cursor', async () => {
    for (let i = 1; i <= 5; i++) {
      await seedVideo(repositories, {
        id: videoId(40 + i),
        ownerId: USER_1,
        title: `Pagination Video ${i}`,
      });
    }
    const pageSizes: number[] = [];
    let cursor: string | null = null;
    let url = '/v1/feed?limit=2';

    for (let page = 0; page < 3; page++) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      pageSizes.push(body.items.length);
      cursor = body.nextCursor;
      if (page < 2) expect(cursor).toBeDefined();
      url = `/v1/feed?limit=2&cursor=${encodeURIComponent(String(cursor))}`;
    }

    expect(pageSizes).toEqual([2, 2, 1]);
    expect(cursor).toBeNull();
  });

  it('still serves the feed to a caller who sends a valid bearer token', async () => {
    await seedVideo(repositories, { id: videoId(51), ownerId: USER_2, title: 'Public Auth Test' });

    const res = await app.inject({ method: 'GET', url: '/v1/feed', headers: bearer(userToken) });

    expect(res.statusCode).toBe(200);
    expect(res.json().items.length).toBe(1);
    expect(res.json().items[0]?.title).toBe('Public Auth Test');
  });

  it('caches the first page under taitube:feed:public:{sort}:{categoryId}', async () => {
    await seedVideo(repositories, { id: videoId(81), ownerId: USER_1, title: 'Cache Test Video' });

    const res = await app.inject({ method: 'GET', url: '/v1/feed?sort=recent' });
    expect(res.statusCode).toBe(200);

    const cached = expectOk(await cache.get('taitube:feed:public:recent:all'));
    expect(cached).not.toBeNull();
    expect(JSON.parse(cached ?? '{}').data.items[0]?.title).toBe('Cache Test Video');
  });

  it('rejects a categoryId that is not a UUID with 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/feed?categoryId=not-a-uuid' });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe(ErrorCodes.VALIDATION_FAILED);
  });
});
