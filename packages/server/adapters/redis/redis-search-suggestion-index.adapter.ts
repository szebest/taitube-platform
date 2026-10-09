import type { SearchSuggestionIndexPort } from '@vp/core/ports';
import { SEARCH_SUGGESTIONS, searchSuggestionPrefixes } from '@vp/domain';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { type Result, andThenAsync, fromPromise, map, ok } from '@vp/result';
import type { Redis } from 'ioredis';

/**
 * Space-saving: a full set evicts its least searched member and the newcomer inherits that count
 * plus one, so a new query always gets a place and a set of old favourites never freezes.
 */
export const SEARCH_SUGGESTION_SCRIPT = `
local member, kept, ttl = ARGV[1], tonumber(ARGV[2]), tonumber(ARGV[3])
for _, key in ipairs(KEYS) do
  if redis.call('ZSCORE', key, member) then
    redis.call('ZINCRBY', key, 1, member)
  elseif redis.call('ZCARD', key) < kept then
    redis.call('ZADD', key, 1, member)
  else
    local inherited = 0
    while redis.call('ZCARD', key) >= kept do
      local lowest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
      redis.call('ZREM', key, lowest[1])
      inherited = tonumber(lowest[2])
    end
    redis.call('ZADD', key, inherited + 1, member)
  end
  redis.call('EXPIRE', key, ttl)
end
return 1
`;

export interface RedisSearchSuggestionIndexConfig {
  redis: Redis;
  keptPerPrefix: number;
}

/**
 * One sorted set per prefix, scored by the windows the query was searched in. `SET NX` on the text
 * claims the window. Each set expires when nobody searches under it for a week, so the index stays
 * bounded without a sweeper.
 */
export class RedisSearchSuggestionIndexAdapter implements SearchSuggestionIndexPort {
  private readonly redis: Redis;
  private readonly keptPerPrefix: number;

  constructor(config: RedisSearchSuggestionIndexConfig) {
    if (config.keptPerPrefix < 1) throw new RangeError('keptPerPrefix must be at least 1');
    this.redis = config.redis;
    this.keptPerPrefix = config.keptPerPrefix;
  }

  async record(text: string): Promise<Result<void, CacheUnavailable>> {
    const { countWindowSeconds } = SEARCH_SUGGESTIONS;
    const claimed = await fromPromise(
      () => this.redis.set(CacheKeys.searchCounted(text), '1', 'EX', countWindowSeconds, 'NX'),
      cacheUnavailable.during('recordSearch')
    );
    return andThenAsync(claimed, (first) => (first === null ? ok() : this.count(text)));
  }

  private async count(text: string): Promise<Result<void, CacheUnavailable>> {
    const keys = searchSuggestionPrefixes(text).map(CacheKeys.searchSuggest);
    const done = await fromPromise(
      () =>
        this.redis.eval(
          SEARCH_SUGGESTION_SCRIPT,
          keys.length,
          ...keys,
          text,
          this.keptPerPrefix,
          SEARCH_SUGGESTIONS.ttlSeconds
        ),
      cacheUnavailable.during('recordSearch')
    );
    return map(done, () => undefined);
  }

  async suggest(prefix: string, limit: number): Promise<Result<string[], CacheUnavailable>> {
    return fromPromise(
      () => this.redis.zrevrange(CacheKeys.searchSuggest(prefix), 0, limit - 1),
      cacheUnavailable.during('suggestSearch')
    );
  }
}
