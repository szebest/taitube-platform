import { expectOk } from '@vp/testing/result';
import { describeLivePresenceContract } from '../../__tests__/contract/live-presence.contract';
import { InMemoryLivePresence } from '../in-memory-live-presence';

describeLivePresenceContract(async () => ({
  presence: new InMemoryLivePresence(),
  close: async () => {},
}));

describe('InMemoryLivePresence', () => {
  it('forgets every viewer on clear', async () => {
    const presence = new InMemoryLivePresence();
    expectOk(await presence.touch('s', ['a'], 1));

    presence.clear();

    expect(expectOk(await presence.count('s', 0))).toBe(0);
  });
});
