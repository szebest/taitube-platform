import type { CacheClient } from '@vp/core/ports';
import type { ReactionCounts } from '@vp/domain';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { type Result, fromPromise, isErr, map, ok, tryCatch, unwrapOr } from '@vp/result';
import type { Redis } from 'ioredis';

export interface CachedCounts {
  likesCount: number;
  dislikesCount: number;
  cachedAt?: number;
  delta?: number;
}

export interface ReactionCountsStoreConfig {
  redis?: Redis;
  cache?: CacheClient | null;
  ttlSeconds: number;
}

/**
 * Where the counters actually live. Split out of the adapter so the port implementation stays
 * readable and under the file ceiling; the adapter keeps the cache-aside policy, this keeps the
 * two storage shapes it has to speak.
 */
export class ReactionCountsStore {
  private readonly redis?: Redis;
  private readonly cache?: CacheClient | null;
  private readonly ttlSeconds: number;
  private readonly adjustMutexes = new Map<string, Promise<void>>();

  constructor(config: ReactionCountsStoreConfig) {
    this.redis = config.redis;
    this.cache = config.cache;
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

    if (this.redis) {
      const redis = this.redis;
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

    const parsed = this.cache ? await this.readJson(key) : null;
    if (!parsed) return null;

    return {
      likesCount: Number(parsed.likes ?? 0),
      dislikesCount: Number(parsed.dislikes ?? 0),
      cachedAt: parsed.cachedAt ? Number(parsed.cachedAt) : undefined,
      delta: parsed.delta ? Number(parsed.delta) : undefined,
    };
  }

  private async readJson(key: string): Promise<Record<string, unknown> | null> {
    const cache = this.cache;
    if (!cache) return null;

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

    const redis = this.redis;
    if (redis) {
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

    if (this.cache) {
      const payload = JSON.stringify({
        likes: counts.likesCount,
        dislikes: counts.dislikesCount,
        cachedAt,
        delta,
      });
      const cache = this.cache;
      const done = await fromPromise(
        () => cache.set(key, payload, this.ttlSeconds),
        this.unavailable('write')
      );
      return map(done, () => undefined);
    }

    return ok();
  }

  async adjust(
    videoId: string,
    deltaLikes: number,
    deltaDislikes: number
  ): Promise<Result<void, CacheUnavailable>> {
    const key = this.key(videoId);

    const redis = this.redis;
    if (redis) {
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

    if (!this.cache) return ok();
    return await this.adjustSerialised(key, deltaLikes, deltaDislikes);
  }

  /**
   * A cache with no HINCRBY needs read-modify-write, so the per-key chain is what stops two
   * concurrent adjustments from both reading the same pre-increment value.
   */
  private async adjustSerialised(
    key: string,
    deltaLikes: number,
    deltaDislikes: number
  ): Promise<Result<void, CacheUnavailable>> {
    const cache = this.cache;
    if (!cache) return ok();

    const prev = this.adjustMutexes.get(key) ?? Promise.resolve();
    const next = prev
      .then(async () => {
        const parsed = await this.readJson(key);
        if (!parsed) return;

        const likes = Math.max(0, Number(parsed['likes'] ?? 0) + deltaLikes);
        const dislikes = Math.max(0, Number(parsed['dislikes'] ?? 0) + deltaDislikes);
        await cache.set(
          key,
          JSON.stringify({ ...parsed, likes, dislikes, cachedAt: Date.now() }),
          this.ttlSeconds
        );
      })
      .finally(() => {
        if (this.adjustMutexes.get(key) === next) this.adjustMutexes.delete(key);
      });
    this.adjustMutexes.set(key, next);

    return map(await fromPromise(() => next, this.unavailable('adjust')), () => undefined);
  }

  async invalidate(videoId: string): Promise<Result<void, CacheUnavailable>> {
    const key = this.key(videoId);

    const redis = this.redis;
    if (redis) {
      return map(
        await fromPromise(() => redis.del(key), this.unavailable('invalidate')),
        () => undefined
      );
    }

    const cache = this.cache;
    if (cache) {
      return map(
        await fromPromise(() => cache.del(key), this.unavailable('invalidate')),
        () => undefined
      );
    }

    return ok();
  }

  clear(): void {
    this.adjustMutexes.clear();
  }
}
