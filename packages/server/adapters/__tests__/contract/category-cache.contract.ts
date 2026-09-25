import type { CategoryCachePort } from '@vp/core/ports';
import type { Category } from '@vp/domain';
import { databaseUnavailable } from '@vp/errors';
import { err, ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';

export interface CategoryCacheSubject {
  readonly cache: CategoryCachePort;
  close(): Promise<void>;
}

export type MakeCategoryCacheSubject = () => Promise<CategoryCacheSubject>;

function category(id: string, sortOrder: number): Category {
  return {
    id,
    slug: id,
    name: id,
    description: null,
    iconUrl: null,
    sortOrder,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };
}

const TAXONOMY = [category('music', 2), category('art', 1), category('gaming', 1)];

export function describeCategoryCacheContract(makeSubject: MakeCategoryCacheSubject): void {
  describe('CategoryCache contract', () => {
    let subject: CategoryCacheSubject;
    let cache: CategoryCachePort;
    let fetches: number;

    const fetcher = async () => {
      fetches += 1;
      return ok(TAXONOMY);
    };

    beforeEach(async () => {
      subject = await makeSubject();
      cache = subject.cache;
      expectOk(await cache.invalidate());
      fetches = 0;
    });

    afterEach(async () => {
      await subject.close();
    });

    it('reads through once and answers the same list, dates included, after that', async () => {
      expect(expectOk(await cache.getCategories(fetcher))).toStrictEqual(TAXONOMY);
      expect(expectOk(await cache.getCategories(fetcher))).toStrictEqual(TAXONOMY);

      expect(fetches).toBe(1);
    });

    it('keeps the order the fetcher answered in, because ordering belongs to the repository', async () => {
      const ids = expectOk(await cache.getCategories(fetcher)).map(({ id }) => id);

      expect(ids).toEqual(['music', 'art', 'gaming']);
    });

    it('reads through again after an invalidation', async () => {
      expectOk(await cache.getCategories(fetcher));

      expectOk(await cache.invalidate());
      expectOk(await cache.getCategories(fetcher));

      expect(fetches).toBe(2);
    });

    it("passes the fetcher's failure on and caches nothing", async () => {
      const failure = databaseUnavailable('categories.findAll');

      expect(expectErr(await cache.getCategories(async () => err(failure)))).toBe(failure);
      expectOk(await cache.getCategories(fetcher));

      expect(fetches).toBe(1);
    });
  });
}
