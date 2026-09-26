import { SEARCH_SUGGESTIONS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
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
    const index = new RedisSearchSuggestionIndexAdapter(redis.asRedis());

    expectOk(await index.record('go'));

    expect([...redis.sortedSets.keys()]).toEqual([
      'taitube:search:suggest:g',
      'taitube:search:suggest:go',
    ]);
    expect(redis.ttls.get('taitube:search:suggest:go')).toBe(SEARCH_SUGGESTIONS.ttlSeconds);
  });

  it('reports a Redis that is down as CACHE_UNAVAILABLE', async () => {
    const redis = new FakeRedis();
    vi.spyOn(redis, 'zrevrange').mockRejectedValue(new Error('connection refused'));
    const index = new RedisSearchSuggestionIndexAdapter(redis.asRedis());

    const suggested = await index.suggest('go', 3);

    expect(isErr(suggested) && suggested.error.code).toBe(ErrorCodes.CACHE_UNAVAILABLE);
  });
});
