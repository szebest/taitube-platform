import { CategoryCacheService, InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters';
import { ErrorCodes } from '@vp/errors';
import type { AuthUser } from '../../plugins/auth';
import { CategoryService } from '../category-service';

const ADMIN: AuthUser = { id: '00000000-0000-7000-8000-000000000003', role: 'admin' };

describe('CategoryService', () => {
  let repositories: InMemoryRepositories;
  let cacheClient: InMemoryCacheClient;
  let cacheService: CategoryCacheService;
  let categoryService: CategoryService;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    repositories.clear();
    cacheClient = new InMemoryCacheClient();
    cacheService = new CategoryCacheService({
      cache: cacheClient,
      l1TtlMs: 5000,
      l2TtlSeconds: 300,
    });
    categoryService = new CategoryService({
      categories: repositories.categories,
      categoryCacheService: cacheService,
    });
  });

  it('lists active categories with cache headers built by HttpCacheService', async () => {
    await repositories.categories.create({
      slug: 'tech',
      name: 'Technology',
      sortOrder: 10,
    });

    const result = await categoryService.listActive();
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]?.slug).toBe('tech');
    expect(result.headers).toEqual({
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      ETag: expect.stringMatching(/^W\/"[a-f0-9]{16}"$/),
    });
    expect(result.notModified).toBe(false);
  });

  it('evaluates If-None-Match correctly for 304 not modified', async () => {
    await repositories.categories.create({
      slug: 'tech',
      name: 'Technology',
      sortOrder: 10,
    });

    const first = await categoryService.listActive();
    const second = await categoryService.listActive(first.headers['ETag']);
    expect(second.notModified).toBe(true);
  });

  it('creates category and invalidates multi-tier cache', async () => {
    const created = await categoryService.create(ADMIN, {
      slug: 'gaming',
      name: 'Gaming',
      sortOrder: 5,
    });

    expect(created.slug).toBe('gaming');
    const list = await categoryService.listActive();
    expect(list.categories.some((c) => c.slug === 'gaming')).toBe(true);
  });

  it('updates category and invalidates cache', async () => {
    const created = await repositories.categories.create({
      slug: 'music',
      name: 'Music',
      sortOrder: 20,
    });

    const updated = await categoryService.update(ADMIN, created.id, {
      name: 'All Music',
    });

    expect(updated.name).toBe('All Music');
  });

  it('deletes category and invalidates cache', async () => {
    const created = await repositories.categories.create({
      slug: 'news',
      name: 'News',
      sortOrder: 30,
    });

    await categoryService.delete(ADMIN, created.id);
    const list = await categoryService.listActive();
    expect(list.categories.some((c) => c.slug === 'news')).toBe(false);
  });

  it.each([
    ['an anonymous caller', null, ErrorCodes.UNAUTHORIZED],
    ['a signed-in non-admin', { id: 'user-1', role: 'user' }, ErrorCodes.FORBIDDEN],
  ])('refuses taxonomy writes from %s', async (_label, caller, code) => {
    const input = { slug: 'blocked', name: 'Blocked' };

    await expect(categoryService.create(caller, input)).rejects.toMatchObject({ code });
    await expect(categoryService.update(caller, 'any', input)).rejects.toMatchObject({ code });
    await expect(categoryService.delete(caller, 'any')).rejects.toMatchObject({ code });
  });
});
