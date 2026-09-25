import type { CacheClient, PlayheadCachePort } from '@vp/core/ports';
import type { BufferedPlayhead } from '@vp/domain';
import type { CacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { type Result, isOk, map, parseJson } from '@vp/result';
import { z } from 'zod';

const PlayheadSchema = z.object({
  progressSeconds: z.number().int().nonnegative(),
  durationSeconds: z.number().int().positive(),
  watchedAt: z.coerce.date(),
  flushedAt: z.coerce.date(),
});

export interface RedisPlayheadCacheAdapterConfig {
  cache: CacheClient;
  ttlSeconds: number;
}

/** One key per user and video, so each playhead expires on its own clock. */
export class RedisPlayheadCacheAdapter implements PlayheadCachePort {
  private readonly cache: CacheClient;
  private readonly ttlSeconds: number;

  constructor(config: RedisPlayheadCacheAdapterConfig) {
    this.cache = config.cache;
    this.ttlSeconds = config.ttlSeconds;
  }

  async read(
    userId: string,
    videoId: string
  ): Promise<Result<BufferedPlayhead | null, CacheUnavailable>> {
    const raw = await this.cache.get(CacheKeys.userPlayhead(userId, videoId));
    return map(raw, (value) => (value === null ? null : parsed(videoId, value)));
  }

  async write(
    userId: string,
    { videoId, ...playhead }: BufferedPlayhead
  ): Promise<Result<void, CacheUnavailable>> {
    return await this.cache.set(
      CacheKeys.userPlayhead(userId, videoId),
      JSON.stringify(playhead),
      this.ttlSeconds
    );
  }

  async forget(
    userId: string,
    videoIds: readonly string[]
  ): Promise<Result<void, CacheUnavailable>> {
    return await this.cache.del(
      ...videoIds.map((videoId) => CacheKeys.userPlayhead(userId, videoId))
    );
  }
}

function parsed(videoId: string, raw: string): BufferedPlayhead | null {
  const json = parseJson(raw);
  if (!isOk(json)) return null;
  const playhead = PlayheadSchema.safeParse(json.value);
  return playhead.success ? { videoId, ...playhead.data } : null;
}
