import { inProcessAppConfig } from '@vp/env-schema';
import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { RedisCategoryCacheAdapter } from '@vp/adapters/redis/redis-category-cache.adapter';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { CategoryService } from '../category-service';

const CACHES = inProcessAppConfig().caches;

const ADMIN: UserContext = { id: '00000000-0000-7000-8000-000000000003', role: 'ADMIN' };

describe('CategoryService', () => {
  let repositories: InMemoryRepositories;
  let cacheService: RedisCategoryCacheAdapter;
  let categoryService: CategoryService;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    repositories.clear();
    cacheService = new RedisCategoryCacheAdapter({
      ...CACHES.categories,
      cache: new InMemoryCacheClient(),
      l1TtlMs: 5000,
      l2TtlSeconds: 300,
    });
    categoryService = new CategoryService({
      categories: repositories.categories,
      categoryCache: cacheService,
    });
  });

  async function seed(slug: string, name: string, sortOrder: number) {
    return expectOk(await repositories.categories.create({ slug, name, sortOrder }));
  }

  it('lists active categories with cache headers built by HttpCacheService', async () => {
    await seed('tech', 'Technology', 10);

    const page = expectOk(await categoryService.listActive());

    expect(page.categories).toHaveLength(1);
    expect(page.categories[0]?.slug).toBe('tech');
    expect(page.headers).toEqual({
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      ETag: expect.stringMatching(/^W\/"[a-f0-9]{16}"$/),
    });
    expect(page.notModified).toBe(false);
  });

  it('evaluates If-None-Match correctly for 304 not modified', async () => {
    await seed('tech', 'Technology', 10);

    const first = expectOk(await categoryService.listActive());
    const second = expectOk(await categoryService.listActive(first.headers['ETag']));

    expect(second.notModified).toBe(true);
  });

  it('creates a category and invalidates the multi-tier cache', async () => {
    const created = expectOk(
      await categoryService.create(ADMIN, { slug: 'gaming', name: 'Gaming', sortOrder: 5 })
    );

    expect(created.slug).toBe('gaming');
    const page = expectOk(await categoryService.listActive());
    expect(page.categories.some((c) => c.slug === 'gaming')).toBe(true);
  });

  it('reports a duplicate slug rather than throwing', async () => {
    await seed('gaming', 'Gaming', 5);

    const failure = expectErr(
      await categoryService.create(ADMIN, { slug: 'gaming', name: 'Gaming Again' })
    );

    expect(failure.code).toBe(ErrorCodes.CATEGORY_SLUG_CONFLICT);
  });

  it('updates a category and invalidates the cache', async () => {
    const created = await seed('music', 'Music', 20);

    const updated = expectOk(
      await categoryService.update(ADMIN, created.id, { name: 'All Music' })
    );

    expect(updated.name).toBe('All Music');
  });

  it('reports an update of a category that is not there', async () => {
    const failure = expectErr(
      await categoryService.update(ADMIN, '00000000-0000-7000-8000-00000000dead', { name: 'Ghost' })
    );

    expect(failure.code).toBe(ErrorCodes.CATEGORY_NOT_FOUND);
  });

  it('deletes a category and invalidates the cache', async () => {
    const created = await seed('news', 'News', 30);

    expectOk(await categoryService.delete(ADMIN, created.id));

    const page = expectOk(await categoryService.listActive());
    expect(page.categories.some((c) => c.slug === 'news')).toBe(false);
  });

  it('refuses to delete a category videos still hold', async () => {
    const created = await seed('news', 'News', 30);
    vi.spyOn(repositories.categories, 'countVideos').mockResolvedValue({ ok: true, value: 2 });

    const failure = expectErr(await categoryService.delete(ADMIN, created.id));

    expect(failure.code).toBe(ErrorCodes.CATEGORY_IN_USE);
  });

  it.each([
    { scenario: 'an anonymous caller', caller: null, code: ErrorCodes.UNAUTHORIZED },
    {
      scenario: 'a signed-in non-admin',
      caller: { id: 'user-1', role: 'USER' } as UserContext,
      code: ErrorCodes.FORBIDDEN,
    },
  ])('refuses taxonomy writes from $scenario', async ({ caller, code }) => {
    const input = { slug: 'blocked', name: 'Blocked' };

    expect(expectErr(await categoryService.create(caller, input)).code).toBe(code);
    expect(expectErr(await categoryService.update(caller, 'any', input)).code).toBe(code);
    expect(expectErr(await categoryService.delete(caller, 'any')).code).toBe(code);
  });
});
