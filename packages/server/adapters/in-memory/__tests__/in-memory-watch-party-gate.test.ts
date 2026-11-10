import { expectOk } from '@vp/testing/result';
import { inMemoryWatchPartyGateSubject } from '../../__tests__/contract/in-memory-port-subjects';
import { describeWatchPartyGateContract } from '../../__tests__/contract/watch-party-gate.contract';
import { InMemoryWatchPartyGate } from '../in-memory-watch-party-gate';

describeWatchPartyGateContract(inMemoryWatchPartyGateSubject);

const GRANT = { roomId: 'r1', principal: { kind: 'user' as const, userId: 'u1' }, role: null };
const RULE = { limit: 1, windowSeconds: 10 };

const makeGate = () => {
  const clock = { nowMs: 0 };
  return { clock, gate: new InMemoryWatchPartyGate(() => clock.nowMs) };
};

describe('InMemoryWatchPartyGate', () => {
  it('lets the clock end a token, a budget window and slow mode, and forgets all on clear', async () => {
    const { clock, gate } = makeGate();
    expectOk(await gate.issueTicket('t1', GRANT, 30));
    expectOk(await gate.consume('chat', 's', RULE));
    expectOk(await gate.consume('chat', 's', RULE));
    expectOk(await gate.slowMode('r1', 'user:a', 5));

    clock.nowMs = 30_000;

    expect(expectOk(await gate.redeemTicket('t1'))).toBeNull();
    expect(expectOk(await gate.consume('chat', 's', RULE))).toEqual({ type: 'admitted' });
    expect(expectOk(await gate.slowMode('r1', 'user:a', 5))).toEqual({ type: 'admitted' });

    expectOk(await gate.issueTicket('t3', GRANT, 30));
    expectOk(await gate.setRolesVersion('r1', 2));
    expectOk(await gate.voteSkip('r1', 'item', 'user:a'));
    gate.clear();

    expect(expectOk(await gate.redeemTicket('t3'))).toBeNull();
    expect(expectOk(await gate.rolesVersion('r1'))).toBeNull();
    expect(expectOk(await gate.voteSkip('r1', 'item', 'user:a'))).toBe(1);
  });
});
