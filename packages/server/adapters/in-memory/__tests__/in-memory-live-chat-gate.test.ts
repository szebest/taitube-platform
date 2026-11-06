import { expectOk } from '@vp/testing/result';
import { describeLiveChatGateContract } from '../../__tests__/contract/live-chat-gate.contract';
import { InMemoryLiveChatGate } from '../in-memory-live-chat-gate';

describeLiveChatGateContract(async () => ({
  gate: new InMemoryLiveChatGate(),
  close: async () => {},
}));

describe('InMemoryLiveChatGate', () => {
  it('admits a slowed sender again once the clock passes slow mode, and forgets on clear', async () => {
    let nowMs = 0;
    const gate = new InMemoryLiveChatGate(() => nowMs);
    const rules = { slowModeSeconds: 5, burst: { messages: 10, windowSeconds: 10 } };
    const admit = async () => expectOk(await gate.admit('s', 'u', rules)).type;
    expectOk(await gate.issueTicket('t', { userId: 'u', role: 'USER', liveStreamId: 's' }, 30));

    expect([await admit(), await admit()]).toEqual(['admitted', 'refused']);
    nowMs = 5_000;
    expect(await admit()).toBe('admitted');

    gate.clear();
    expect([await admit(), expectOk(await gate.redeemTicket('t'))]).toEqual(['admitted', null]);
  });
});
