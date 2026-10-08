import type { SearchSuggestionIndexPort } from '@vp/core/ports';
import { SEARCH_SUGGESTIONS, searchSuggestionPrefixes } from '@vp/domain';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { type Result, andThenAsync, fromPromise, map, ok } from '@vp/result';
import type { Redis } from 'ioredis';

/**
 * One sorted set per prefix, scored by the windows the query was searched in. `SET NX` on the text
 * claims the window. Each set keeps its most searched members and expires when nobody searches
 * under it for a week, so the index stays bounded without a sweeper.
 */
export class RedisSearchSuggestionIndexAdapter implements SearchSuggestionIndexPort {
  constructor(private readonly redis: Redis) {}

  async record(text: string): Promise<Result<void, CacheUnavailable>> {
    const { countWindowSeconds } = SEARCH_SUGGESTIONS;
    const claimed = await fromPromise(
      () => this.redis.set(CacheKeys.searchCounted(text), '1', 'EX', countWindowSeconds, 'NX'),
      cacheUnavailable.during('recordSearch')
    );
    return andThenAsync(claimed, (first) => (first === null ? ok() : this.count(text)));
  }

  private async count(text: string): Promise<Result<void, CacheUnavailable>> {
    const { keptPerPrefix, ttlSeconds } = SEARCH_SUGGESTIONS;
    const pipeline = this.redis.pipeline();
    for (const prefix of searchSuggestionPrefixes(text)) {
      const key = CacheKeys.searchSuggest(prefix);
      pipeline
        .zincrby(key, 1, text)
        .zremrangebyrank(key, 0, -(keptPerPrefix + 1))
        .expire(key, ttlSeconds);
    }
    const done = await fromPromise(() => pipeline.exec(), cacheUnavailable.during('recordSearch'));
    return map(done, () => undefined);
  }

  async suggest(prefix: string, limit: number): Promise<Result<string[], CacheUnavailable>> {
    return fromPromise(
      () => this.redis.zrevrange(CacheKeys.searchSuggest(prefix), 0, limit - 1),
      cacheUnavailable.during('suggestSearch')
    );
  }
}
