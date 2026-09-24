import { inProcessAppConfig } from '@vp/env-schema';
import { expectOk } from '@vp/testing/result';
import { buildApp } from '../app';
import {
  CATEGORIES_CACHE_CONTROL,
  type CategoriesApp,
  buildCategoriesApp,
  newCategoryCache,
  patchCategory,
  postCategory,
} from './categories-app';

describe('public category API and its cache', () => {
  let ctx: CategoriesApp;

  beforeAll(async () => {
    ctx = await buildCategoriesApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    ctx.reset();
  });

  const getCategories = (url = '/v1/categories', headers: Record<string, string> = {}) =>
    ctx.app.inject({ method: 'GET', url, headers });

  it('lists active categories anonymously by sort order then name, with ETag and Cache-Control', async () => {
    await ctx.repositories.categories.create({
      name: 'Zebra Tech',
      slug: 'zebra-tech',
      sortOrder: 2,
      isActive: true,
    });
    await ctx.repositories.categories.create({
      name: 'Apple Gaming',
      slug: 'apple-gaming',
      sortOrder: 2,
      isActive: true,
    });
    await ctx.repositories.categories.create({
      name: 'Alpha Music',
      slug: 'alpha-music',
      sortOrder: 1,
      isActive: true,
    });
    await ctx.repositories.categories.create({
      name: 'Hidden Category',
      slug: 'hidden-category',
      sortOrder: 0,
      isActive: false,
    });

    const res = await getCategories();

    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe(CATEGORIES_CACHE_CONTROL);
    expect(res.headers.etag).toMatch(/^W\/"[a-f0-9]{16}"$/);
    expect(res.json().map((c: { slug: string }) => c.slug)).toEqual([
      'alpha-music',
      'apple-gaming',
      'zebra-tech',
    ]);
  });

  it('answers a repeated GET with a matching If-None-Match with 304', async () => {
    await ctx.repositories.categories.create({
      name: 'Science',
      slug: 'science',
      sortOrder: 1,
      isActive: true,
    });

    const res1 = await getCategories();
    expect(res1.statusCode).toBe(200);
    const etag = res1.headers.etag as string;
    expect(etag).toBeDefined();

    const res2 = await getCategories('/v1/categories', { 'if-none-match': etag });

    expect(res2.statusCode).toBe(304);
    expect(res2.body).toBe('');
    expect(res2.headers.etag).toBe(etag);
    expect(res2.headers['cache-control']).toBe(CATEGORIES_CACHE_CONTROL);
  });

  it('supports /categories alias', async () => {
    await ctx.repositories.categories.create({ name: 'Art', slug: 'art' });

    const res = await getCategories('/categories');

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it('serves a created category with a fresh ETag right after the admin POST', async () => {
    const get1 = await getCategories();
    expect(get1.json()).toHaveLength(0);

    const createRes = await postCategory(ctx.app, ctx.adminJwt, {
      name: 'Technology',
      slug: 'technology',
      description: 'Tech & Gadgets',
      iconUrl: 'https://example.com/tech.png',
      sortOrder: 5,
      isActive: true,
    });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.json().slug).toBe('technology');

    const get2 = await getCategories();
    expect(get2.statusCode).toBe(200);
    expect(get2.json()).toHaveLength(1);
    expect(get2.json()[0].name).toBe('Technology');
    expect(get2.headers.etag).not.toBe(get1.headers.etag);
  });

  it('serves an updated category with a fresh ETag right after the admin PATCH', async () => {
    const catId = (
      await postCategory(ctx.app, ctx.adminJwt, { name: 'Old Name', slug: 'old-name' })
    ).json().id;
    const get1 = await getCategories();

    const patchRes = await patchCategory(ctx.app, ctx.adminJwt, catId, {
      name: 'New Updated Name',
      sortOrder: 10,
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json()).toMatchObject({ name: 'New Updated Name', sortOrder: 10 });

    const get2 = await getCategories();
    expect(get2.statusCode).toBe(200);
    expect(get2.json()[0].name).toBe('New Updated Name');
    expect(get2.headers.etag).not.toBe(get1.headers.etag);
  });

  it('purges the in-process cache of a second instance when the first one mutates', async () => {
    const podBCache = newCategoryCache(ctx.cache);
    expectOk(await podBCache.start());
    const podB = await buildApp({
      config: inProcessAppConfig(),
      adapters: {
        repositories: ctx.repositories,
        cache: ctx.cache,
        storage: ctx.storage,
        categoryCache: podBCache,
      },
    });

    try {
      await postCategory(ctx.app, ctx.adminJwt, { name: 'Initial Music', slug: 'initial-music' });

      const podBGet1 = await podB.inject({ method: 'GET', url: '/v1/categories' });
      expect(podBGet1.statusCode).toBe(200);
      expect(podBGet1.json()[0].name).toBe('Initial Music');
      expect(podBCache.getL1Size()).toBe(1);

      const patchRes = await patchCategory(ctx.app, ctx.adminJwt, podBGet1.json()[0].id, {
        name: 'Updated Music By Pod A',
      });
      expect(patchRes.statusCode).toBe(200);
      expect(podBCache.getL1Size()).toBe(0);

      const podBGet2 = await podB.inject({ method: 'GET', url: '/v1/categories' });
      expect(podBGet2.statusCode).toBe(200);
      expect(podBGet2.json()[0].name).toBe('Updated Music By Pod A');
    } finally {
      await podB.close();
    }
  });
});
