import type { CacheClient } from '@vp/core/ports';
import type { ReactionCounts } from '@vp/domain';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import {
  type Result,
  assertNever,
  fromPromise,
  isErr,
  map,
  ok,
  tryCatch,
  unwrapOr,
} from '@vp/result';
import type { Redis } from 'ioredis';

export interface CachedCounts {
  likesCount: number;
  dislikesCount: number;
  cachedAt?: number;
  delta?: number;
}

/** Redis speaks hashes and atomic increments; any other cache gets JSON and a per-key chain. */
export type ReactionCacheBackend =
  | { type: 'redis'; redis: Redis }
  | { type: 'cache'; cache: CacheClient };

export interface ReactionCountsStoreConfig {
  backend: ReactionCacheBackend;
  ttlSeconds: number;
}

/**
 * Where the counters actually live. Split out of the adapter so the port implementation stays
 * readable and under the file ceiling; the adapter keeps the cache-aside policy, this keeps the
 * two storage shapes it has to speak.
 */
export class ReactionCountsStore {
  private readonly backend: ReactionCacheBackend;
  private readonly ttlSeconds: number;
  private readonly adjustMutexes = new Map<string, Promise<Result<void, CacheUnavailable>>>();

  constructor(config: ReactionCountsStoreConfig) {
    this.backend = config.backend;
    this.ttlSeconds = config.ttlSeconds;
  }

  key(videoId: string): string {
    return `taitube:video:${videoId}:reactions`;
  }

  private unavailable(operation: string) {
    return (cause: unknown): CacheUnavailable => cacheUnavailable(operation, cause);
  }

  /**
   * A failed read is a miss: the caller then asks the fetcher, which is what it would have done
   * for an absent key. That is the one narrowing that belongs here rather than at a caller, since
   * there is no other answer a caller could give it.
   */
  async read(videoId: string): Promise<CachedCounts | null> {
    const key = this.key(videoId);
    const { backend } = this;

    switch (backend.type) {
      case 'redis':
        return this.readHash(backend.redis, key);
      case 'cache':
        return this.readJsonCounts(backend.cache, key);
      default:
        return assertNever(backend, 'ReactionCacheBackend');
    }
  }

  private async readHash(redis: Redis, key: string): Promise<CachedCounts | null> {
    const hash = unwrapOr(
      await fromPromise(() => redis.hgetall(key), this.unavailable('read')),
      null
    );
    if (!hash || (hash['likes'] === undefined && hash['dislikes'] === undefined)) return null;

    return {
      likesCount: Number.parseInt(hash['likes'] || '0', 10),
      dislikesCount: Number.parseInt(hash['dislikes'] || '0', 10),
      cachedAt: hash['cachedAt'] ? Number.parseInt(hash['cachedAt'], 10) : undefined,
      delta: hash['delta'] ? Number.parseInt(hash['delta'], 10) : undefined,
    };
  }

  private async readJsonCounts(cache: CacheClient, key: string): Promise<CachedCounts | null> {
    const parsed = await this.readJson(cache, key);
    if (!parsed) return null;

    return {
      likesCount: Number(parsed.likes ?? 0),
      dislikesCount: Number(parsed.dislikes ?? 0),
      cachedAt: parsed.cachedAt ? Number(parsed.cachedAt) : undefined,
      delta: parsed.delta ? Number(parsed.delta) : undefined,
    };
  }

  private async readJson(cache: CacheClient, key: string): Promise<Record<string, unknown> | null> {
    const json = unwrapOr(await cache.get(key), null);
    if (!json) return null;

    return unwrapOr(
      tryCatch(() => JSON.parse(json), this.unavailable('read')),
      null
    );
  }

  async write(
    videoId: string,
    counts: ReactionCounts,
    delta: number
  ): Promise<Result<void, CacheUnavailable>> {
    const key = this.key(videoId);
    const cachedAt = Date.now();
    const { backend } = this;

    if (backend.type === 'redis') {
      const { redis } = backend;
      const done = await fromPromise(
        () =>
          redis
            .multi()
            .hset(key, {
              likes: String(counts.likesCount),
              dislikes: String(counts.dislikesCount),
              cachedAt: String(cachedAt),
              delta: String(delta),
            })
            .expire(key, this.ttlSeconds)
            .exec(),
        this.unavailable('write')
      );
      return map(done, () => undefined);
    }

    const payload = JSON.stringify({
      likes: counts.likesCount,
      dislikes: counts.dislikesCount,
      cachedAt,
      delta,
    });
    const done = await fromPromise(
      () => backend.cache.set(key, payload, this.ttlSeconds),
      this.unavailable('write')
    );
    return map(done, () => undefined);
  }

  async adjust(
    videoId: string,
    deltaLikes: number,
    deltaDislikes: number
  ): Promise<Result<void, CacheUnavailable>> {
    const key = this.key(videoId);
    const { backend } = this;

    if (backend.type === 'redis') {
      const { redis } = backend;
      const present = await fromPromise(() => redis.exists(key), this.unavailable('adjust'));
      if (isErr(present)) return present;
      if (!present.value) return ok();

      const applied = await fromPromise(() => {
        const multi = redis.multi();
        if (deltaLikes !== 0) multi.hincrby(key, 'likes', deltaLikes);
        if (deltaDislikes !== 0) multi.hincrby(key, 'dislikes', deltaDislikes);
        return multi.expire(key, this.ttlSeconds).exec();
      }, this.unavailable('adjust'));

      return map(applied, () => undefined);
    }

    return await this.adjustSerialised(backend.cache, key, deltaLikes, deltaDislikes);
  }

  /**
   * A cache with no HINCRBY needs read-modify-write, so the per-key chain is what stops two
   * concurrent adjustments from both reading the same pre-increment value.
   */
  private async adjustSerialised(
    cache: CacheClient,
    key: string,
    deltaLikes: number,
    deltaDislikes: number
  ): Promise<Result<void, CacheUnavailable>> {
    const prev = this.adjustMutexes.get(key) ?? Promise.resolve(ok());
    const next = prev
      .then(async (): Promise<Result<void, CacheUnavailable>> => {
        const parsed = await this.readJson(cache, key);
        if (!parsed) return ok();

        const likes = Math.max(0, Number(parsed['likes'] ?? 0) + deltaLikes);
        const dislikes = Math.max(0, Number(parsed['dislikes'] ?? 0) + deltaDislikes);
        return cache.set(
          key,
          JSON.stringify({ ...parsed, likes, dislikes, cachedAt: Date.now() }),
          this.ttlSeconds
        );
      })
      .finally(() => {
        if (this.adjustMutexes.get(key) === next) this.adjustMutexes.delete(key);
      });
    this.adjustMutexes.set(key, next);

    const settled = await fromPromise(() => next, this.unavailable('adjust'));
    return isErr(settled) ? settled : settled.value;
  }

  async invalidate(videoId: string): Promise<Result<void, CacheUnavailable>> {
    const key = this.key(videoId);
    const { backend } = this;

    switch (backend.type) {
      case 'redis':
        return map(
          await fromPromise(() => backend.redis.del(key), this.unavailable('invalidate')),
          () => undefined
        );
      case 'cache':
        return map(
          await fromPromise(() => backend.cache.del(key), this.unavailable('invalidate')),
          () => undefined
        );
      default:
        return assertNever(backend, 'ReactionCacheBackend');
    }
  }

  clear(): void {
    this.adjustMutexes.clear();
  }
}
