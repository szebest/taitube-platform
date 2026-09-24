import type { CacheClient, CategoryCachePort } from '@vp/core/ports';
import type { Category } from '@vp/domain';
import type { CacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { type Result, ignore, isErr, isOk, map, ok, tryCatch, unwrapOr } from '@vp/result';

interface CachedCategories {
  categories: Array<Category & { createdAt: string; updatedAt: string }>;
}

function parseCategories(json: string): Category[] | null {
  const parsed = tryCatch(
    () => JSON.parse(json) as CachedCategories,
    () => null
  );
  if (!isOk(parsed)) return null;

  return parsed.value.categories.map((c) => ({
    ...c,
    createdAt: new Date(c.createdAt),
    updatedAt: new Date(c.updatedAt),
  }));
}

interface L1CacheEntry {
  value: Category[];
  expiresAt: number;
}

export interface RedisCategoryCacheAdapterConfig {
  cache?: CacheClient | null;
  l1TtlMs: number;
  l2TtlSeconds: number;
  maxL1Entries: number;
}

export class RedisCategoryCacheAdapter implements CategoryCachePort {
  private readonly cache?: CacheClient | null;
  private readonly l1TtlMs: number;
  private readonly l2TtlSeconds: number;
  private readonly maxL1Entries: number;
  private readonly l1Cache = new Map<string, L1CacheEntry>();
  private readonly onInvalidateMessage: (channel: string, message: string) => void;

  constructor(config: RedisCategoryCacheAdapterConfig) {
    this.cache = config.cache;
    this.l1TtlMs = config.l1TtlMs;
    this.l2TtlSeconds = config.l2TtlSeconds;
    this.maxL1Entries = config.maxL1Entries;

    this.onInvalidateMessage = (_channel: string, _message: string) => {
      this.clearL1();
    };
  }

  /**
   * A pod that cannot subscribe still serves reads; it only stops hearing peers, so its L1
   * entries expire on their own TTL instead of being cleared early.
   */
  async start(): Promise<Result<void, never>> {
    if (this.cache) {
      ignore(
        await this.cache.subscribe(CacheKeys.categoriesInvalidated, this.onInvalidateMessage),
        'a pod that cannot subscribe falls back to its L1 TTL'
      );
    }
    return ok();
  }

  private setL1(key: string, value: Category[], ttlMs: number): void {
    if (this.l1Cache.size >= this.maxL1Entries && !this.l1Cache.has(key)) {
      const oldestKey = this.l1Cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.l1Cache.delete(oldestKey);
      }
    }

    this.l1Cache.delete(key);
    this.l1Cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  private getL1(key: string): L1CacheEntry | null {
    const entry = this.l1Cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.l1Cache.delete(key);
      return null;
    }

    // Refresh LRU order
    this.l1Cache.delete(key);
    this.l1Cache.set(key, entry);
    return entry;
  }

  clearL1(): void {
    this.l1Cache.clear();
  }

  getL1Size(): number {
    return this.l1Cache.size;
  }

  /**
   * A cache miss or a dead Redis is not a failure of this call: it falls through to the source and
   * the cache failure is dropped, which is the deliberate narrowing ADR-24 allows. Only the
   * source's own failure reaches the caller, and it is the one in the signature.
   */
  async getCategories<E>(
    fetcher: () => Promise<Result<Category[], E>>
  ): Promise<Result<Category[], E>> {
    const l1 = this.getL1(CacheKeys.categories);
    if (l1) {
      return ok(l1.value);
    }

    if (this.cache) {
      const cachedJson = unwrapOr(await this.cache.get(CacheKeys.categories), null);
      const categories = cachedJson ? parseCategories(cachedJson) : null;
      if (categories) {
        this.setL1(CacheKeys.categories, categories, this.l1TtlMs);
        return ok(categories);
      }
    }

    const fetched = await fetcher();
    if (!isOk(fetched)) return fetched;

    const categories = [...fetched.value].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.name.localeCompare(b.name);
    });

    if (this.cache) {
      ignore(
        await this.cache.set(
          CacheKeys.categories,
          JSON.stringify({ categories }),
          this.l2TtlSeconds
        ),
        'the categories were read; a missed L2 write costs the next pod one query'
      );
    }
    this.setL1(CacheKeys.categories, categories, this.l1TtlMs);

    return ok(categories);
  }

  /** The broadcast still goes out when the L2 delete fails, since peers' L1 is the staler copy. */
  async invalidate(): Promise<Result<void, CacheUnavailable>> {
    this.clearL1();
    if (!this.cache) return ok();

    const deleted = await this.cache.del(CacheKeys.categories);
    const published = await this.cache.publish(
      CacheKeys.categoriesInvalidated,
      JSON.stringify({ invalidatedAt: Date.now() })
    );
    return isErr(deleted) ? deleted : map(published, () => undefined);
  }

  async close(): Promise<void> {
    if (this.cache) {
      ignore(
        await this.cache.unsubscribe(CacheKeys.categoriesInvalidated, this.onInvalidateMessage),
        'the connection closes next, which drops the subscription anyway'
      );
    }
    this.clearL1();
  }
}
