import type { Category } from '@vp/domain';
import { databaseUnavailable } from '@vp/errors';
import { err, ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { InMemoryCategoryCache } from '../in-memory-category-cache';

const MUSIC = { id: 'music', slug: 'music', name: 'Music' } as Category;

describe('InMemoryCategoryCache', () => {
  it('reads through once and serves the cached list after that', async () => {
    const cache = new InMemoryCategoryCache();
    const fetcher = vi.fn(async () => ok([MUSIC]));

    expectOk(await cache.getCategories(fetcher));
    expect(expectOk(await cache.getCategories(fetcher))).toEqual([MUSIC]);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    { scenario: 'an invalidation', reset: (c: InMemoryCategoryCache) => c.invalidate() },
    { scenario: 'a clear', reset: (c: InMemoryCategoryCache) => c.clear() },
  ])('reads through again after $scenario', async ({ reset }) => {
    const cache = new InMemoryCategoryCache();
    const fetcher = vi.fn(async () => ok([MUSIC]));
    expectOk(await cache.getCategories(fetcher));

    await reset(cache);
    expectOk(await cache.getCategories(fetcher));

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('caches nothing when the fetcher fails, and passes its failure on', async () => {
    const cache = new InMemoryCategoryCache();
    const failure = databaseUnavailable('categories.findAll');

    expect(expectErr(await cache.getCategories(async () => err(failure)))).toBe(failure);
    expect(expectOk(await cache.getCategories(async () => ok([MUSIC])))).toEqual([MUSIC]);
  });
});
