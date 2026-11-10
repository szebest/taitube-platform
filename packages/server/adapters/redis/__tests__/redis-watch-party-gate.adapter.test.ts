import { CacheKeys } from '@vp/events';
import { expectOk } from '@vp/testing/result';
import { redisWatchPartyGateSubject } from '../../__tests__/contract/redis-subjects';
import { describeWatchPartyGateContract } from '../../__tests__/contract/watch-party-gate.contract';
import { RedisWatchPartyGateAdapter } from '../redis-watch-party-gate.adapter';
import { FakeWatchPartyRedis } from './fake-watch-party-redis';

describeWatchPartyGateContract(redisWatchPartyGateSubject);

const makeGate = (stateTtlSeconds = 90) => {
  const redis = new FakeWatchPartyRedis();
  return { redis, gate: new RedisWatchPartyGateAdapter(redis.asRedis(), stateTtlSeconds) };
};

describe('RedisWatchPartyGateAdapter', () => {
  it('never leaves a budget counter without its window, even if an expire would fail', async () => {
    const { redis, gate } = makeGate();
    redis.expire = async () => {
      throw new Error('connection dropped');
    };

    expectOk(await gate.consume('chat', 'r1:user:a', { limit: 5, windowSeconds: 10 }));

    const key = CacheKeys.watchPartyBudget('chat', 'r1:user:a');
    expect([redis.strings.get(key), redis.ttls.get(key)]).toEqual(['1', 10]);
  });

  it('lets the roles version and the skip votes expire after the state time to live', async () => {
    const { redis, gate } = makeGate(90);

    expectOk(await gate.setRolesVersion('r1', 3));
    expectOk(await gate.voteSkip('r1', 'item', 'user:a'));

    expect([
      redis.ttls.get(CacheKeys.watchPartyRolesVersion('r1')),
      redis.ttls.get(CacheKeys.watchPartySkipVotes('r1', 'item')),
    ]).toEqual([90, 90]);
  });

  it.each([
    { stored: 'not json' },
    { stored: JSON.stringify({ roomId: 'r1', principal: { kind: 'bot' }, role: null }) },
  ])('redeems nothing for a stored token that reads as $stored', async ({ stored }) => {
    const { redis, gate } = makeGate();
    redis.strings.set(CacheKeys.watchPartyTicket('t1'), stored);

    expect(expectOk(await gate.redeemTicket('t1'))).toBeNull();
  });

  it('reads a roles version that is no number as unset', async () => {
    const { redis, gate } = makeGate();
    redis.strings.set(CacheKeys.watchPartyRolesVersion('r1'), 'abc');

    expect(expectOk(await gate.rolesVersion('r1'))).toBeNull();
  });
});
