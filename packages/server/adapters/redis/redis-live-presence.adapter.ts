import type { LivePresencePort } from '@vp/core/ports';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { fromPromise, map, ok, type Result } from '@vp/result';
import type { Redis } from 'ioredis';

export interface RedisLivePresenceConfig {
  redis: Redis;
  /** How long a stream's set outlives its last touch, so an abandoned one cleans itself up. */
  ttlSeconds: number;
}

/** One sorted set per stream: each viewer scored by the last time it touched. */
export class RedisLivePresenceAdapter implements LivePresencePort {
  constructor(private readonly config: RedisLivePresenceConfig) {}

  async touch(
    liveStreamId: string,
    viewerIds: readonly string[],
    atMs: number
  ): Promise<Result<void, CacheUnavailable>> {
    if (viewerIds.length === 0) return ok();
    const { redis, ttlSeconds } = this.config;
    const key = CacheKeys.livePresence(liveStreamId);
    const done = await fromPromise(async () => {
      await redis.zadd(key, ...viewerIds.flatMap((viewerId) => [atMs, viewerId]));
      await redis.expire(key, ttlSeconds);
    }, cacheUnavailable.during('touchLivePresence'));
    return map(done, () => undefined);
  }

  async leave(liveStreamId: string, viewerId: string): Promise<Result<void, CacheUnavailable>> {
    const done = await fromPromise(
      () => this.config.redis.zrem(CacheKeys.livePresence(liveStreamId), viewerId),
      cacheUnavailable.during('leaveLivePresence')
    );
    return map(done, () => undefined);
  }

  async count(liveStreamId: string, sinceMs: number): Promise<Result<number, CacheUnavailable>> {
    const { redis } = this.config;
    const key = CacheKeys.livePresence(liveStreamId);
    return fromPromise(async () => {
      await redis.zremrangebyscore(key, '-inf', `(${sinceMs}`);
      return redis.zcard(key);
    }, cacheUnavailable.during('countLivePresence'));
  }
}
