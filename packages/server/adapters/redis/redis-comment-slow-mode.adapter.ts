import type { CommentSlowModeClaim, CommentSlowModePort } from '@vp/core/ports';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { andThenAsync, fromPromise, map, ok, type Result } from '@vp/result';
import type { Redis } from 'ioredis';

export class RedisCommentSlowModeAdapter implements CommentSlowModePort {
  constructor(private readonly redis: Redis) {}

  async claim(
    channelId: string,
    authorId: string,
    windowSeconds: number
  ): Promise<Result<CommentSlowModeClaim, CacheUnavailable>> {
    const key = CacheKeys.commentSlowMode(channelId, authorId);
    const reply = await fromPromise(
      () => this.redis.set(key, '1', 'EX', windowSeconds, 'NX'),
      cacheUnavailable.during('claimCommentSlowMode')
    );
    return andThenAsync(reply, async (claimed) => {
      if (claimed !== null) return ok<CommentSlowModeClaim>({ type: 'claimed' });
      const ttlMs = await fromPromise(
        () => this.redis.pttl(key),
        cacheUnavailable.during('claimCommentSlowMode')
      );
      return map(ttlMs, (remaining): CommentSlowModeClaim => ({
        type: 'refused',
        retryAfterSeconds: Math.max(1, Math.ceil(remaining / 1000)),
      }));
    });
  }

  async release(channelId: string, authorId: string): Promise<Result<void, CacheUnavailable>> {
    const deleted = await fromPromise(
      () => this.redis.del(CacheKeys.commentSlowMode(channelId, authorId)),
      cacheUnavailable.during('releaseCommentSlowMode')
    );
    return map(deleted, () => undefined);
  }
}
