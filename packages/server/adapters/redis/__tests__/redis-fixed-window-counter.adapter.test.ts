import { expectOk } from '@kit/testing/result';
import { CacheKeys } from '@vp/events';
import { describeFixedWindowCounterContract } from '../../__tests__/contract/fixed-window-counter.contract';
import { redisFixedWindowCounterSubject } from '../../__tests__/contract/redis-subjects';
import { RedisFixedWindowCounterAdapter } from '../redis-fixed-window-counter.adapter';
import { FakeLiveRedis } from './fake-live-redis';

describeFixedWindowCounterContract(redisFixedWindowCounterSubject);

describe('RedisFixedWindowCounterAdapter', () => {
  it('opens the window with its expiry in the command that creates it', async () => {
    const redis = new FakeLiveRedis();
    const counter = new RedisFixedWindowCounterAdapter(redis.asRedis());

    expectOk(await counter.hit('t1', 60_000));

    const key = CacheKeys.rateWindow('t1');
    expect([redis.strings.get(key), redis.ttls.get(key)]).toEqual(['1', 60]);
  });

  it('reports the cache as unavailable when Redis fails', async () => {
    const redis = new FakeLiveRedis();
    redis.incr = async () => {
      throw new Error('connection dropped');
    };

    const hit = await new RedisFixedWindowCounterAdapter(redis.asRedis()).hit('t1', 60_000);

    expect(hit).toMatchObject({ ok: false });
  });
});
