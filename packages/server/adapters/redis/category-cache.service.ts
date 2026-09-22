import type { Category } from '@vp/domain';
import type { CacheClient } from '@vp/core/ports';

export const CATEGORIES_CACHE_KEY = 'taitube:cache:categories:v1';
export const CATEGORIES_INVALIDATION_CHANNEL = 'taitube:events:cache:categories:invalidated';

interface L1CacheEntry {
  value: Category[];
  expiresAt: number;
}

export interface CategoryCacheServiceConfig {
  cache?: CacheClient | null;
  l1TtlMs?: number; // default: 60_000 (60s)
  l2TtlSeconds?: number; // default: 300 (5m)
  maxL1Entries?: number; // default: 100
}

export class CategoryCacheService {
  private readonly cache?: CacheClient | null;
  private readonly l1TtlMs: number;
  private readonly l2TtlSeconds: number;
  private readonly maxL1Entries: number;
  private readonly l1Cache = new Map<string, L1CacheEntry>();
  private readonly onInvalidateMessage: (channel: string, message: string) => void;

  constructor(config: CategoryCacheServiceConfig = {}) {
    this.cache = config.cache;
    this.l1TtlMs = config.l1TtlMs ?? 60_000;
    this.l2TtlSeconds = config.l2TtlSeconds ?? 300;
    this.maxL1Entries = config.maxL1Entries ?? 100;

    this.onInvalidateMessage = (_channel: string, _message: string) => {
      this.clearL1();
    };

    if (this.cache) {
      // A pod that cannot subscribe still serves reads; it only stops hearing peers, so its L1
      // entries expire on their own TTL instead of being cleared early. `subscribe` is async on
      // the Redis adapter, so a sync try/catch alone leaves the rejection unhandled.
      try {
        const subscribed = this.cache.subscribe(
          CATEGORIES_INVALIDATION_CHANNEL,
          this.onInvalidateMessage
        );
        if (subscribed instanceof Promise) subscribed.catch(() => undefined);
      } catch {
        // no listener was registered, so there is nothing to undo
      }
    }
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

  async getCategories(fetcher: () => Promise<Category[]>): Promise<Category[]> {
    // 1. Check L1 In-Memory LRU Cache
    const l1 = this.getL1(CATEGORIES_CACHE_KEY);
    if (l1) {
      return l1.value;
    }

    // 2. Check L2 Distributed Redis Cache
    if (this.cache) {
      try {
        const cachedJson = await this.cache.get(CATEGORIES_CACHE_KEY);
        if (cachedJson) {
          const parsed = JSON.parse(cachedJson) as {
            categories: Array<Category & { createdAt: string; updatedAt: string }>;
          };

          const categories: Category[] = parsed.categories.map((c) => ({
            ...c,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
          }));

          this.setL1(CATEGORIES_CACHE_KEY, categories, this.l1TtlMs);
          return categories;
        }
      } catch {
        // Fallback to fetcher on Redis error
      }
    }

    // 3. Cache Miss: Fetch from source
    const rawCategories = await fetcher();
    const categories = [...rawCategories].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.name.localeCompare(b.name);
    });

    // 4. Populate L2 Distributed Redis Cache
    if (this.cache) {
      try {
        await this.cache.set(
          CATEGORIES_CACHE_KEY,
          JSON.stringify({ categories }),
          this.l2TtlSeconds
        );
      } catch {
        // Non-blocking L2 cache write failure
      }
    }

    // 5. Populate L1 In-Memory LRU Cache
    this.setL1(CATEGORIES_CACHE_KEY, categories, this.l1TtlMs);

    return categories;
  }

  async invalidate(): Promise<void> {
    // 1. Invalidate local L1 cache
    this.clearL1();

    // 2. Invalidate L2 distributed Redis cache
    if (this.cache) {
      try {
        await this.cache.del(CATEGORIES_CACHE_KEY);
      } catch {
        // Non-blocking
      }

      // 3. Broadcast cache invalidation to all cluster replicas via Pub/Sub
      try {
        await this.cache.publish(
          CATEGORIES_INVALIDATION_CHANNEL,
          JSON.stringify({ invalidatedAt: Date.now() })
        );
      } catch {
        // Non-blocking
      }
    }
  }

  close(): void {
    if (this.cache) {
      try {
        this.cache.unsubscribe(CATEGORIES_INVALIDATION_CHANNEL, this.onInvalidateMessage);
      } catch {
        // Safe unsubscribe
      }
    }
    this.clearL1();
  }
}
