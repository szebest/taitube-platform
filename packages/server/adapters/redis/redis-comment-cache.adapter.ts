import type { CacheClient, CommentCachePort, HotComments } from '@vp/core/ports';
import type { CacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { type Result, ignore, isOk, map, ok, parseJson, unwrapOr } from '@vp/result';
import { z } from 'zod';

const HotCommentsSchema = z.object({
  total: z.number().int().nonnegative(),
  threads: z.array(
    z.object({
      id: z.string(),
      videoId: z.string(),
      authorId: z.string(),
      parentId: z.string().nullable(),
      content: z.string(),
      isPinned: z.boolean(),
      isEdited: z.boolean(),
      likeCount: z.number().int(),
      createdAt: z.coerce.date(),
      updatedAt: z.coerce.date(),
      author: z.object({
        userId: z.string(),
        channelId: z.string().nullable(),
        handle: z.string().nullable(),
        displayName: z.string().nullable(),
        avatarUrl: z.string().nullable(),
      }),
      replyCount: z.number().int().nonnegative(),
    })
  ),
});

export interface RedisCommentCacheAdapterConfig {
  cache: CacheClient;
  hotTtlSeconds: number;
}

/**
 * A miss, a dead Redis and an entry that no longer parses all fall through to the fetcher, so the
 * cache costs latency and never correctness. Only the fetcher's own failure reaches the caller.
 */
export class RedisCommentCacheAdapter implements CommentCachePort {
  private readonly cache: CacheClient;
  private readonly hotTtlSeconds: number;

  constructor(config: RedisCommentCacheAdapterConfig) {
    this.cache = config.cache;
    this.hotTtlSeconds = config.hotTtlSeconds;
  }

  async getHot<E>(
    videoId: string,
    fetcher: () => Promise<Result<HotComments, E>>
  ): Promise<Result<HotComments, E>> {
    const key = CacheKeys.videoHotComments(videoId);
    const cached = this.parse(unwrapOr(await this.cache.get(key), null));
    if (cached) return ok(cached);

    const fetched = await fetcher();
    if (isOk(fetched)) {
      ignore(
        await this.cache.set(key, JSON.stringify(fetched.value), this.hotTtlSeconds),
        'the page was read; a missed write costs the next viewer one query'
      );
    }
    return fetched;
  }

  async invalidate(videoId: string): Promise<Result<void, CacheUnavailable>> {
    return map(await this.cache.del(CacheKeys.videoHotComments(videoId)), () => undefined);
  }

  private parse(raw: string | null): HotComments | null {
    if (raw === null) return null;
    const json = parseJson(raw);
    if (!isOk(json)) return null;
    const parsed = HotCommentsSchema.safeParse(json.value);
    return parsed.success ? parsed.data : null;
  }
}
