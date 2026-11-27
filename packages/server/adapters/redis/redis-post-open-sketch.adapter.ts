import { fromPromise, type Result } from '@kit/result';
import type { PostOpenSketchPort } from '@vp/core/ports';
import { POST_OPEN_SKETCH_TTL_SECONDS } from '@vp/domain';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import type { Redis } from 'ioredis';

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
        .expire(key, POST_OPEN_SKETCH_TTL_SECONDS)
        .exec()
        .then((replies) => replies ?? []);
      return counted?.[1] === 1;
    }, cacheUnavailable.during('recordPostOpen'));
  }
}
