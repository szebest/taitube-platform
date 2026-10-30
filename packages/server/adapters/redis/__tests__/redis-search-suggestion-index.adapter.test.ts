import { SEARCH_SUGGESTIONS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { isErr } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { redisSearchSuggestionIndexSubject } from '../../__tests__/contract/redis-subjects';
import { describeSearchSuggestionIndexContract } from '../../__tests__/contract/search-suggestion-index.contract';
import { RedisSearchSuggestionIndexAdapter } from '../redis-search-suggestion-index.adapter';
import { FakeRedis } from './fake-redis';

describeSearchSuggestionIndexContract(redisSearchSuggestionIndexSubject);

describe('RedisSearchSuggestionIndexAdapter', () => {
  it('files the query under each prefix key and refreshes each one for a week', async () => {
    const redis = new FakeRedis();
    const index = new RedisSearchSuggestionIndexAdapter({
      redis: redis.asRedis(),
      keptPerPrefix: SEARCH_SUGGESTIONS.keptPerPrefix,
    });

    expectOk(await index.record('go'));

    expect([...redis.sortedSets.keys()]).toEqual([
      'taitube:search:suggest:g',
      'taitube:search:suggest:go',
    ]);
    expect(redis.ttls.get('taitube:search:suggest:go')).toBe(SEARCH_SUGGESTIONS.ttlSeconds);
  });

  it('shrinks a prefix set that outgrew a lowered cap, the newcomer inheriting the last count evicted', async () => {
    const redis = new FakeRedis();
    const wide = new RedisSearchSuggestionIndexAdapter({ redis: redis.asRedis(), keptPerPrefix: 4 });
    const narrow = new RedisSearchSuggestionIndexAdapter({ redis: redis.asRedis(), keptPerPrefix: 2 });
    const searchedInWindows = async (text: string, windows: number) => {
      for (let n = 0; n < windows; n += 1) {
        expectOk(await wide.record(text));
        await redis.del(CacheKeys.searchCounted(text));
      }
    };
    await searchedInWindows('q-a', 3);
    await searchedInWindows('q-b', 2);
    await searchedInWindows('q-c', 1);
    await searchedInWindows('q-d', 1);

    expectOk(await narrow.record('q-e'));

    expect(redis.sortedSets.get(CacheKeys.searchSuggest('q'))).toEqual(
      new Map([
        ['q-a', 3],
        ['q-e', 3],
      ])
    );
  });

  it('refuses a pool with no room for a single query', () => {
    expect(
      () =>
        new RedisSearchSuggestionIndexAdapter({
          redis: new FakeRedis().asRedis(),
          keptPerPrefix: 0,
        })
    ).toThrow(RangeError);
  });

  it('reports a Redis that is down as CACHE_UNAVAILABLE', async () => {
    const redis = new FakeRedis();
    vi.spyOn(redis, 'zrevrange').mockRejectedValue(new Error('connection refused'));
    const index = new RedisSearchSuggestionIndexAdapter({
      redis: redis.asRedis(),
      keptPerPrefix: SEARCH_SUGGESTIONS.keptPerPrefix,
    });

    const suggested = await index.suggest('go', 3);

    expect(isErr(suggested) && suggested.error.code).toBe(ErrorCodes.CACHE_UNAVAILABLE);
  });
});
