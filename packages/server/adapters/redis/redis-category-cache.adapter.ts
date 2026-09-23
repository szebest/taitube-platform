import type { CacheClient, CategoryCachePort } from '@vp/core/ports';
import type { Category } from '@vp/domain';
import { type Result, isOk, ok, tryCatch, unwrapOr } from '@vp/result';

export const CATEGORIES_CACHE_KEY = 'taitube:cache:categories:v1';
export const CATEGORIES_INVALIDATION_CHANNEL = 'taitube:events:cache:categories:invalidated';

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
  l1TtlMs?: number; // default: 60_000 (60s)
  l2TtlSeconds?: number; // default: 300 (5m)
  maxL1Entries?: number; // default: 100
}

export class RedisCategoryCacheAdapter implements CategoryCachePort {
  private readonly cache?: CacheClient | null;
  private readonly l1TtlMs: number;
  private readonly l2TtlSeconds: number;
  private readonly maxL1Entries: number;
  private readonly l1Cache = new Map<string, L1CacheEntry>();
  private readonly onInvalidateMessage: (channel: string, message: string) => void;

  constructor(config: RedisCategoryCacheAdapterConfig = {}) {
    this.cache = config.cache;
    this.l1TtlMs = config.l1TtlMs ?? 60_000;
    this.l2TtlSeconds = config.l2TtlSeconds ?? 300;
    this.maxL1Entries = config.maxL1Entries ?? 100;

    this.onInvalidateMessage = (_channel: string, _message: string) => {
      this.clearL1();
    };
  }

  /**
   * A pod that cannot subscribe still serves reads; it only stops hearing peers, so its L1
   * entries expire on their own TTL instead of being cleared early.
   */
  async start(): Promise<Result<void, never>> {
    await this.cache?.subscribe(CATEGORIES_INVALIDATION_CHANNEL, this.onInvalidateMessage);
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
    // 1. Check L1 In-Memory LRU Cache
    const l1 = this.getL1(CATEGORIES_CACHE_KEY);
    if (l1) {
      return ok(l1.value);
    }

    // 2. Check L2 Distributed Redis Cache
    if (this.cache) {
      const cachedJson = unwrapOr(await this.cache.get(CATEGORIES_CACHE_KEY), null);
      const categories = cachedJson ? parseCategories(cachedJson) : null;
      if (categories) {
        this.setL1(CATEGORIES_CACHE_KEY, categories, this.l1TtlMs);
        return ok(categories);
      }
    }

    // 3. Cache Miss: Fetch from source
    const fetched = await fetcher();
    if (!isOk(fetched)) return fetched;

    const categories = [...fetched.value].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.name.localeCompare(b.name);
    });

    // 4. Populate L2 Distributed Redis Cache
    await this.cache?.set(CATEGORIES_CACHE_KEY, JSON.stringify({ categories }), this.l2TtlSeconds);

    // 5. Populate L1 In-Memory LRU Cache
    this.setL1(CATEGORIES_CACHE_KEY, categories, this.l1TtlMs);

    return ok(categories);
  }

  async invalidate(): Promise<void> {
    // 1. Invalidate local L1 cache
    this.clearL1();

    // 2. Invalidate L2 distributed Redis cache, then broadcast to the other replicas
    await this.cache?.del(CATEGORIES_CACHE_KEY);
    await this.cache?.publish(
      CATEGORIES_INVALIDATION_CHANNEL,
      JSON.stringify({ invalidatedAt: Date.now() })
    );
  }

  async close(): Promise<void> {
    await this.cache?.unsubscribe(CATEGORIES_INVALIDATION_CHANNEL, this.onInvalidateMessage);
    this.clearL1();
  }
}
