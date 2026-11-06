import { CacheKeys } from '@vp/events';
import { expectOk } from '@vp/testing/result';
import { describeLiveChatGateContract } from '../../__tests__/contract/live-chat-gate.contract';
import { redisLiveChatGateSubject } from '../../__tests__/contract/redis-subjects';
import { RedisLiveChatGateAdapter } from '../redis-live-chat-gate.adapter';
import { FakeLiveRedis } from './fake-live-redis';

describeLiveChatGateContract(redisLiveChatGateSubject);

describe('RedisLiveChatGateAdapter', () => {
  it('never leaves a burst counter without its window, even if an expire would fail', async () => {
    const redis = new FakeLiveRedis();
    redis.expire = async () => {
      throw new Error('connection dropped');
    };
    const gate = new RedisLiveChatGateAdapter(redis.asRedis());

    expectOk(
      await gate.admit('s1', 'u1', {
        slowModeSeconds: 0,
        burst: { messages: 5, windowSeconds: 10 },
      })
    );

    const key = CacheKeys.liveChatBurst('s1', 'u1');
    expect([redis.strings.get(key), redis.ttls.get(key)]).toEqual(['1', 10]);
  });
});
