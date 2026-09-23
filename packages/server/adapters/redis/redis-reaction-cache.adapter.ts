import type { CacheClient, ReactionCachePort } from '@vp/core/ports';
import type { ReactionCounts, ReactionType } from '@vp/domain';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { type Result, fromPromise, isErr, map, ok, unwrapOr } from '@vp/result';
import type { Redis } from 'ioredis';
import { type CachedCounts, ReactionCountsStore } from './reaction-counts-store';
import { Singleflight } from './singleflight';

export interface RedisReactionCacheAdapterConfig {
  redis?: Redis;
  cache?: CacheClient | null;
  ttlSeconds?: number; // default: 3600 (1 hour)
  userReactionTtlSeconds?: number; // default: 86400 (24 hours)
  beta?: number; // XFetch beta factor, default: 1.0
}

export class RedisReactionCacheAdapter implements ReactionCachePort {
  private readonly redis?: Redis;
  private readonly cache?: CacheClient | null;
  private readonly counts: ReactionCountsStore;
  private readonly ttlSeconds: number;
  private readonly userReactionTtlSeconds: number;
  private readonly beta: number;
  readonly singleflight = new Singleflight();

  constructor(config: RedisReactionCacheAdapterConfig = {}) {
    this.redis = config.redis;
    this.cache = config.cache;
    this.ttlSeconds = config.ttlSeconds ?? 3600;
    this.userReactionTtlSeconds = config.userReactionTtlSeconds ?? 86400;
    this.beta = config.beta ?? 1.0;
    this.counts = new ReactionCountsStore({
      redis: config.redis,
      cache: config.cache,
      ttlSeconds: this.ttlSeconds,
    });
  }

  private userKey(userId: string): string {
    return `taitube:user:${userId}:reactions`;
  }

  private userKeyFallback(userId: string, videoId: string): string {
    return `taitube:user:${userId}:reactions:${videoId}`;
  }

  private unavailable(operation: string) {
    return (cause: unknown): CacheUnavailable => cacheUnavailable(operation, cause);
  }

  async getCounts<E>(
    videoId: string,
    fetcher: () => Promise<Result<ReactionCounts, E>>
  ): Promise<Result<ReactionCounts, E | CacheUnavailable>> {
    const cached = await this.counts.read(videoId);
    if (cached) {
      this.checkProbabilisticRefresh(videoId, cached, fetcher);
      return ok({ likesCount: cached.likesCount, dislikesCount: cached.dislikesCount });
    }

    return await this.singleflight.do(`counts:${videoId}`, async () => {
      const recheck = await this.counts.read(videoId);
      if (recheck) {
        return ok({ likesCount: recheck.likesCount, dislikesCount: recheck.dislikesCount });
      }
      return await this.fetchAndStore(videoId, fetcher);
    });
  }

  private async fetchAndStore<E>(
    videoId: string,
    fetcher: () => Promise<Result<ReactionCounts, E>>
  ): Promise<Result<ReactionCounts, E | CacheUnavailable>> {
    const start = Date.now();
    const fresh = await fetcher();
    if (isErr(fresh)) return fresh;

    await this.counts.write(videoId, fresh.value, Math.max(1, Date.now() - start));
    return fresh;
  }

  /**
   * XFetch: refresh early with a probability that rises as the entry ages, so the fleet does not
   * stampede the database the instant a popular key expires.
   */
  private checkProbabilisticRefresh<E>(
    videoId: string,
    cached: CachedCounts,
    fetcher: () => Promise<Result<ReactionCounts, E>>
  ): void {
    if (!(cached.cachedAt && cached.delta)) return;

    const remaining = this.ttlSeconds * 1000 - (Date.now() - cached.cachedAt);
    if (remaining <= 0) return;

    const xfetch = -cached.delta * this.beta * Math.log(Math.max(0.0001, Math.random()));
    if (xfetch <= remaining) return;

    void this.singleflight
      .do(`counts:${videoId}`, () => this.fetchAndStore(videoId, fetcher))
      .catch(() => {});
  }

  async setCounts(
    videoId: string,
    counts: ReactionCounts
  ): Promise<Result<void, CacheUnavailable>> {
    return await this.counts.write(videoId, counts, 10);
  }

  async adjustCounters(
    videoId: string,
    deltaLikes: number,
    deltaDislikes: number
  ): Promise<Result<void, CacheUnavailable>> {
    return await this.counts.adjust(videoId, deltaLikes, deltaDislikes);
  }

  async invalidate(videoId: string): Promise<Result<void, CacheUnavailable>> {
    return await this.counts.invalidate(videoId);
  }

  async getUserReaction<E>(
    userId: string,
    videoId: string,
    fetcher: () => Promise<Result<ReactionType | null, E>>
  ): Promise<Result<ReactionType | null, E | CacheUnavailable>> {
    const raw = await this.readUserReaction(userId, videoId);
    if (raw !== null && raw !== undefined) {
      return ok(raw === 'NONE' ? null : (raw as ReactionType));
    }

    return await this.singleflight.do(`user:${userId}:${videoId}`, async () => {
      const fetched = await fetcher();
      if (isErr(fetched)) return fetched;

      await this.setUserReaction(userId, videoId, fetched.value);
      return fetched;
    });
  }

  private async readUserReaction(userId: string, videoId: string): Promise<string | null> {
    if (this.redis) {
      return unwrapOr(
        await fromPromise(
          this.redis.hget(this.userKey(userId), videoId),
          this.unavailable('getUserReaction')
        ),
        null
      );
    }

    if (this.cache) {
      return unwrapOr(
        await fromPromise(
          this.cache.get(this.userKeyFallback(userId, videoId)),
          this.unavailable('getUserReaction')
        ),
        null
      );
    }

    return null;
  }

  async setUserReaction(
    userId: string,
    videoId: string,
    reaction: ReactionType | null
  ): Promise<Result<void, CacheUnavailable>> {
    const value = reaction ?? 'NONE';

    if (this.redis) {
      const key = this.userKey(userId);
      const written = await fromPromise(
        this.redis.hset(key, videoId, value),
        this.unavailable('setUserReaction')
      );
      if (isErr(written)) return written;

      return map(
        await fromPromise(
          this.redis.expire(key, this.userReactionTtlSeconds),
          this.unavailable('setUserReaction')
        ),
        () => undefined
      );
    }

    if (this.cache) {
      return map(
        await fromPromise(
          this.cache.set(this.userKeyFallback(userId, videoId), value, this.userReactionTtlSeconds),
          this.unavailable('setUserReaction')
        ),
        () => undefined
      );
    }

    return ok();
  }

  clear(): void {
    this.singleflight.clear();
    this.counts.clear();
  }
}
