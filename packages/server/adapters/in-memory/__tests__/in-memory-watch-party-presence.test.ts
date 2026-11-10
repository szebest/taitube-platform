import { expectOk } from '@vp/testing/result';
import { inMemoryWatchPartyPresenceSubject } from '../../__tests__/contract/in-memory-port-subjects';
import { describeWatchPartyPresenceContract } from '../../__tests__/contract/watch-party-presence.contract';
import { InMemoryWatchPartyPresence } from '../in-memory-watch-party-presence';

describeWatchPartyPresenceContract(inMemoryWatchPartyPresenceSubject);

describe('InMemoryWatchPartyPresence', () => {
  it('forgets every room on clear', async () => {
    const presence = new InMemoryWatchPartyPresence();
    expectOk(await presence.admit('r1', 'user:a', { limit: null, nowMs: 5, staleBeforeMs: 0 }));

    presence.clear();

    expect(expectOk(await presence.members('r1', 0))).toEqual([]);
  });
});
