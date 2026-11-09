import { CacheKeys } from '@vp/events';
import { expectOk } from '@vp/testing/result';
import { redisWatchPartyPresenceSubject } from '../../__tests__/contract/redis-subjects';
import { describeWatchPartyPresenceContract } from '../../__tests__/contract/watch-party-presence.contract';
import { RedisWatchPartyPresenceAdapter } from '../redis-watch-party-presence.adapter';
import { FakeWatchPartyRedis } from './fake-watch-party-redis';

describeWatchPartyPresenceContract(redisWatchPartyPresenceSubject);

describe('RedisWatchPartyPresenceAdapter', () => {
  it('keeps both of a room keys for the time to live after each admit and touch', async () => {
    const redis = new FakeWatchPartyRedis();
    const presence = new RedisWatchPartyPresenceAdapter({ redis: redis.asRedis(), ttlSeconds: 90 });
    const keys = [CacheKeys.watchPartyPresence('r1'), CacheKeys.watchPartyPresenceSince('r1')];

    expectOk(await presence.admit('r1', 'user:a', { limit: null, nowMs: 5, staleBeforeMs: 0 }));
    expect(keys.map((key) => redis.ttls.get(key))).toEqual([90, 90]);

    redis.ttls.clear();
    expectOk(await presence.touch('r1', ['user:a'], 6));
    expect(keys.map((key) => redis.ttls.get(key))).toEqual([90, 90]);
  });

  it('sends nothing for a touch with no members', async () => {
    const redis = new FakeWatchPartyRedis();
    const presence = new RedisWatchPartyPresenceAdapter({ redis: redis.asRedis(), ttlSeconds: 90 });

    expectOk(await presence.touch('r1', [], 5));

    expect(redis.sortedSets.size).toBe(0);
  });
});
