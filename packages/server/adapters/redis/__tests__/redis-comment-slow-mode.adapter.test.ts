import { CacheKeys } from '@vp/events';
import { expectOk } from '@vp/testing/result';
import { describeCommentSlowModeContract } from '../../__tests__/contract/comment-slow-mode.contract';
import { redisCommentSlowModeSubject } from '../../__tests__/contract/redis-subjects';
import { RedisCommentSlowModeAdapter } from '../redis-comment-slow-mode.adapter';
import { FakeLiveRedis } from './fake-live-redis';

describeCommentSlowModeContract(redisCommentSlowModeSubject);

describe('RedisCommentSlowModeAdapter', () => {
  it('opens the window with its expiry in the same command that claims it', async () => {
    const redis = new FakeLiveRedis();
    const slowMode = new RedisCommentSlowModeAdapter(redis.asRedis());

    expectOk(await slowMode.claim('c1', 'u1', 30));

    const key = CacheKeys.commentSlowMode('c1', 'u1');
    expect([redis.strings.has(key), redis.ttls.get(key)]).toEqual([true, 30]);
  });

  it('rounds the remaining milliseconds up to whole seconds, and never to zero', async () => {
    const redis = new FakeLiveRedis();
    const slowMode = new RedisCommentSlowModeAdapter(redis.asRedis());
    expectOk(await slowMode.claim('c1', 'u1', 30));
    redis.pttl = async () => 1_200;

    expect(expectOk(await slowMode.claim('c1', 'u1', 30))).toEqual({
      type: 'refused',
      retryAfterSeconds: 2,
    });

    redis.pttl = async () => 0;
    expect(expectOk(await slowMode.claim('c1', 'u1', 30))).toEqual({
      type: 'refused',
      retryAfterSeconds: 1,
    });
  });

  it('reports the cache as unavailable when Redis fails', async () => {
    const redis = new FakeLiveRedis();
    redis.set = async () => {
      throw new Error('connection dropped');
    };

    const claimed = await new RedisCommentSlowModeAdapter(redis.asRedis()).claim('c1', 'u1', 30);

    expect(claimed).toMatchObject({ ok: false });
  });
});
