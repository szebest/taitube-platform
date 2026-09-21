import * as http from 'node:http';
import { InMemoryCacheClient, InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters';
import { mintToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('Public Video Feed API & Anonymous Access (Ticket 36)', () => {
  let app: FastifyInstance;
  let baseUrl: string;
  let repositories: InMemoryRepositories;
  let cache: InMemoryCacheClient;
  let storage: InMemoryStorageClient;

  const USER_1 = '00000000-0000-7000-8000-000000000001';
  const USER_2 = '00000000-0000-7000-8000-000000000002';
  const CAT_TECH = '10000000-0000-7000-8000-000000000001';
  const CAT_MUSIC = '20000000-0000-7000-8000-000000000002';

  let userToken: string;

  beforeAll(async () => {
    userToken = mintToken({ sub: USER_1, role: 'user', ttl: '1h' });
    repositories = new InMemoryRepositories();
    cache = new InMemoryCacheClient();
    storage = new InMemoryStorageClient();

    app = await buildApp({
      adapters: {
        repositories,
        cache,
        storage,
      },
      cdnBaseUrl: 'http://localhost:9000/public',
    });
    baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repositories.clear();
    cache.clear();
  });

  it('AC 1: Anonymous GET /v1/feed returns 200 with public READY videos, valid ETag, and Cache-Control', async () => {
    // Seed 2 public ready videos and 1 private ready video
    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000001',
      ownerId: USER_1,
      title: 'Public Video 1',
      visibility: 'public',
      status: 'READY',
      sourceKey: 'raw/1.mp4',
    });
    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000002',
      ownerId: USER_2,
      title: 'Public Video 2',
      visibility: 'public',
      status: 'READY',
      sourceKey: 'raw/2.mp4',
    });
    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000003',
      ownerId: USER_1,
      title: 'Private Video',
      visibility: 'private',
      status: 'READY',
      sourceKey: 'raw/3.mp4',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/feed',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=30, stale-while-revalidate=60');
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

  it('AC 1: Repeated GET /v1/feed with If-None-Match returns 304 Not Modified', async () => {
    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000011',
      ownerId: USER_1,
      title: 'Public Video 11',
      visibility: 'public',
      status: 'READY',
      sourceKey: 'raw/11.mp4',
    });

    const res1 = await app.inject({
      method: 'GET',
      url: '/v1/feed',
    });
    expect(res1.statusCode).toBe(200);
    const etag = res1.headers['etag'] as string;
    expect(etag).toBeDefined();

    // Repeat with matching ETag
    const res2 = await app.inject({
      method: 'GET',
      url: '/v1/feed',
      headers: {
        'if-none-match': etag,
      },
    });
    expect(res2.statusCode).toBe(304);
    expect(res2.body).toBe('');
    expect(res2.headers['etag']).toBe(etag);
    expect(res2.headers['cache-control']).toBe('public, max-age=30, stale-while-revalidate=60');
  });

  it('AC 1: GET /v1/feed?sort=popular returns videos ordered by views descending', async () => {
    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000021',
      ownerId: USER_1,
      title: 'Low Views Video',
      visibility: 'public',
      status: 'READY',
      viewsCount: 5,
      sourceKey: 'raw/21.mp4',
    });
    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000022',
      ownerId: USER_2,
      title: 'Top Views Video',
      visibility: 'public',
      status: 'READY',
      viewsCount: 5000,
      sourceKey: 'raw/22.mp4',
    });
    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000023',
      ownerId: USER_1,
      title: 'Mid Views Video',
      visibility: 'public',
      status: 'READY',
      viewsCount: 200,
      sourceKey: 'raw/23.mp4',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/feed?sort=popular',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items[0]?.title).toBe('Top Views Video');
    expect(body.items[1]?.title).toBe('Mid Views Video');
    expect(body.items[2]?.title).toBe('Low Views Video');
  });

  it('AC 1: GET /v1/feed supports categoryId UUID filter', async () => {
    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000031',
      ownerId: USER_1,
      title: 'Tech Video',
      visibility: 'public',
      status: 'READY',
      categoryId: CAT_TECH,
      sourceKey: 'raw/31.mp4',
    });
    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000032',
      ownerId: USER_2,
      title: 'Music Video',
      visibility: 'public',
      status: 'READY',
      categoryId: CAT_MUSIC,
      sourceKey: 'raw/32.mp4',
    });

    const resTech = await app.inject({
      method: 'GET',
      url: `/v1/feed?categoryId=${CAT_TECH}`,
    });
    expect(resTech.statusCode).toBe(200);
    const bodyTech = resTech.json();
    expect(bodyTech.total).toBe(1);
    expect(bodyTech.items[0]?.title).toBe('Tech Video');

    const resMusic = await app.inject({
      method: 'GET',
      url: `/v1/feed?categoryId=${CAT_MUSIC}`,
    });
    expect(resMusic.statusCode).toBe(200);
    const bodyMusic = resMusic.json();
    expect(bodyMusic.total).toBe(1);
    expect(bodyMusic.items[0]?.title).toBe('Music Video');
  });

  it('AC 2: Keyset pagination with limit and cursor across pages', async () => {
    for (let i = 1; i <= 5; i++) {
      await repositories.videos.create({
        id: `018f0000-0000-7000-8000-00000000004${i}`,
        ownerId: USER_1,
        title: `Pagination Video ${i}`,
        visibility: 'public',
        status: 'READY',
        sourceKey: `raw/4${i}.mp4`,
      });
    }

    const page1 = await app.inject({
      method: 'GET',
      url: '/v1/feed?limit=2',
    });
    expect(page1.statusCode).toBe(200);
    const body1 = page1.json();
    expect(body1.items).toHaveLength(2);
    expect(body1.nextCursor).toBeDefined();

    const page2 = await app.inject({
      method: 'GET',
      url: `/v1/feed?limit=2&cursor=${encodeURIComponent(body1.nextCursor)}`,
    });
    expect(page2.statusCode).toBe(200);
    const body2 = page2.json();
    expect(body2.items).toHaveLength(2);
    expect(body2.nextCursor).toBeDefined();

    const page3 = await app.inject({
      method: 'GET',
      url: `/v1/feed?limit=2&cursor=${encodeURIComponent(body2.nextCursor)}`,
    });
    expect(page3.statusCode).toBe(200);
    const body3 = page3.json();
    expect(body3.items).toHaveLength(1);
    expect(body3.nextCursor).toBeNull();
  });

  it('AC 3: GET /v1/feed with optional valid Authorization: Bearer <token> still works', async () => {
    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000051',
      ownerId: USER_2,
      title: 'Public Auth Test',
      visibility: 'public',
      status: 'READY',
      sourceKey: 'raw/51.mp4',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/feed',
      headers: {
        authorization: `Bearer ${userToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.length).toBe(1);
    expect(body.items[0]?.title).toBe('Public Auth Test');
  });

  it('AC 4: Anonymous GET /v1/videos/:id returns 200 for public & unlisted; returns 401 for private', async () => {
    const pubId = '018f0000-0000-7000-8000-000000000061';
    const unlistedId = '018f0000-0000-7000-8000-000000000062';
    const privId = '018f0000-0000-7000-8000-000000000063';

    await repositories.videos.create({
      id: pubId,
      ownerId: USER_1,
      title: 'Public Detail',
      visibility: 'public',
      status: 'READY',
      sourceKey: 'raw/61.mp4',
    });
    await repositories.videos.create({
      id: unlistedId,
      ownerId: USER_1,
      title: 'Unlisted Detail',
      visibility: 'unlisted',
      status: 'READY',
      sourceKey: 'raw/62.mp4',
    });
    await repositories.videos.create({
      id: privId,
      ownerId: USER_1,
      title: 'Private Detail',
      visibility: 'private',
      status: 'READY',
      sourceKey: 'raw/63.mp4',
    });

    // 1. Anonymous on public -> 200
    const resPub = await app.inject({
      method: 'GET',
      url: `/v1/videos/${pubId}`,
    });
    expect(resPub.statusCode).toBe(200);
    expect(resPub.json().title).toBe('Public Detail');

    // 2. Anonymous on unlisted -> 200
    const resUnlisted = await app.inject({
      method: 'GET',
      url: `/v1/videos/${unlistedId}`,
    });
    expect(resUnlisted.statusCode).toBe(200);
    expect(resUnlisted.json().title).toBe('Unlisted Detail');

    // 3. Anonymous on private -> 401 UNAUTHORIZED
    const resPriv = await app.inject({
      method: 'GET',
      url: `/v1/videos/${privId}`,
    });
    expect(resPriv.statusCode).toBe(401);
    expect(resPriv.json().code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it('AC 5: Anonymous GET /v1/videos/:id/events on public returns 200; on private returns 401', async () => {
    const pubId = '018f0000-0000-7000-8000-000000000071';
    const privId = '018f0000-0000-7000-8000-000000000072';

    await repositories.videos.create({
      id: pubId,
      ownerId: USER_1,
      title: 'Public SSE',
      visibility: 'public',
      status: 'READY',
      sourceKey: 'raw/71.mp4',
    });
    await repositories.videos.create({
      id: privId,
      ownerId: USER_1,
      title: 'Private SSE',
      visibility: 'private',
      status: 'READY',
      sourceKey: 'raw/72.mp4',
    });

    // 1. Anonymous on public -> 200 text/event-stream
    await new Promise<void>((resolve, reject) => {
      const req = http.get(`${baseUrl}/v1/videos/${pubId}/events`, (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('text/event-stream');
        req.destroy();
        resolve();
      });
      req.on('error', (err) => {
        if ((err as { code?: string }).code !== 'ECONNRESET') reject(err);
      });
    });

    // 2. Anonymous on private -> 401 UNAUTHORIZED
    const resPriv = await app.inject({
      method: 'GET',
      url: `/v1/videos/${privId}/events`,
    });
    expect(resPriv.statusCode).toBe(401);
    expect(resPriv.json().code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it('Redis caching: caches first page in Redis under taitube:feed:public:{sort}:{categoryId}', async () => {
    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000081',
      ownerId: USER_1,
      title: 'Cache Test Video',
      visibility: 'public',
      status: 'READY',
      sourceKey: 'raw/81.mp4',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/feed?sort=recent',
    });
    expect(res.statusCode).toBe(200);

    const cached = await cache.get('taitube:feed:public:recent:all');
    expect(cached).not.toBeNull();
    const parsed = JSON.parse(cached ?? '{}');
    expect(parsed.data.items[0]?.title).toBe('Cache Test Video');
  });

  it('Validation error: invalid categoryId UUID returns 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/feed?categoryId=not-a-uuid',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe(ErrorCodes.VALIDATION_FAILED);
  });
});
