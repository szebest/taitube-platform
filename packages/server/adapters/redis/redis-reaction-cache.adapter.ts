import { Singleflight } from '@vp/concurrency';
import type { ReactionCachePort } from '@vp/core/ports';
import type { ReactionCounts, ReactionType } from '@vp/domain';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { type Result, fromPromise, ignore, isErr, map, ok, unwrapOr } from '@vp/result';
import {
  type CachedCounts,
  type ReactionCacheBackend,
  ReactionCountsStore,
} from './reaction-counts-store';

export interface RedisReactionCacheAdapterConfig {
  backend: ReactionCacheBackend;
  ttlSeconds: number;
  userReactionTtlSeconds: number;
  beta?: number;
  /** The draw XFetch compares against, uniform on [0, 1). */
  random?: () => number;
}

export class RedisReactionCacheAdapter implements ReactionCachePort {
  private readonly backend: ReactionCacheBackend;
  private readonly counts: ReactionCountsStore;
  private readonly ttlSeconds: number;
  private readonly userReactionTtlSeconds: number;
  private readonly beta: number;
  private readonly random: () => number;
  readonly singleflight = new Singleflight();

  constructor(config: RedisReactionCacheAdapterConfig) {
    this.backend = config.backend;
    this.ttlSeconds = config.ttlSeconds;
    this.userReactionTtlSeconds = config.userReactionTtlSeconds;
    this.beta = config.beta ?? 1.0;
    this.random = config.random ?? Math.random;
    this.counts = new ReactionCountsStore({ backend: config.backend, ttlSeconds: this.ttlSeconds });
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

    ignore(
      await this.counts.write(videoId, fresh.value, Math.max(1, Date.now() - start)),
      'the counts were read; a missed cache write costs the next reader one query'
    );
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

    const xfetch = -cached.delta * this.beta * Math.log(Math.max(0.0001, this.random()));
    if (xfetch <= remaining) return;

    ignore(
      fromPromise(
        () => this.singleflight.do(`counts:${videoId}`, () => this.fetchAndStore(videoId, fetcher)),
        cacheUnavailable.during('refreshCounts')
      ),
      'an early refresh is a best effort; the cached counts already answered'
    );
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

    return await this.singleflight.do(CacheKeys.userReaction(userId, videoId), async () => {
      const fetched = await fetcher();
      if (isErr(fetched)) return fetched;

      ignore(
        await this.setUserReaction(userId, videoId, fetched.value),
        'the reaction was read; a missed cache write costs the next reader one query'
      );
      return fetched;
    });
  }

  private async readUserReaction(userId: string, videoId: string): Promise<string | null> {
    const { backend } = this;
    if (backend.type === 'cache') {
      return unwrapOr(await backend.cache.get(CacheKeys.userReaction(userId, videoId)), null);
    }

    return unwrapOr(
      await fromPromise(
        () => backend.redis.hget(CacheKeys.userReactions(userId), videoId),
        cacheUnavailable.during('getUserReaction')
      ),
      null
    );
  }

  async setUserReaction(
    userId: string,
    videoId: string,
    reaction: ReactionType | null
  ): Promise<Result<void, CacheUnavailable>> {
    const value = reaction ?? 'NONE';
    const { backend } = this;

    if (backend.type === 'redis') {
      const { redis } = backend;
      const key = CacheKeys.userReactions(userId);
      const written = await fromPromise(
        () => redis.hset(key, videoId, value),
        cacheUnavailable.during('setUserReaction')
      );
      if (isErr(written)) return written;

      return map(
        await fromPromise(
          () => redis.expire(key, this.userReactionTtlSeconds),
          cacheUnavailable.during('setUserReaction')
        ),
        () => undefined
      );
    }

    return backend.cache.set(
      CacheKeys.userReaction(userId, videoId),
      value,
      this.userReactionTtlSeconds
    );
  }

  clear(): void {
    this.singleflight.clear();
    this.counts.clear();
  }
}
