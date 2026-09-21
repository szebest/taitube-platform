import type { ReactionCounts, ReactionType } from '@vp/core/domain';
import type { CacheClient, ReactionCachePort } from '@vp/core/ports';
import type { Redis } from 'ioredis';
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
  private readonly ttlSeconds: number;
  private readonly userReactionTtlSeconds: number;
  private readonly beta: number;
  readonly singleflight = new Singleflight();
  private readonly adjustMutexes = new Map<string, Promise<void>>();

  constructor(config: RedisReactionCacheAdapterConfig = {}) {
    this.redis = config.redis;
    this.cache = config.cache;
    this.ttlSeconds = config.ttlSeconds ?? 3600;
    this.userReactionTtlSeconds = config.userReactionTtlSeconds ?? 86400;
    this.beta = config.beta ?? 1.0;
  }

  private videoKey(videoId: string): string {
    return `taitube:video:${videoId}:reactions`;
  }

  private userKey(userId: string): string {
    return `taitube:user:${userId}:reactions`;
  }

  private userKeyFallback(userId: string, videoId: string): string {
    return `taitube:user:${userId}:reactions:${videoId}`;
  }

  async getCounts(
    videoId: string,
    fetcher: () => Promise<ReactionCounts>
  ): Promise<ReactionCounts> {
    const cached = await this.readCounts(videoId);
    if (cached) {
      this.checkProbabilisticRefresh(videoId, cached, fetcher);
      return { likesCount: cached.likesCount, dislikesCount: cached.dislikesCount };
    }

    return await this.singleflight.do(`counts:${videoId}`, async () => {
      const recheck = await this.readCounts(videoId);
      if (recheck) {
        return { likesCount: recheck.likesCount, dislikesCount: recheck.dislikesCount };
      }
      const start = Date.now();
      const fresh = await fetcher();
      const computeTimeMs = Math.max(1, Date.now() - start);
      await this.setCountsWithDelta(videoId, fresh, computeTimeMs);
      return fresh;
    });
  }

  private async readCounts(
    videoId: string
  ): Promise<{
    likesCount: number;
    dislikesCount: number;
    cachedAt?: number;
    delta?: number;
  } | null> {
    const key = this.videoKey(videoId);
    try {
      if (this.redis) {
        const hash = await this.redis.hgetall(key);
        if (hash && (hash['likes'] !== undefined || hash['dislikes'] !== undefined)) {
          return {
            likesCount: Number.parseInt(hash['likes'] || '0', 10),
            dislikesCount: Number.parseInt(hash['dislikes'] || '0', 10),
            cachedAt: hash['cachedAt'] ? Number.parseInt(hash['cachedAt'], 10) : undefined,
            delta: hash['delta'] ? Number.parseInt(hash['delta'], 10) : undefined,
          };
        }
        return null;
      }
      if (this.cache) {
        const json = await this.cache.get(key);
        if (json) {
          const parsed = JSON.parse(json);
          return {
            likesCount: Number(parsed.likes ?? 0),
            dislikesCount: Number(parsed.dislikes ?? 0),
            cachedAt: parsed.cachedAt ? Number(parsed.cachedAt) : undefined,
            delta: parsed.delta ? Number(parsed.delta) : undefined,
          };
        }
      }
    } catch {
      // Fall back to miss on cache errors
    }
    return null;
  }

  private checkProbabilisticRefresh(
    videoId: string,
    cached: { cachedAt?: number; delta?: number },
    fetcher: () => Promise<ReactionCounts>
  ): void {
    if (!(cached.cachedAt && cached.delta)) return;
    const ttlMs = this.ttlSeconds * 1000;
    const age = Date.now() - cached.cachedAt;
    const remaining = ttlMs - age;
    if (remaining > 0) {
      const rand = Math.max(0.0001, Math.random());
      const xfetch = -cached.delta * this.beta * Math.log(rand);
      if (xfetch > remaining) {
        void this.singleflight
          .do(`counts:${videoId}`, async () => {
            const start = Date.now();
            const fresh = await fetcher();
            const computeTimeMs = Math.max(1, Date.now() - start);
            await this.setCountsWithDelta(videoId, fresh, computeTimeMs);
            return fresh;
          })
          .catch(() => {});
      }
    }
  }

  async setCounts(videoId: string, counts: ReactionCounts): Promise<void> {
    await this.setCountsWithDelta(videoId, counts, 10);
  }

  private async setCountsWithDelta(
    videoId: string,
    counts: ReactionCounts,
    delta: number
  ): Promise<void> {
    const key = this.videoKey(videoId);
    const now = Date.now();
    try {
      if (this.redis) {
        await this.redis
          .multi()
          .hset(key, {
            likes: String(counts.likesCount),
            dislikes: String(counts.dislikesCount),
            cachedAt: String(now),
            delta: String(delta),
          })
          .expire(key, this.ttlSeconds)
          .exec();
        return;
      }
      if (this.cache) {
        await this.cache.set(
          key,
          JSON.stringify({
            likes: counts.likesCount,
            dislikes: counts.dislikesCount,
            cachedAt: now,
            delta,
          }),
          this.ttlSeconds
        );
      }
    } catch {
      // Non-blocking cache write failure
    }
  }

  async getUserReaction(
    userId: string,
    videoId: string,
    fetcher: () => Promise<ReactionType | null>
  ): Promise<ReactionType | null> {
    try {
      if (this.redis) {
        const val = await this.redis.hget(this.userKey(userId), videoId);
        if (val !== null && val !== undefined) {
          return val === 'NONE' ? null : (val as ReactionType);
        }
      } else if (this.cache) {
        const val = await this.cache.get(this.userKeyFallback(userId, videoId));
        if (val !== null && val !== undefined) {
          return val === 'NONE' ? null : (val as ReactionType);
        }
      }
    } catch {
      // Fallback
    }

    return await this.singleflight.do(`user:${userId}:${videoId}`, async () => {
      const res = await fetcher();
      await this.setUserReaction(userId, videoId, res);
      return res;
    });
  }

  async setUserReaction(
    userId: string,
    videoId: string,
    reaction: ReactionType | null
  ): Promise<void> {
    const val = reaction ?? 'NONE';
    try {
      if (this.redis) {
        const key = this.userKey(userId);
        await this.redis.hset(key, videoId, val);
        await this.redis.expire(key, this.userReactionTtlSeconds);
        return;
      }
      if (this.cache) {
        const key = this.userKeyFallback(userId, videoId);
        await this.cache.set(key, val, this.userReactionTtlSeconds);
      }
    } catch {
      // Non-blocking
    }
  }

  async adjustCounters(videoId: string, deltaLikes: number, deltaDislikes: number): Promise<void> {
    const key = this.videoKey(videoId);
    try {
      if (this.redis) {
        const exists = await this.redis.exists(key);
        if (exists) {
          const multi = this.redis.multi();
          if (deltaLikes !== 0) multi.hincrby(key, 'likes', deltaLikes);
          if (deltaDislikes !== 0) multi.hincrby(key, 'dislikes', deltaDislikes);
          multi.expire(key, this.ttlSeconds);
          await multi.exec();
        }
        return;
      }
      const cache = this.cache;
      if (cache) {
        const prev = this.adjustMutexes.get(key) ?? Promise.resolve();
        const next = prev
          .then(async () => {
            const json = await cache.get(key);
            if (json) {
              const parsed = JSON.parse(json);
              const likes = Math.max(0, Number(parsed.likes ?? 0) + deltaLikes);
              const dislikes = Math.max(0, Number(parsed.dislikes ?? 0) + deltaDislikes);
              await cache.set(
                key,
                JSON.stringify({ ...parsed, likes, dislikes, cachedAt: Date.now() }),
                this.ttlSeconds
              );
            }
          })
          .finally(() => {
            if (this.adjustMutexes.get(key) === next) {
              this.adjustMutexes.delete(key);
            }
          });
        this.adjustMutexes.set(key, next);
        await next;
      }
    } catch {
      // Non-blocking
    }
  }

  async invalidate(videoId: string): Promise<void> {
    const key = this.videoKey(videoId);
    try {
      if (this.redis) {
        await this.redis.del(key);
        return;
      }
      if (this.cache) {
        await this.cache.del(key);
      }
    } catch {
      // Non-blocking
    }
  }

  clear(): void {
    this.singleflight.clear();
    this.adjustMutexes.clear();
  }
}
