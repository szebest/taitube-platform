import {
  InMemoryCacheClient,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { RedisCategoryCacheAdapter } from '@vp/adapters/redis/redis-category-cache.adapter';
import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app';

const CACHES = inProcessAppConfig().caches;

const ADMIN_TOKEN = 'operator-token-for-tests';

describe('Admin Category Management & Public Cached Category API (Ticket 37)', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let cache: InMemoryCacheClient;
  let storage: InMemoryStorageClient;
  let categoryCache: RedisCategoryCacheAdapter;

  const ADMIN_USER_ID = '00000000-0000-7000-8000-000000000003';
  const REGULAR_USER_ID = '00000000-0000-7000-8000-000000000001';

  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    adminToken = mintToken({ sub: ADMIN_USER_ID, role: 'admin', ttl: '1h' });
    userToken = mintToken({ sub: REGULAR_USER_ID, role: 'user', ttl: '1h' });

    repositories = new InMemoryRepositories();
    cache = new InMemoryCacheClient();
    storage = new InMemoryStorageClient();
    categoryCache = new RedisCategoryCacheAdapter({ ...CACHES.categories, cache });

    app = await buildApp({
      config: inProcessAppConfig({ auth: { adminToken: ADMIN_TOKEN } }),
      adapters: {
        repositories,
        cache,
        storage,
        categoryCache: categoryCache,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repositories.clear();
    cache.clear();
    categoryCache.clearL1();
  });

  describe('Public Category API (GET /v1/categories)', () => {
    it('AC 1: Anonymous GET /v1/categories returns 200 with active categories sorted by sort_order ASC, name ASC, valid ETag, and Cache-Control', async () => {
      await repositories.categories.create({
        name: 'Zebra Tech',
        slug: 'zebra-tech',
        sortOrder: 2,
        isActive: true,
      });
      await repositories.categories.create({
        name: 'Apple Gaming',
        slug: 'apple-gaming',
        sortOrder: 2,
        isActive: true,
      });
      await repositories.categories.create({
        name: 'Alpha Music',
        slug: 'alpha-music',
        sortOrder: 1,
        isActive: true,
      });
      await repositories.categories.create({
        name: 'Hidden Category',
        slug: 'hidden-category',
        sortOrder: 0,
        isActive: false,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/categories',
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toBe('public, max-age=300, stale-while-revalidate=60');
      const etag = res.headers.etag;
      expect(etag).toBeDefined();
      expect(etag).toMatch(/^W\/"[a-f0-9]{16}"$/);

      const items = res.json();
      expect(Array.isArray(items)).toBe(true);
      expect(items).toHaveLength(3);
      // Alpha Music (sortOrder 1) comes first, then Apple Gaming (sortOrder 2, name A), then Zebra Tech (sortOrder 2, name Z)
      expect(items[0].slug).toBe('alpha-music');
      expect(items[1].slug).toBe('apple-gaming');
      expect(items[2].slug).toBe('zebra-tech');
    });

    it('AC 2: Repeated GET /v1/categories with matching If-None-Match returns 304 Not Modified', async () => {
      await repositories.categories.create({
        name: 'Science',
        slug: 'science',
        sortOrder: 1,
        isActive: true,
      });

      const res1 = await app.inject({
        method: 'GET',
        url: '/v1/categories',
      });
      expect(res1.statusCode).toBe(200);
      const etag = res1.headers.etag as string;
      expect(etag).toBeDefined();

      const res2 = await app.inject({
        method: 'GET',
        url: '/v1/categories',
        headers: {
          'if-none-match': etag,
        },
      });

      expect(res2.statusCode).toBe(304);
      expect(res2.body).toBe('');
      expect(res2.headers.etag).toBe(etag);
      expect(res2.headers['cache-control']).toBe('public, max-age=300, stale-while-revalidate=60');
    });

    it('supports /categories alias', async () => {
      await repositories.categories.create({
        name: 'Art',
        slug: 'art',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/categories',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
    });
  });

  describe('Admin Category API Authorization & Validation', () => {
    it('returns 401 Unauthorized for unauthenticated requests on admin endpoints', async () => {
      const resPost = await app.inject({
        method: 'POST',
        url: '/v1/admin/categories',
        payload: { name: 'Test', slug: 'test' },
      });
      expect(resPost.statusCode).toBe(401);

      const resPatch = await app.inject({
        method: 'PATCH',
        url: '/v1/admin/categories/00000000-0000-7000-8000-000000000001',
        payload: { name: 'Test' },
      });
      expect(resPatch.statusCode).toBe(401);

      const resDelete = await app.inject({
        method: 'DELETE',
        url: '/v1/admin/categories/00000000-0000-7000-8000-000000000001',
      });
      expect(resDelete.statusCode).toBe(401);
    });

    it('returns 403 Forbidden for non-admin users', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/admin/categories',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: { name: 'Test', slug: 'test' },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe(ErrorCodes.FORBIDDEN);
    });

    it('accepts valid x-admin-token header for admin operations', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/admin/categories',
        headers: {
          'x-admin-token': ADMIN_TOKEN,
        },
        payload: {
          name: 'Admin Via Header',
          slug: 'admin-header',
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().name).toBe('Admin Via Header');
    });

    it('validates request body via Zod: invalid slug returns 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/admin/categories',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Invalid Slug',
          slug: 'INVALID SLUG WITH SPACES AND CAPS!',
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Admin Category Mutations & Cache Invalidation', () => {
    it('POST /v1/admin/categories creates category, invalidates cache, and subsequent GET reflects new data with fresh ETag', async () => {
      // 1. Initial GET populates cache
      const get1 = await app.inject({ method: 'GET', url: '/v1/categories' });
      expect(get1.json()).toHaveLength(0);
      const etag1 = get1.headers.etag;

      // 2. Admin creates a new category
      const createRes = await app.inject({
        method: 'POST',
        url: '/v1/admin/categories',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Technology',
          slug: 'technology',
          description: 'Tech & Gadgets',
          iconUrl: 'https://example.com/tech.png',
          sortOrder: 5,
          isActive: true,
        },
      });

      expect(createRes.statusCode).toBe(201);
      const created = createRes.json();
      expect(created.slug).toBe('technology');

      // 3. Subsequent GET returns fresh data and new ETag
      const get2 = await app.inject({ method: 'GET', url: '/v1/categories' });
      expect(get2.statusCode).toBe(200);
      expect(get2.json()).toHaveLength(1);
      expect(get2.json()[0].name).toBe('Technology');
      const etag2 = get2.headers.etag;
      expect(etag2).not.toBe(etag1);
    });

    it('POST returns 409 CATEGORY_SLUG_CONFLICT on duplicate slug', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/admin/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Gaming', slug: 'gaming' },
      });

      const dupRes = await app.inject({
        method: 'POST',
        url: '/v1/admin/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Gaming Duplicate', slug: 'gaming' },
      });

      expect(dupRes.statusCode).toBe(409);
      expect(dupRes.json().code).toBe(ErrorCodes.CATEGORY_SLUG_CONFLICT);
    });

    it('PATCH /v1/admin/categories/:id updates category and invalidates cache', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/v1/admin/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Old Name', slug: 'old-name' },
      });
      const catId = createRes.json().id;

      // GET to cache it
      const get1 = await app.inject({ method: 'GET', url: '/v1/categories' });
      const etag1 = get1.headers.etag;

      // PATCH category
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/v1/admin/categories/${catId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'New Updated Name', sortOrder: 10 },
      });

      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json().name).toBe('New Updated Name');
      expect(patchRes.json().sortOrder).toBe(10);

      // Subsequent GET has updated name and new ETag
      const get2 = await app.inject({ method: 'GET', url: '/v1/categories' });
      expect(get2.statusCode).toBe(200);
      expect(get2.json()[0].name).toBe('New Updated Name');
      expect(get2.headers.etag).not.toBe(etag1);
    });

    it('DELETE /v1/admin/categories/:id removes category, but fails with 409 if referenced by videos', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/v1/admin/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Film & Animation', slug: 'film-animation' },
      });
      const catId = createRes.json().id;

      // Associate a video
      await repositories.videos.create({
        id: '018f0000-0000-7000-8000-000000000099',
        ownerId: REGULAR_USER_ID,
        title: 'Video in Film Category',
        status: 'READY',
        sourceKey: 'raw/99.mp4',
        categoryId: catId,
      });

      // Try deleting category -> 409 CATEGORY_IN_USE
      const delInUse = await app.inject({
        method: 'DELETE',
        url: `/v1/admin/categories/${catId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(delInUse.statusCode).toBe(409);
      expect(delInUse.json().code).toBe(ErrorCodes.CATEGORY_IN_USE);

      // Soft-delete the video
      await repositories.videos.transition({
        videoId: '018f0000-0000-7000-8000-000000000099',
        from: 'READY',
        to: 'DELETED',
        eventType: 'video.deleted',
        patch: { deletedAt: new Date() },
      });

      // Deletion now succeeds with 204
      const delSuccess = await app.inject({
        method: 'DELETE',
        url: `/v1/admin/categories/${catId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(delSuccess.statusCode).toBe(204);

      // Subsequent GET returns empty array
      const getAfter = await app.inject({ method: 'GET', url: '/v1/categories' });
      expect(getAfter.json()).toHaveLength(0);
    });

    it('returns 404 CATEGORY_NOT_FOUND when updating or deleting non-existent category', async () => {
      const fakeId = '00000000-0000-7000-8000-000000000999';

      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/v1/admin/categories/${fakeId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Ghost' },
      });
      expect(patchRes.statusCode).toBe(404);
      expect(patchRes.json().code).toBe(ErrorCodes.CATEGORY_NOT_FOUND);

      const delRes = await app.inject({
        method: 'DELETE',
        url: `/v1/admin/categories/${fakeId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(delRes.statusCode).toBe(404);
      expect(delRes.json().code).toBe(ErrorCodes.CATEGORY_NOT_FOUND);
    });
  });

  describe('Multi-Instance L1 Cache Invalidation via Pub/Sub', () => {
    it('mutation on Pod A purges L1 in-memory cache on Pod B via Pub/Sub broadcast', async () => {
      // Setup second app instance (Pod B) connected to the same shared cache & repo
      const podBCacheService = new RedisCategoryCacheAdapter({ ...CACHES.categories, cache });
      expectOk(await podBCacheService.start());
      const podBApp = await buildApp({
        config: inProcessAppConfig(),
        adapters: {
          repositories,
          cache,
          storage,
          categoryCache: podBCacheService,
        },
      });

      try {
        // Create a category
        await app.inject({
          method: 'POST',
          url: '/v1/admin/categories',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { name: 'Initial Music', slug: 'initial-music' },
        });

        // Warm up Pod B's L1 cache
        const podBGet1 = await podBApp.inject({ method: 'GET', url: '/v1/categories' });
        expect(podBGet1.statusCode).toBe(200);
        expect(podBGet1.json()[0].name).toBe('Initial Music');
        expect(podBCacheService.getL1Size()).toBe(1);

        // Mutate category on Pod A
        const catId = podBGet1.json()[0].id;
        const patchRes = await app.inject({
          method: 'PATCH',
          url: `/v1/admin/categories/${catId}`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { name: 'Updated Music By Pod A' },
        });
        expect(patchRes.statusCode).toBe(200);

        // Pod B's L1 cache must be purged immediately!
        expect(podBCacheService.getL1Size()).toBe(0);

        // Next GET on Pod B serves the fresh data
        const podBGet2 = await podBApp.inject({ method: 'GET', url: '/v1/categories' });
        expect(podBGet2.statusCode).toBe(200);
        expect(podBGet2.json()[0].name).toBe('Updated Music By Pod A');
      } finally {
        await podBApp.close();
      }
    });
  });
});
