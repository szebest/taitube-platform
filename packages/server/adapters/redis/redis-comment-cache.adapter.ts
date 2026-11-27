import type { CacheUnavailable } from '@kit/errors';
import type { CacheClient } from '@kit/ports';
import { type Result, ignore, isOk, map, ok, parseJson, unwrapOr } from '@kit/result';
import type { CommentCachePort, HotComments } from '@vp/core/ports';
import {
  COMMENT_MODERATION_REASONS,
  type CommentTarget,
  DISCLOSURES,
  HELD_REASONS,
  MODERATION_STATES,
} from '@vp/domain';
import { CacheKeys } from '@vp/events';
import { z } from 'zod';

const HotCommentsSchema = z.object({
  total: z.number().int().nonnegative(),
  threads: z.array(
    z.object({
      id: z.string(),
      target: z.object({ type: z.enum(['video', 'post']), id: z.string() }),
      channelId: z.string(),
      authorId: z.string(),
      authorChannelId: z.string(),
      parentId: z.string().nullable(),
      content: z.string(),
      isPinned: z.boolean(),
      isEdited: z.boolean(),
      likeCount: z.number().int(),
      heartedAt: z.union([z.null(), z.coerce.date()]),
      moderationState: z.enum(MODERATION_STATES),
      moderationDisclosure: z.enum(DISCLOSURES).nullable(),
      moderationReason: z.enum(COMMENT_MODERATION_REASONS).nullable(),
      moderationNote: z.string().nullable(),
      moderatedBy: z.string().nullable(),
      moderatedAt: z.union([z.null(), z.coerce.date()]),
      heldReason: z.enum(HELD_REASONS).nullable(),
      looksLikeQuestion: z.boolean(),
      createdAt: z.coerce.date(),
      updatedAt: z.coerce.date(),
      author: z.object({
        userId: z.string(),
        channelId: z.string(),
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
    target: CommentTarget,
    fetcher: () => Promise<Result<HotComments, E>>
  ): Promise<Result<HotComments, E>> {
    const key = CacheKeys.hotComments(target.type, target.id);
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

  async invalidate(target: CommentTarget): Promise<Result<void, CacheUnavailable>> {
    return map(
      await this.cache.del(CacheKeys.hotComments(target.type, target.id)),
      () => undefined
    );
  }

  private parse(raw: string | null): HotComments | null {
    if (raw === null) return null;
    const json = parseJson(raw);
    if (!isOk(json)) return null;
    const parsed = HotCommentsSchema.safeParse(json.value);
    return parsed.success ? parsed.data : null;
  }
}
