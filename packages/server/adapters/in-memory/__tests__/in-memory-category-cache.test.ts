import { ok } from '@kit/result';
import { expectOk } from '@kit/testing/result';
import type { Category } from '@vp/domain';
import { describeCategoryCacheContract } from '../../__tests__/contract/category-cache.contract';
import { inMemoryCategoryCacheSubject } from '../../__tests__/contract/in-memory-port-subjects';
import { InMemoryCategoryCache } from '../in-memory-category-cache';

describeCategoryCacheContract(inMemoryCategoryCacheSubject);

describe('InMemoryCategoryCache', () => {
  it('reads through again after a clear', async () => {
    const cache = new InMemoryCategoryCache();
    const fetcher = vi.fn(async () => ok([{ id: 'music' } as Category]));
    expectOk(await cache.getCategories(fetcher));

    cache.clear();
    expectOk(await cache.getCategories(fetcher));

    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
