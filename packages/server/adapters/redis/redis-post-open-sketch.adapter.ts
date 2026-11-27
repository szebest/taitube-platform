import { fromPromise, type Result } from '@kit/result';
import type { PostOpenSketchPort } from '@vp/core/ports';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import type { Redis } from 'ioredis';

const SKETCH_TTL_SECONDS = 3 * 24 * 60 * 60;

export class RedisPostOpenSketchAdapter implements PostOpenSketchPort {
  constructor(private readonly redis: Redis) {}

  async record(
    postId: string,
    viewerKey: string,
    day: string
  ): Promise<Result<boolean, CacheUnavailable>> {
    const key = CacheKeys.postOpens(postId, day);
    return fromPromise(async () => {
      const [counted] = await this.redis
        .multi()
        .pfadd(key, viewerKey)
        .expire(key, SKETCH_TTL_SECONDS)
        .exec()
        .then((replies) => replies ?? []);
      return counted?.[1] === 1;
    }, cacheUnavailable.during('recordPostOpen'));
  }
}
