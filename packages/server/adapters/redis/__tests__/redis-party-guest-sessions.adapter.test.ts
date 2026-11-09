import { createHash } from 'node:crypto';
import { CacheKeys } from '@vp/events';
import { expectOk } from '@vp/testing/result';
import { describePartyGuestSessionsContract } from '../../__tests__/contract/party-guest-sessions.contract';
import { redisPartyGuestSessionsSubject } from '../../__tests__/contract/redis-subjects';
import { RedisPartyGuestSessionsAdapter } from '../redis-party-guest-sessions.adapter';
import { FakeWatchPartyRedis } from './fake-watch-party-redis';

describePartyGuestSessionsContract(redisPartyGuestSessionsSubject);

const SESSION = {
  principal: { kind: 'guest' as const, guestId: 'g'.repeat(24), name: 'Guest 4821' },
  ipHash: 'a1b2c3',
};

const makeSessions = () => {
  const redis = new FakeWatchPartyRedis();
  return { redis, sessions: new RedisPartyGuestSessionsAdapter(redis.asRedis()) };
};

describe('RedisPartyGuestSessionsAdapter', () => {
  it('keys the session by the credential hash, never the credential', async () => {
    const { redis, sessions } = makeSessions();

    expectOk(await sessions.issue('secret-credential', SESSION, 60));

    const hash = createHash('sha256').update('secret-credential').digest('hex');
    expect([...redis.strings.keys()]).toEqual([CacheKeys.partyGuestSession(hash)]);
    expect(redis.ttls.get(CacheKeys.partyGuestSession(hash))).toBe(60);
  });

  it('slides the time to live forward on every resolve', async () => {
    const { redis, sessions } = makeSessions();
    expectOk(await sessions.issue('c', SESSION, 60));

    expectOk(await sessions.resolve('c', 600));

    expect([...redis.ttls.values()]).toEqual([600]);
  });

  it.each([
    { stored: 'not json' },
    { stored: JSON.stringify({ principal: { kind: 'user', userId: 'u1' }, ipHash: null }) },
  ])('resolves nothing for a stored session that reads as $stored', async ({ stored }) => {
    const { redis, sessions } = makeSessions();
    const hash = createHash('sha256').update('c').digest('hex');
    redis.strings.set(CacheKeys.partyGuestSession(hash), stored);

    expect(expectOk(await sessions.resolve('c', 60))).toBeNull();
  });
});
