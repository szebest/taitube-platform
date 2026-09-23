import type { CategoryCachePort } from '@vp/core/ports';
import type { Category } from '@vp/domain';
import { type Result, isOk, ok } from '@vp/result';

export class InMemoryCategoryCache implements CategoryCachePort {
  private cached: Category[] | null = null;

  async getCategories<E>(
    fetcher: () => Promise<Result<Category[], E>>
  ): Promise<Result<Category[], E>> {
    if (this.cached) return ok(this.cached);

    const fetched = await fetcher();
    if (isOk(fetched)) this.cached = fetched.value;
    return fetched;
  }

  async invalidate(): Promise<void> {
    this.cached = null;
  }

  clear(): void {
    this.cached = null;
  }
}
