import { expectOk } from '@vp/testing/result';
import { inMemoryPartyGuestSessionsSubject } from '../../__tests__/contract/in-memory-port-subjects';
import { describePartyGuestSessionsContract } from '../../__tests__/contract/party-guest-sessions.contract';
import { InMemoryPartyGuestSessions } from '../in-memory-party-guest-sessions';

describePartyGuestSessionsContract(inMemoryPartyGuestSessionsSubject);

const SESSION = {
  principal: { kind: 'guest' as const, guestId: 'g'.repeat(24), name: 'Guest 4821' },
  ipHash: 'a1b2c3',
};

describe('InMemoryPartyGuestSessions', () => {
  it('slides the expiry on every resolve, ends it once the clock passes it, and forgets on clear', async () => {
    const clock = { nowMs: 0 };
    const sessions = new InMemoryPartyGuestSessions(() => clock.nowMs);
    const resolve = async () => expectOk(await sessions.resolve('c', 60));
    expectOk(await sessions.issue('c', SESSION, 60));

    clock.nowMs = 50_000;
    expect(await resolve()).toEqual(SESSION);
    clock.nowMs = 100_000;
    expect(await resolve()).toEqual(SESSION);
    clock.nowMs = 160_000;
    expect(await resolve()).toBeNull();

    expectOk(await sessions.issue('c', SESSION, 60));
    sessions.clear();
    expect(await resolve()).toBeNull();
  });
});
