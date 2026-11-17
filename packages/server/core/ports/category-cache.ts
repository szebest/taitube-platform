import type { Result } from '@kit/result';
import type { Category } from '@vp/domain';
import type { CacheUnavailable } from '@vp/errors';

/**
 * A read-through cache for the active taxonomy. A miss or a dead cache falls through to the
 * fetcher, so the only failure a read reports is the fetcher's own.
 */
export interface CategoryCachePort {
  getCategories<E>(fetcher: () => Promise<Result<Category[], E>>): Promise<Result<Category[], E>>;
  invalidate(): Promise<Result<void, CacheUnavailable>>;
}
