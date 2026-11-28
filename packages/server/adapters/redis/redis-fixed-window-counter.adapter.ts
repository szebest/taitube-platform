import { andThenAsync, fromPromise, map, type Result } from '@kit/result';
import type { FixedWindowCounterPort, FixedWindowHit } from '@vp/core/ports';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import type { Redis } from 'ioredis';

export class RedisFixedWindowCounterAdapter implements FixedWindowCounterPort {
  constructor(private readonly redis: Redis) {}

  /**
   * The window is created with its expiry before the count rises: an INCR then PEXPIRE can die
   * between the two and leave a counter that never expires, which would block the key for good.
   */
  async hit(key: string, windowMs: number): Promise<Result<FixedWindowHit, CacheUnavailable>> {
    const redisKey = CacheKeys.rateWindow(key);
    const counted = await fromPromise(async () => {
      await this.redis.set(redisKey, '0', 'PX', windowMs, 'NX');
      return this.redis.incr(redisKey);
    }, cacheUnavailable.during('hitFixedWindowCounter'));

    return andThenAsync(counted, async (count) => {
      const ttlMs = await fromPromise(
        () => this.redis.pttl(redisKey),
        cacheUnavailable.during('hitFixedWindowCounter')
      );
      return map(ttlMs, (remaining): FixedWindowHit => ({
        count,
        resetInMs: Math.max(0, remaining),
      }));
    });
  }
}
