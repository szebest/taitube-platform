import type { Category } from '@vp/domain';
import type { Result } from '@vp/result';

/**
 * A read-through cache for the active taxonomy. A miss or a dead cache falls through to the
 * fetcher, so the only failure a read reports is the fetcher's own.
 */
export interface CategoryCachePort {
  getCategories<E>(fetcher: () => Promise<Result<Category[], E>>): Promise<Result<Category[], E>>;
  invalidate(): Promise<void>;
}
